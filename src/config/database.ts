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
