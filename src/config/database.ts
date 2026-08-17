import mysql, {
  Pool,
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { env } from "./env";

type QueryParam = string | number | boolean | Date | null | Buffer;

export type { QueryParam };

let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: "+00:00",
    });
  }
  return pool;
};

export const query = async <T extends RowDataPacket[]>(
  sql: string,
  params: QueryParam[] = []
): Promise<T> => {
  const [rows] = await getPool().query<T>(sql, params);
  return rows;
};

export const execute = async (
  sql: string,
  params: QueryParam[] = []
): Promise<ResultSetHeader> => {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
};

export const withTransaction = async <T>(
  fn: (connection: PoolConnection) => Promise<T>
): Promise<T> => {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};

export const testConnection = async (): Promise<{
  ok: boolean;
  message: string;
  tables?: string[];
}> => {
  try {
    const connection = await getPool().getConnection();
    const [rows] = await connection.query<RowDataPacket[]>("SHOW TABLES");
    const tables = rows.map((row) => String(Object.values(row)[0]));
    connection.release();
    return { ok: true, message: "Database connected", tables };
  } catch (error) {
    const err = error as Error & { sqlMessage?: string };
    return {
      ok: false,
      message: err.sqlMessage || err.message || "Database connection failed",
    };
  }
};
