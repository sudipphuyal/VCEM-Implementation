import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

export type Queryable = {
  query<T extends QueryResultRow = any>(sql: string, params?: readonly unknown[]): Promise<QueryResult<T>>;
};

export type Database = Queryable & {
  close?(): Promise<void>;
};

export function createPostgresPool(connectionString = process.env.DATABASE_URL): Database {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for PostgreSQL-backed VCEM API storage");
  }
  const pool = new Pool({ connectionString });
  return {
    query<T extends QueryResultRow = any>(sql: string, params?: readonly unknown[]) {
      return pool.query<T>(sql, params as any[]);
    },
    close() {
      return pool.end();
    },
  };
}

export async function withTransaction<T>(db: Database, fn: (client: Queryable) => Promise<T>) {
  const maybePool = db as Pool;
  if (typeof maybePool.connect !== "function") return fn(db);
  const client: PoolClient = await maybePool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
