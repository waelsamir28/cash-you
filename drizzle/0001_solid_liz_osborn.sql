CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_name" text DEFAULT '' NOT NULL,
	"action" text NOT NULL,
	"entity" text DEFAULT '' NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"details" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text DEFAULT '' NOT NULL,
	"before" double precision DEFAULT 0 NOT NULL,
	"after" double precision DEFAULT 0 NOT NULL,
	"diff" double precision DEFAULT 0 NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"user_name" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_users" ADD COLUMN "permissions" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "balance_effect" double precision;