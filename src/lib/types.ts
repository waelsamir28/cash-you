export type Category = { id: number; name: string; hue: string; sortOrder: number };

export type Product = {
  id: number;
  code: string;
  name: string;
  categoryId: number;
  unit: string;
  price: number;
  wholesalePrice: number;
  cost: number;
  stock: number;
  minStockLimit: number;
  sortOrder: number;
};

export type Party = {
  id: number;
  name: string;
  phone: string;
  address: string;
  openingBalance: number;
  balance: number;
};

export type Customer = Party;
export type Supplier = Party;
export type PaymentMethod = { id: number; name: string };

export type InvoiceRow = {
  id: number;
  number: number;
  customerId: number | null;
  customerName: string;
  paymentMethod: string;
  saleType: string;
  total: number;
  paid: number;
  remaining: number;
  itemsCount: number;
  createdAt: string;
  printed?: boolean;
};

export type PurchaseRow = {
  id: number;
  number: number;
  supplierId: number;
  supplierName: string;
  total: number;
  paid: number;
  remaining: number;
  createdAt: string;
};

export type ReturnRow = {
  id: number;
  number: number;
  kind: string;
  referenceNumber: number | null;
  partyName: string;
  total: number;
  cashAmount: number;
  createdAt: string;
};

export type VoucherRow = {
  id: number;
  number: number;
  kind: string;
  partyType: string;
  partyName: string;
  amount: number;
  notes: string;
  createdAt: string;
};

export type InstallmentPlanRow = {
  id: number;
  invoiceNumber: number;
  customerId: number;
  customerName: string;
  principal: number;
  downPayment: number;
  interestRate: number;
  interestValue: number;
  months: number;
  monthlyAmount: number;
  firstDueDate: string;
  guarantorName: string;
  guarantorPhone: string;
};

export type InstallmentRow = {
  id: number;
  planId: number;
  customerId: number;
  customerName: string;
  sequence: number;
  dueDate: string;
  amount: number;
  status: string;
  paidAt: string | null;
  invoiceNumber: number;
};

export type ExpenseRow = {
  id: number;
  number: number;
  category: string;
  amount: number;
  notes: string;
  createdAt: string;
};

export type TreasuryRow = {
  id: number;
  direction: string;
  source: string;
  reference: string;
  partyName: string;
  amount: number;
  notes: string;
  createdAt: string;
};

export type ShiftRow = {
  id: number;
  number: number;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number;
  sales: number;
  purchases: number;
  expenses: number;
  receipts: number;
  payments: number;
  status: string;
};

export type Summary = {
  todaySales: number;
  todayPurchases: number;
  todayExpenses: number;
  treasury: number;
  todayReturns: number;
  dueInstallments: number;
  grossProfit: number;
};

export type LineItem = {
  uid: string;
  productId: number | null;
  code: string;
  name: string;
  unit: string;
  qty: number;
  price: number;
  discount: number;
};

export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  role: "owner" | "manager" | "cashier";
};

export type TrialLimitKey = "products" | "invoices" | "customers" | "suppliers";

export type LicenseInfo = {
  active: boolean;
  validUntil: string | null;
  daysLeft: number;
};

export type TrialStatus = {
  trial: boolean;
  /** هل النسخة مفعّلة بكود HMAC */
  licensed: boolean;
  /** تفاصيل الترخيص المدفوع */
  license: LicenseInfo;
  startedAt: string | null;
  endsAt: string | null;
  daysLeft: number;
  expired: boolean;
  usage: Record<TrialLimitKey, number>;
  limits: Record<TrialLimitKey, number>;
};

export type Bootstrap = {
  categories: Category[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  paymentMethods: PaymentMethod[];
  invoices: InvoiceRow[];
  purchases: PurchaseRow[];
  returns: ReturnRow[];
  vouchers: VoucherRow[];
  installmentPlans: InstallmentPlanRow[];
  installments: InstallmentRow[];
  expenses: ExpenseRow[];
  treasury: TreasuryRow[];
  shifts: ShiftRow[];
  summary: Summary;
  nextInvoiceNumber: number;
  nextPurchaseNumber: number;
  shop: { name: string; phone: string };
  /** إعدادات المتجر والثيم والفاتورة (تُحمَّل مع بيانات النظام) */
  settings?: ShopSettings;
  trial?: TrialStatus;
  /** إصدار البرنامج (يُعرض في صفحة الدعم الفني) */
  appVersion?: string;
  /** معلومات عزل بيانات العميل (للتشخيص) */
  tenant?: { key: string; kind: string; isolated: boolean };
};

export type InstallmentInput = {
  downPayment: number;
  interestRate: number;
  months: number;
  firstDueDate: string;
  guarantorName: string;
  guarantorPhone: string;
};

export type SavedInvoice = {
  id: number;
  number: number;
  total: number;
  paid: number;
  remaining: number;
  customerName: string;
  createdAt: string;
  newCustomerBalance: number;
  nextInvoiceNumber: number;
  installmentPlanId?: number;
  installmentIds?: number[];
};

export type ShopSettings = import("@/lib/settings").ShopSettings;

export type ModuleKind =
  | "home"
  | "invoice"
  | "source"
  | "salesReturn"
  | "purchase"
  | "purchaseReturn"
  | "products"
  | "parties"
  | "installments"
  | "expenses"
  | "treasury"
  | "reports"
  | "users"
  | "activation"
  | "support"
  | "settings"
  /* شاشات مضافة (مستوحاة من FATORA) */
  | "invoiceHistory"
  | "suspended"
  | "shortages"
  | "stockMovements"
  | "activityLog"
  | "deletedInvoices"
  | "backup"
  | "dashboard"
  | "itemCard"
  | "stocktake"
  | "barcodePrint"
  | "smartPurchase"
  | "priceKiosk"
  | "health";

/* ============================ أنواع المميزات المضافة ============================ */

export type StockMovement = {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  movementType: string;
  qty: number;
  balanceAfter: number;
  referenceType: string;
  referenceNumber: number | null;
  userName: string;
  notes: string;
  createdAt: string;
};

export type ActivityEntry = {
  id: number;
  userId: number | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: number | null;
  details: string;
  createdAt: string;
};

export type DeletedInvoice = {
  id: number;
  invoiceNumber: number;
  customerName: string;
  total: number;
  itemsJson: string;
  deleteReason: string;
  deletedBy: string;
  deletedAt: string;
};

export type SuspendedInvoice = {
  id: number;
  title: string;
  draftJson: string;
  userName: string;
  createdAt: string;
  updatedAt: string;
};