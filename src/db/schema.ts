import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  date,
} from "drizzle-orm/pg-core";

export const offlineSyncReceipts = pgTable("offline_sync_receipts", {
  operationId: text("operation_id").primaryKey(),
  responseBody: text("response_body").notNull(),
  status: integer("status").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hue: text("hue").notNull().default("slate"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  categoryId: integer("category_id").notNull().default(0),
  unit: text("unit").notNull().default("قطعة"),
  price: doublePrecision("price").notNull().default(0),
  wholesalePrice: doublePrecision("wholesale_price").notNull().default(0),
  cost: doublePrecision("cost").notNull().default(0),
  stock: doublePrecision("stock").notNull().default(0),
  minStockLimit: doublePrecision("min_stock_limit").notNull().default(5),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  openingBalance: doublePrecision("opening_balance").notNull().default(0),
  balance: doublePrecision("balance").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  address: text("address").notNull().default(""),
  openingBalance: doublePrecision("opening_balance").notNull().default(0),
  balance: doublePrecision("balance").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull().default("عميل نقدي"),
  paymentMethod: text("payment_method").notNull().default("نقدي"),
  saleType: text("sale_type").notNull().default("نقدي"),
  subtotal: doublePrecision("subtotal").notNull().default(0),
  discountPercent: doublePrecision("discount_percent").notNull().default(0),
  discountValue: doublePrecision("discount_value").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
  paid: doublePrecision("paid").notNull().default(0),
  remaining: doublePrecision("remaining").notNull().default(0),
  itemsCount: integer("items_count").notNull().default(0),
  userName: text("user_name").notNull().default("م. وائل الجمال"),
  printed: boolean("printed").notNull().default(false),
  /** أثر الفاتورة على رصيد العميل (متبقي + فائدة − تنزيل على الحساب). null للفواتير القديمة */
  balanceEffect: doublePrecision("balance_effect"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  productId: integer("product_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("قطعة"),
  qty: doublePrecision("qty").notNull().default(1),
  price: doublePrecision("price").notNull().default(0),
  discount: doublePrecision("discount").notNull().default(0),
  total: doublePrecision("total").notNull().default(0),
});

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  supplierId: integer("supplier_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  total: doublePrecision("total").notNull().default(0),
  paid: doublePrecision("paid").notNull().default(0),
  remaining: doublePrecision("remaining").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const purchaseItems = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull(),
  productId: integer("product_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  qty: doublePrecision("qty").notNull(),
  price: doublePrecision("price").notNull(),
  total: doublePrecision("total").notNull(),
});

export const returns = pgTable("returns", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  kind: text("kind").notNull(), // مرتجع مبيعات / مرتجع مشتريات
  referenceNumber: integer("reference_number"),
  partyId: integer("party_id"),
  partyName: text("party_name").notNull(),
  total: doublePrecision("total").notNull().default(0),
  cashAmount: doublePrecision("cash_amount").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const returnItems = pgTable("return_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id").notNull(),
  productId: integer("product_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  unit: text("unit").notNull(),
  qty: doublePrecision("qty").notNull(),
  price: doublePrecision("price").notNull(),
  total: doublePrecision("total").notNull(),
});

export const vouchers = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  kind: text("kind").notNull(), // سند قبض / سند صرف
  partyType: text("party_type").notNull(), // عميل / مورد
  partyId: integer("party_id").notNull(),
  partyName: text("party_name").notNull(),
  amount: doublePrecision("amount").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const installmentPlans = pgTable("installment_plans", {
  id: serial("id").primaryKey(),
  invoiceNumber: integer("invoice_number").notNull(),
  customerId: integer("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  principal: doublePrecision("principal").notNull(),
  downPayment: doublePrecision("down_payment").notNull(),
  interestRate: doublePrecision("interest_rate").notNull(),
  interestValue: doublePrecision("interest_value").notNull(),
  months: integer("months").notNull(),
  monthlyAmount: doublePrecision("monthly_amount").notNull(),
  firstDueDate: date("first_due_date").notNull(),
  guarantorName: text("guarantor_name").notNull().default(""),
  guarantorPhone: text("guarantor_phone").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const installments = pgTable("installments", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  customerId: integer("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  sequence: integer("sequence").notNull(),
  dueDate: date("due_date").notNull(),
  amount: doublePrecision("amount").notNull(),
  status: text("status").notNull().default("مستحق"),
  paidAt: timestamp("paid_at"),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  category: text("category").notNull(),
  amount: doublePrecision("amount").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const treasuryMovements = pgTable("treasury_movements", {
  id: serial("id").primaryKey(),
  direction: text("direction").notNull(), // وارد / منصرف
  source: text("source").notNull(),
  reference: text("reference").notNull().default(""),
  partyName: text("party_name").notNull().default(""),
  amount: doublePrecision("amount").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  openedAt: timestamp("opened_at").notNull().defaultNow(),
  closedAt: timestamp("closed_at"),
  openingCash: doublePrecision("opening_cash").notNull().default(0),
  closingCash: doublePrecision("closing_cash").notNull().default(0),
  sales: doublePrecision("sales").notNull().default(0),
  purchases: doublePrecision("purchases").notNull().default(0),
  expenses: doublePrecision("expenses").notNull().default(0),
  receipts: doublePrecision("receipts").notNull().default(0),
  payments: doublePrecision("payments").notNull().default(0),
  status: text("status").notNull().default("مفتوحة"),
  notes: text("notes").notNull().default(""),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* ============================ حسابات المستخدمين والفترة التجريبية ============================ */

export const appUsers = pgTable("app_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("owner"), // owner | cashier
  /** صلاحيات الشاشات للكاشير (JSON array). null = الافتراضي */
  permissions: text("permissions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at"),
});

export const appSessions = pgTable("app_sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

/** عداد الاستخدام الطبقي للفترة التجريبية (صنف/عميل/مورد/فاتورة...) */
export const usageCounters = pgTable("usage_counters", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** سجل النشاط: من عمل ماذا ومتى (حذف فواتير، جرد، تعديل صلاحيات) */
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  userName: text("user_name").notNull().default(""),
  action: text("action").notNull(),
  entity: text("entity").notNull().default(""),
  reference: text("reference").notNull().default(""),
  details: text("details").notNull().default(""),
});

/** حركات تسوية المخزون الناتجة عن الجرد */
export const stockAdjustments = pgTable("stock_adjustments", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull().default(""),
  before: doublePrecision("before").notNull().default(0),
  after: doublePrecision("after").notNull().default(0),
  diff: doublePrecision("diff").notNull().default(0),
  reason: text("reason").notNull().default(""),
  userName: text("user_name").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
