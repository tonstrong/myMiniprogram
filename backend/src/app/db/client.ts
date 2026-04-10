import mysql, {
  Pool,
  PoolConnection,
  QueryResult,
  RowDataPacket
} from "mysql2/promise";
import { loadConfig } from "../config";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const { databaseUrl } = loadConfig();
    pool = mysql.createPool({
      uri: databaseUrl,
      multipleStatements: true
    });
  }

  return pool;
}

export async function withClient<T>(
  handler: (client: PoolConnection) => Promise<T>
): Promise<T> {
  const client = await getPool().getConnection();

  try {
    return await handler(client);
  } finally {
    client.release();
  }
}

export async function query<T extends RowDataPacket[] | RowDataPacket[][] | QueryResult>(
  text: string,
  params?: unknown[]
): Promise<T> {
  const [rows] = await getPool().query<T>(text, params);
  return rows;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
