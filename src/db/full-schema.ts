/* مخطط كاش يو الكامل — يُنشأ تلقائياً على قاعدة بيانات فاضية (آمن للتكرار) */
export const FULL_SCHEMA_SQL = `
create table if not exists "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hue" text DEFAULT 'slate' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);

create table if not exists "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"opening_balance" double precision DEFAULT 0 NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

create table if not exists "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"opening_balance" double precision DEFAULT 0 NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

create table if not exists "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);

create table if not exists "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category_id" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'قطعة' NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"wholesale_price" double precision DEFAULT 0 NOT NULL,
	"cost" double precision DEFAULT 0 NOT NULL,
	"stock" double precision DEFAULT 0 NOT NULL,
	"min_stock_limit" double precision DEFAULT 5 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "products_code_unique" UNIQUE("code")
);

create table if not exists "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);

create table if not exists "app_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"full_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "app_users_username_unique" UNIQUE("username")
);

create table if not exists "app_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);

create table if not exists "usage_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

create table if not exists "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"customer_id" integer,
	"customer_name" text DEFAULT 'عميل نقدي' NOT NULL,
	"payment_method" text DEFAULT 'نقدي' NOT NULL,
	"sale_type" text DEFAULT 'نقدي' NOT NULL,
	"subtotal" double precision DEFAULT 0 NOT NULL,
	"discount_percent" double precision DEFAULT 0 NOT NULL,
	"discount_value" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"paid" double precision DEFAULT 0 NOT NULL,
	"remaining" double precision DEFAULT 0 NOT NULL,
	"items_count" integer DEFAULT 0 NOT NULL,
	"user_name" text DEFAULT 'م. وائل الجمال' NOT NULL,
	"printed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

create table if not exists "invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"product_id" integer,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT 'قطعة' NOT NULL,
	"qty" double precision DEFAULT 1 NOT NULL,
	"price" double precision DEFAULT 0 NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL
);

create table if not exists "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"supplier_id" integer NOT NULL,
	"supplier_name" text NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"paid" double precision DEFAULT 0 NOT NULL,
	"remaining" double precision DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

create table if not exists "purchase_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"qty" double precision NOT NULL,
	"price" double precision NOT NULL,
	"total" double precision NOT NULL
);

create table if not exists "returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"reference_number" integer,
	"party_id" integer,
	"party_name" text NOT NULL,
	"total" double precision DEFAULT 0 NOT NULL,
	"cash_amount" double precision DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

create table if not exists "return_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"return_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"qty" double precision NOT NULL,
	"price" double precision NOT NULL,
	"total" double precision NOT NULL
);

create table if not exists "vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"party_type" text NOT NULL,
	"party_id" integer NOT NULL,
	"party_name" text NOT NULL,
	"amount" double precision NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

create table if not exists "installment_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_number" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"principal" double precision NOT NULL,
	"down_payment" double precision NOT NULL,
	"interest_rate" double precision NOT NULL,
	"interest_value" double precision NOT NULL,
	"months" integer NOT NULL,
	"monthly_amount" double precision NOT NULL,
	"first_due_date" date NOT NULL,
	"guarantor_name" text DEFAULT '' NOT NULL,
	"guarantor_phone" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

create table if not exists "installments" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"sequence" integer NOT NULL,
	"due_date" date NOT NULL,
	"amount" double precision NOT NULL,
	"status" text DEFAULT 'مستحق' NOT NULL,
	"paid_at" timestamp
);

create table if not exists "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"category" text NOT NULL,
	"amount" double precision NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

create table if not exists "treasury_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"direction" text NOT NULL,
	"source" text NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"party_name" text DEFAULT '' NOT NULL,
	"amount" double precision NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

create table if not exists "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"opening_cash" double precision DEFAULT 0 NOT NULL,
	"closing_cash" double precision DEFAULT 0 NOT NULL,
	"sales" double precision DEFAULT 0 NOT NULL,
	"purchases" double precision DEFAULT 0 NOT NULL,
	"expenses" double precision DEFAULT 0 NOT NULL,
	"receipts" double precision DEFAULT 0 NOT NULL,
	"payments" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'مفتوحة' NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);

create table if not exists "offline_sync_receipts" (
	"operation_id" text PRIMARY KEY NOT NULL,
	"response_body" text NOT NULL,
	"status" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
`;
