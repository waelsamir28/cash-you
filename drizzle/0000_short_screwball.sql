CREATE TABLE "app_sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"full_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "app_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hue" text DEFAULT 'slate' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"opening_balance" double precision DEFAULT 0 NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"category" text NOT NULL,
	"amount" double precision NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installment_plans" (
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
--> statement-breakpoint
CREATE TABLE "installments" (
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
--> statement-breakpoint
CREATE TABLE "invoice_items" (
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
--> statement-breakpoint
CREATE TABLE "invoices" (
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
--> statement-breakpoint
CREATE TABLE "offline_sync_receipts" (
	"operation_id" text PRIMARY KEY NOT NULL,
	"response_body" text NOT NULL,
	"status" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
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
--> statement-breakpoint
CREATE TABLE "purchase_items" (
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
--> statement-breakpoint
CREATE TABLE "purchases" (
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
--> statement-breakpoint
CREATE TABLE "return_items" (
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
--> statement-breakpoint
CREATE TABLE "returns" (
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
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
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
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"opening_balance" double precision DEFAULT 0 NOT NULL,
	"balance" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"direction" text NOT NULL,
	"source" text NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"party_name" text DEFAULT '' NOT NULL,
	"amount" double precision NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
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
