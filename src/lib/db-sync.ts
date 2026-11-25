/**
 * مزامنة البيانات بين قاعدتي بيانات (محلية ↔ سحابية).
 *
 * تعمل على مستوى الخادم (Route Handler) لأنها تتعامل مع `pg` مباشرة.
 *
 * المبدأ:
 *  - المطابقة تتم بمفتاح العمل (رقم الفاتورة، كود المنتج، اسم العميل...) وليس
 *    بالمعرّف الرقمي `id`، لأن `id` متسلسل داخل كل قاعدة على حدة وقد يتعارض
 *    بين القاعدتين. لذلك نترجم معرّفات المصدر إلى معرّفات الهدف عند النسخ.
 *  - لا تُحذف أي بيانات: نُدرج السجلات غير الموجودة، ونحدّث السجل الموجود فقط
 *    إذا كان الطابع الزمني في المصدر أحدث (أو كان السجل من نوع الإعدادات/المستخدمين
 *    الذي يُنسخ دائماً).
 *  - الجداول بلا طابع زمني: تُنسخ السجلات الجديدة فقط دون المساس الموجود.
 */
import { Client } from "pg";

export type SyncDirection = "push" | "pull" | "both";

export type SyncTableDetail = {
  table: string;
  copied: number;
  /** السجلات التي تعذّر ربطها بسبب مرجع مفقود */
  skipped: number;
  /** اتجاه النسخ: push = من المحلية إلى السحابية، pull = من السحابية إلى المحلية */
  direction: "push" | "pull";
  error?: string;
};

export type SyncReport = {
  ok: boolean;
  message: string;
  /** إجمالي السجلات المنسوخة */
  copied: number;
  /** عدد السجلات المرفوعة إلى السحابية */
  pushed: number;
  /** عدد السجلات المسحوبة إلى القاعدة المحلية */
  pulled: number;
  /** تفاصيل لكل جدول مع اتجاهه */
  details: SyncTableDetail[];
  durationMs: number;
};

/* ============================ وصف الجداول المُزامَنة ============================ */

type ForeignKeySpec = {
  col: string;
  parent?: string;
  /** عميل/مورد — يعتمد على نوع السجل */
  parties?: boolean;
  /** المرجع اختياري: نتركه فارغاً إن تعذّرت ترجمته */
  optional?: boolean;
};

type TableSpec = {
  name: string;
  /** أعمدة المفتاح التجاري */
  match: string[];
  /** عمود الطابع الزمني الذي يحدد «الأحدث» */
  time: string | null;
  fks?: ForeignKeySpec[];
  /** نحدّث السجل الموجود دائماً (إعدادات / مستخدمون) */
  always?: boolean;
};

/** ترتيب الجداول: الأبناء بعد الآباء */
export const SYNC_TABLES: TableSpec[] = [
  { name: "categories", match: ["name"], time: null },
  { name: "payment_methods", match: ["name"], time: null },
  {
    name: "products",
    match: ["code"],
    time: null,
    fks: [{ col: "category_id", parent: "categories" }],
  },
  { name: "customers", match: ["name", "phone"], time: "created_at" },
  { name: "suppliers", match: ["name", "phone"], time: "created_at" },
  { name: "expenses", match: ["number"], time: "created_at" },
  {
    name: "treasury_movements",
    match: ["direction", "source", "reference", "amount"],
    time: "created_at",
  },
  {
    name: "vouchers",
    match: ["number", "kind"],
    time: "created_at",
    fks: [{ col: "party_id", parties: true }],
  },
  {
    name: "installment_plans",
    match: ["invoice_number", "months"],
    time: "created_at",
    fks: [{ col: "customer_id", parent: "customers" }],
  },
  {
    name: "installments",
    match: ["plan_id", "sequence"],
    time: null,
    fks: [
      { col: "plan_id", parent: "installment_plans" },
      { col: "customer_id", parent: "customers", optional: true },
    ],
  },
  {
    name: "invoices",
    match: ["number"],
    time: "created_at",
    fks: [{ col: "customer_id", parent: "customers", optional: true }],
  },
  {
    name: "invoice_items",
    match: ["invoice_id", "code", "qty", "price"],
    time: null,
    fks: [
      { col: "invoice_id", parent: "invoices" },
      { col: "product_id", parent: "products", optional: true },
    ],
  },
  {
    name: "purchases",
    match: ["number"],
    time: "created_at",
    fks: [{ col: "supplier_id", parent: "suppliers" }],
  },
  {
    name: "purchase_items",
    match: ["purchase_id", "code", "qty", "price"],
    time: null,
    fks: [
      { col: "purchase_id", parent: "purchases" },
      { col: "product_id", parent: "products" },
    ],
  },
  {
    name: "returns",
    match: ["number", "kind"],
    time: "created_at",
    fks: [{ col: "party_id", parties: true }],
  },
  {
    name: "return_items",
    match: ["return_id", "code", "qty", "price"],
    time: null,
    fks: [
      { col: "return_id", parent: "returns" },
      { col: "product_id", parent: "products" },
    ],
  },
  { name: "shifts", match: ["number"], time: "opened_at" },
  { name: "settings", match: ["key"], time: null, always: true },
  { name: "app_users", match: ["username"], time: null, always: true },
];

/* ================================ أدوات مساعدة ================================ */

type Row = Record<string, unknown>;

function quoteIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function tableExists(client: Client, table: string): Promise<boolean> {
  const res = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1",
    [table],
  );
  return (res.rowCount ?? 0) > 0;
}

async function columnsOf(client: Client, table: string): Promise<string[]> {
  const res = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
    [table],
  );
  return res.rows.map((r: { column_name: string }) => r.column_name);
}

/** تحويل قيمة إلى نص ثابت للمقارنة */
function normalize(value: unknown): string {
  if (value === null || value === undefined) return " null";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** مفتاح المطابقة التجاري */
function matchKey(row: Row, cols: string[]): string {
  return cols.map((c) => normalize(row[c])).join("");
}

/** ترجمة معرّف الطرف (عميل/مورد) اعتماداً على نوع السجل */
function resolveParty(spec: TableSpec, row: Row, idMaps: IdMaps): Map<string, unknown> | null {
  if (spec.name === "vouchers") {
    const type = normalize(row.party_type);
    if (type.includes("مورد") || type.includes("supplier")) return idMaps.suppliers;
    if (type.includes("عميل") || type.includes("customer")) return idMaps.customers;
  }
  if (spec.name === "returns") {
    const kind = normalize(row.kind);
    if (kind.includes("مشتريات") || kind.includes("purchase")) return idMaps.suppliers;
    if (kind.includes("مبيعات") || kind.includes("sales")) return idMaps.customers;
  }
  return null;
}

type IdMaps = Record<string, Map<string, unknown>>;

/* ============================== نسخ جدول واحد ============================== */

/**
 * ينسخ جدولاً واحداً من المصدر إلى الهدف.
 * @returns عدد السجلات المنسوخة والمتخطاة
 */
export async function copyTable(
  source: Client,
  target: Client,
  spec: TableSpec,
  idMaps: IdMaps,
): Promise<{ copied: number; skipped: number }> {
  if (!(await tableExists(source, spec.name))) return { copied: 0, skipped: 0 };
  if (!(await tableExists(target, spec.name))) return { copied: 0, skipped: 0 };

  const sourceCols = await columnsOf(source, spec.name);
  const targetCols = await columnsOf(target, spec.name);
  if (sourceCols.length === 0 || targetCols.length === 0) return { copied: 0, skipped: 0 };

  /* الأعمدة المشتركة (بدون id — نترك القاعدة الهدف تختار المعرّف) */
  const writeCols = sourceCols.filter((c) => targetCols.includes(c) && c !== "id");
  if (writeCols.length === 0) return { copied: 0, skipped: 0 };

  const hasId = sourceCols.includes("id") && targetCols.includes("id");
  const selectCols = hasId ? [...writeCols, "id"] : writeCols;

  /* أعمدة المطابقة يجب أن تكون موجودة في الطرفين */
  const matchCols = spec.match.filter((c) => writeCols.includes(c));
  if (matchCols.length === 0) return { copied: 0, skipped: 0 };

  const timeCol = spec.time && writeCols.includes(spec.time) ? spec.time : null;

  const order = timeCol ? ` ORDER BY ${quoteIdent(timeCol)} DESC` : "";
  const srcRes = await source.query(
    `SELECT ${selectCols.map(quoteIdent).join(", ")} FROM ${quoteIdent(spec.name)}${order}`,
  );
  const srcRows = srcRes.rows as Row[];

  const tgtRes = await target.query(
    `SELECT ${selectCols.map(quoteIdent).join(", ")} FROM ${quoteIdent(spec.name)}`,
  );
  const tgtRows = tgtRes.rows as Row[];

  /* خريطة: المفتاح التجاري ← صف الهدف */
  const targetByKey = new Map<string, Row>();
  for (const row of tgtRows) targetByKey.set(matchKey(row, matchCols), row);

  /* خريطة ترجمة المعرّفات: معرّف المصدر ← معرّف الهدف */
  const idMap = idMaps[spec.name] ?? (idMaps[spec.name] = new Map());

  const setClause = writeCols.map((c, i) => `${quoteIdent(c)} = $${i + 1}`).join(", ");
  const placeholders = writeCols.map((_, i) => `$${i + 1}`).join(", ");
  const insertSql =
    `INSERT INTO ${quoteIdent(spec.name)} (${writeCols.map(quoteIdent).join(", ")}) ` +
    `VALUES (${placeholders})` +
    (hasId ? " RETURNING id" : "");

  /* شرط التحديث: بالمعرّف إن وُجد، وإلا بأعمدة المفتاح التجاري */
  const updateWhere = hasId
    ? `${quoteIdent("id")} = $${writeCols.length + 1}`
    : matchCols.map((c, i) => `${quoteIdent(c)} = $${writeCols.length + i + 1}`).join(" AND ");

  let copied = 0;
  let skipped = 0;

  for (const row of srcRows) {
    const prepared: Row = { ...row };

    /* ترجمة المفاتيح الأجنبية */
    let usable = true;
    for (const fk of spec.fks ?? []) {
      if (!writeCols.includes(fk.col)) continue;
      const raw = row[fk.col];
      if (raw === null || raw === undefined) {
        if (!fk.optional) prepared[fk.col] = null;
        continue;
      }
      const map = fk.parties ? resolveParty(spec, row, idMaps) : (fk.parent ? idMaps[fk.parent] : null);
      const mapped = map ? map.get(normalize(raw)) : undefined;
      if (mapped === undefined) {
        if (fk.optional) {
          prepared[fk.col] = null;
        } else {
          usable = false;
          break;
        }
      } else {
        prepared[fk.col] = mapped;
      }
    }
    if (!usable) {
      skipped++;
      continue;
    }

    const key = matchKey(prepared, matchCols);
    const existing = targetByKey.get(key);

    if (existing) {
      /* السجل موجود مسبقاً */
      if (hasId) idMap.set(normalize(row.id), existing.id);

      const shouldUpdate = spec.always
        ? true
        : timeCol
          ? isNewer(prepared[timeCol], existing[timeCol])
          : false;

      if (shouldUpdate) {
        const values = writeCols.map((c) => prepared[c]);
        const whereValues = hasId ? [existing.id] : matchCols.map((c) => existing[c]);
        await target.query(
          `UPDATE ${quoteIdent(spec.name)} SET ${setClause} WHERE ${updateWhere}`,
          [...values, ...whereValues],
        );
        copied++;
      }
      continue;
    }

    /* سجل جديد — نُدرجه ونترك القاعدة تختار المعرّف */
    const values = writeCols.map((c) => prepared[c]);
    const ins = await target.query(insertSql, values);
    if (hasId) {
      const newId = (ins.rows?.[0] as { id?: unknown } | undefined)?.id;
      if (newId !== undefined && newId !== null) idMap.set(normalize(row.id), newId);
    }
    copied++;
  }

  return { copied, skipped };
}

/** هل الطابع الزمني في المصدر أحدث من الهدف؟ */
function isNewer(sourceTime: unknown, targetTime: unknown): boolean {
  const s = sourceTime ? new Date(String(sourceTime)).getTime() : 0;
  const t = targetTime ? new Date(String(targetTime)).getTime() : 0;
  return s > t;
}

/* ============================== تنفيذ المزامنة ============================== */

/**
 * تنفيذ المزامنة بين عميلين متصلين بالفعل.
 * @param local  عميل القاعدة المحلية
 * @param cloud  عميل القاعدة السحابية
 * @param direction push | pull | both
 */
export async function syncDatabases(
  local: Client,
  cloud: Client,
  direction: SyncDirection,
): Promise<SyncReport> {
  const started = Date.now();
  const details: SyncTableDetail[] = [];

  const pairs: { from: Client; to: Client; direction: "push" | "pull" }[] =
    direction === "push"
      ? [{ from: local, to: cloud, direction: "push" }]
      : direction === "pull"
        ? [{ from: cloud, to: local, direction: "pull" }]
        : [
            { from: local, to: cloud, direction: "push" },
            { from: cloud, to: local, direction: "pull" },
          ];

  for (const pair of pairs) {
    /* خريطة ترجمة المعرّفات خاصة بكل اتجاه */
    const idMaps: IdMaps = {};
    for (const spec of SYNC_TABLES) {
      try {
        const { copied, skipped } = await copyTable(pair.from, pair.to, spec, idMaps);
        if (copied > 0 || skipped > 0) {
          details.push({ table: spec.name, copied, skipped, direction: pair.direction });
        }
      } catch (err) {
        /* جدول واحد فاشل لا يوقف بقية المزامنة */
        details.push({
          table: spec.name,
          copied: 0,
          skipped: 0,
          direction: pair.direction,
          error: err instanceof Error ? err.message : "خطأ غير معروف",
        });
      }
    }
  }

  const copied = details.reduce((s, d) => s + d.copied, 0);
  const pushed = details.filter((d) => d.direction === "push").reduce((s, d) => s + d.copied, 0);
  const pulled = details.filter((d) => d.direction === "pull").reduce((s, d) => s + d.copied, 0);

  const parts: string[] = [];
  if (pushed > 0) parts.push(`${pushed} سجل إلى السحابية`);
  if (pulled > 0) parts.push(`${pulled} سجل إلى القاعدة المحلية`);

  return {
    ok: true,
    message:
      copied > 0
        ? `تمت مزامنة ${copied} سجل (${parts.join(" • ")})`
        : "القاعدتان متطابقتان — لا توجد سجلات جديدة",
    copied,
    pushed,
    pulled,
    details,
    durationMs: Date.now() - started,
  };
}

/**
 * واجهة عالية المستوى: تفتح اتصالين وتنفّذ المزامنة.
 */
export async function syncByUrl(
  localUrl: string,
  cloudUrl: string,
  direction: SyncDirection = "both",
): Promise<SyncReport> {
  const started = Date.now();
  const local = new Client({ connectionString: localUrl });
  const cloud = new Client({ connectionString: cloudUrl });
  try {
    await local.connect();
    await cloud.connect();
    return await syncDatabases(local, cloud, direction);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "تعذّر تنفيذ المزامنة",
      copied: 0,
      pushed: 0,
      pulled: 0,
      details: [],
      durationMs: Date.now() - started,
    };
  } finally {
    await local.end().catch(() => undefined);
    await cloud.end().catch(() => undefined);
  }
}
