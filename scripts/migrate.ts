import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const stripQuotes = (value?: string): string =>
  (value || "").replace(/^['"]|['"]$/g, "");

async function migrate() {
  const connection = await mysql.createConnection({
    host: stripQuotes(process.env.DB_HOST),
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: stripQuotes(process.env.DB_USER),
    password: stripQuotes(process.env.DB_PASSWORD),
    database: stripQuotes(process.env.DB_NAME),
    multipleStatements: true,
  });

  const schemaPath = path.resolve(process.cwd(), "database/schema.sql");
  const raw = fs.readFileSync(schemaPath, "utf8");

  const sql = raw
    .replace(/CREATE DATABASE[\s\S]*?;/i, "")
    .replace(/USE\s+\w+\s*;/i, "")
    .trim();

  console.log("Running schema on", stripQuotes(process.env.DB_NAME));
  await connection.query(sql);

  const [tables] = await connection.query("SHOW TABLES");
  const names = (tables as Record<string, string>[]).map(
    (row) => Object.values(row)[0]
  );
  console.log("Tables created:", names.join(", ") || "(none)");

  await connection.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", (err as Error).message);
  process.exit(1);
});
