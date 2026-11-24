import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// Keep database credentials in a local/server environment file, never in source control.
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env", override: false });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is required. Set it in .env.local or the hosting environment.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
