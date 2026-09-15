import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";

import { loadConfig } from "../../config/env.js";
import { DATABASE_ROUTINES } from "../../contracts/database.js";

type RoutineGroup = (typeof DATABASE_ROUTINES)[keyof typeof DATABASE_ROUTINES];
type ValueOf<T> = T extends unknown ? T[keyof T] : never;
export type ApprovedRoutine = ValueOf<RoutineGroup>;

export interface RoutineExecutor {
  callFunction<Row = QueryResultRow>(
    routine: ApprovedRoutine,
    parameters?: readonly unknown[],
  ): Promise<Row[]>;
  callProcedure(routine: ApprovedRoutine, parameters?: readonly unknown[]): Promise<void>;
}

export type TransactionWork<T> = (transaction: RoutineExecutor) => Promise<T>;

const approvedRoutines = new Set<string>(
  Object.values(DATABASE_ROUTINES).flatMap((group) => Object.values(group)),
);

let pool: Pool | undefined;

function assertApprovedRoutine(routine: string): asserts routine is ApprovedRoutine {
  if (!approvedRoutines.has(routine)) {
    throw new Error(`Database routine is not approved: ${routine}`);
  }
}

function quoteRoutine(routine: ApprovedRoutine): string {
  assertApprovedRoutine(routine);
  const identifiers = routine.split(".");
  if (identifiers.length !== 2 || identifiers.some((part) => !/^[a-z][a-z0-9_]*$/.test(part))) {
    throw new Error(`Invalid database routine identifier: ${routine}`);
  }
  return identifiers.map((part) => `"${part}"`).join(".");
}

function placeholders(count: number): string {
  return Array.from({ length: count }, (_, index) => `$${index + 1}`).join(", ");
}

function createPoolConfig(): PoolConfig {
  const config = loadConfig();
  return {
    connectionString: config.DATABASE_URL,
    max: config.DATABASE_POOL_MAX,
    idleTimeoutMillis: config.DATABASE_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: config.DATABASE_CONNECTION_TIMEOUT_MS,
    allowExitOnIdle: config.NODE_ENV === "test",
  };
}

async function executeFunction<Row>(
  client: Pick<PoolClient, "query">,
  routine: ApprovedRoutine,
  parameters: readonly unknown[],
): Promise<Row[]> {
  const sql = `SELECT * FROM ${quoteRoutine(routine)}(${placeholders(parameters.length)})`;
  const result = await client.query<QueryResultRow>(sql, [...parameters]);
  return result.rows as Row[];
}

async function executeProcedure(
  client: Pick<PoolClient, "query">,
  routine: ApprovedRoutine,
  parameters: readonly unknown[],
): Promise<void> {
  const sql = `CALL ${quoteRoutine(routine)}(${placeholders(parameters.length)})`;
  await client.query(sql, [...parameters]);
}

export function initializePool(overrides: PoolConfig = {}): Pool {
  if (pool) return pool;

  const hasConnectionOverride = Boolean(overrides.connectionString || overrides.host);
  pool = new Pool({ ...(hasConnectionOverride ? {} : createPoolConfig()), ...overrides });
  // A pool-level error without a listener terminates the Node.js process.
  pool.on("error", () => undefined);
  return pool;
}

export function getPool(): Pool {
  return pool ?? initializePool();
}

export async function withClient<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
}

export async function callFunction<Row = QueryResultRow>(
  routine: ApprovedRoutine,
  parameters: readonly unknown[] = [],
): Promise<Row[]> {
  assertApprovedRoutine(routine);
  return withClient((client) => executeFunction<Row>(client, routine, parameters));
}

export async function callProcedure(
  routine: ApprovedRoutine,
  parameters: readonly unknown[] = [],
): Promise<void> {
  assertApprovedRoutine(routine);
  return withClient((client) => executeProcedure(client, routine, parameters));
}

export async function transaction<T>(work: TransactionWork<T>): Promise<T> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    const executor: RoutineExecutor = {
      callFunction: <Row = QueryResultRow>(
        routine: ApprovedRoutine,
        parameters: readonly unknown[] = [],
      ) => executeFunction<Row>(client, routine, parameters),
      callProcedure: (routine: ApprovedRoutine, parameters: readonly unknown[] = []) =>
        executeProcedure(client, routine, parameters),
    };

    try {
      const result = await work(executor);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function healthCheck(): Promise<boolean> {
  try {
    await withClient(async () => undefined);
    return true;
  } catch {
    return false;
  }
}

export async function closePool(): Promise<void> {
  const currentPool = pool;
  pool = undefined;
  if (currentPool) await currentPool.end();
}

/** Facade kept deliberately stateless; every instance uses the process-wide pool above. */
export class Database implements RoutineExecutor {
  initializePool(overrides: PoolConfig = {}): Pool {
    return initializePool(overrides);
  }

  getPool(): Pool {
    return getPool();
  }

  withClient<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    return withClient(work);
  }

  callFunction<Row = QueryResultRow>(
    routine: ApprovedRoutine,
    parameters: readonly unknown[] = [],
  ): Promise<Row[]> {
    return callFunction<Row>(routine, parameters);
  }

  callProcedure(routine: ApprovedRoutine, parameters: readonly unknown[] = []): Promise<void> {
    return callProcedure(routine, parameters);
  }

  transaction<T>(work: TransactionWork<T>): Promise<T> {
    return transaction(work);
  }

  healthCheck(): Promise<boolean> {
    return healthCheck();
  }

  closePool(): Promise<void> {
    return closePool();
  }
}

export const database = new Database();
