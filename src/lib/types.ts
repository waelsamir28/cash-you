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
  role: "owner" | "cashier";
};

export type TrialLimitKey = "products" | "invoices" | "customers" | "suppliers";

export type TrialStatus = {
  trial: boolean;
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
  trial?: TrialStatus;
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
  | "users";