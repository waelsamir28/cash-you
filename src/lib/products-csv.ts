/* تصدير واستيراد الأصناف بصيغة CSV (يفتحها Excel مباشرة). ملف التصدير يبدأ بـ BOM ليظهر العربي صحيحاً. */

export const PRODUCT_CSV_HEADERS = [
  "الباركود",
  "الاسم",
  "التصنيف",
  "الوحدة",
  "سعر الشراء",
  "سعر البيع قطاعي",
  "سعر البيع جملة",
  "الرصيد",
  "حد التنبيه",
] as const;

function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function productsToCsv(
  rows: { code: string; name: string; categoryName: string; unit: string; cost: number; price: number; wholesalePrice: number; stock: number; minStockLimit: number }[],
): string {
  const lines = [PRODUCT_CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push([r.code, r.name, r.categoryName, r.unit, r.cost, r.price, r.wholesalePrice, r.stock, r.minStockLimit].map(cell).join(","));
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** تحليل CSV مع دعم الحقول بين علامات الاقتباس والفواصل والأسطر داخلها */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export type ProductImportRow = {
  code: string;
  name: string;
  categoryName: string;
  unit: string;
  cost: number;
  price: number;
  wholesalePrice: number;
  stock: number;
  minStockLimit: number;
};

/** يحوّل نص CSV إلى صفوف أصناف؛ الأعمدة تُقرأ بالاسم من الصف الأول */
export function csvToProducts(text: string): { rows: ProductImportRow[]; errors: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], errors: ["الملف لا يحتوي على بيانات"] };
  const header = table[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const required = ["الباركود", "الاسم"];
  const missing = required.filter((h) => col(h) < 0);
  if (missing.length) return { rows: [], errors: [`أعمدة مطلوبة غير موجودة: ${missing.join("، ")}`] };

  const num = (v: string | undefined) => {
    const n = Number(String(v ?? "").replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : NaN;
  };
  const rows: ProductImportRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((r, idx) => {
    const line = idx + 2;
    const get = (name: string) => (col(name) >= 0 ? (r[col(name)] ?? "").trim() : "");
    const code = get("الباركود");
    const name = get("الاسم");
    if (!code || !name) {
      errors.push(`السطر ${line}: الباركود والاسم مطلوبان`);
      return;
    }
    const values = {
      cost: col("سعر الشراء") >= 0 ? num(get("سعر الشراء")) || 0 : 0,
      price: col("سعر البيع قطاعي") >= 0 ? num(get("سعر البيع قطاعي")) || 0 : 0,
      wholesalePrice: col("سعر البيع جملة") >= 0 ? num(get("سعر البيع جملة")) || 0 : 0,
      stock: col("الرصيد") >= 0 ? num(get("الرصيد")) || 0 : 0,
      minStockLimit: col("حد التنبيه") >= 0 ? num(get("حد التنبيه")) || 0 : 5,
    };
    if ([values.cost, values.price, values.wholesalePrice, values.stock, values.minStockLimit].some((v) => v < 0)) {
      errors.push(`السطر ${line}: القيم لا يمكن أن تكون سالبة`);
      return;
    }
    rows.push({
      code,
      name,
      categoryName: get("التصنيف"),
      unit: get("الوحدة") || "قطعة",
      ...values,
    });
  });
  return { rows, errors };
}
