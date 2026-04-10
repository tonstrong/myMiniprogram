import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { loadConfig } from "../config";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const { databaseUrl } = loadConfig();
    pool = new Pool({ connectionString: databaseUrl });
  }

  return pool;
}

export async function withClient<T>(
  handler: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();

  try {
    return await handler(client);
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
