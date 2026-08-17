import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 15000,
  };

  console.log("Trying:", {
    host: config.host,
    port: config.port,
    user: config.user,
    database: config.database,
    passwordLength: config.password?.length,
  });

  try {
    const conn = await mysql.createConnection(config);
    const [tables] = await conn.query("SHOW TABLES");
    const [who] = await conn.query("SELECT USER() AS user, DATABASE() AS db");
    console.log("CONNECTED");
    console.log("who:", who);
    console.log("tables:", tables);
    await conn.end();
  } catch (err) {
    const e = err as Error & { code?: string; errno?: number };
    console.log("FAILED:", e.code, e.message);
  }
}

main();
