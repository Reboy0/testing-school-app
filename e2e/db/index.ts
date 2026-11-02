import pg from "pg";

/** The application's tables, the same set the API suite fingerprints. */
const TABLES = ["CartLine", "Cart", "Address", "PasswordResetToken", "RefreshToken", "ProductCategory", "Product", "Category", "UapReport", "User"];

export interface Db {
  query<R extends pg.QueryResultRow>(sql: string, params?: unknown[]): Promise<R[]>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function createDb(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 2 });
  return {
    async query<R extends pg.QueryResultRow>(sql: string, params: unknown[] = []) {
      return (await pool.query<R>(sql, params)).rows;
    },
    async ping() {
      await pool.query("SELECT 1");
      return true;
    },
    close: () => pool.end(),
  };
}

/** Row count and content digest of every table, to prove a case left the database as it found it. */
export async function fingerprint(db: Db): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const table of TABLES) {
    const [row] = await db.query<{ rows: string; digest: string }>(
      `SELECT count(*) AS rows, md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) AS digest FROM "${table}" t`,
    );
    result[table] = `${row.rows}:${row.digest}`;
  }
  return result;
}

/** Deletes accounts by email; their sessions, reset tokens, addresses and carts go with them. */
export async function deleteUsers(db: Db, emails: string[]): Promise<void> {
  await db.query(`DELETE FROM "User" WHERE lower(email) = ANY($1)`, [emails.map((email) => email.toLowerCase())]);
}

/** Deletes the guest carts a browser started, by their cart_token cookie. */
export async function deleteGuestCarts(db: Db, tokens: string[]): Promise<void> {
  await db.query(`DELETE FROM "Cart" WHERE token = ANY($1)`, [tokens]);
}

export async function getUserByEmail(db: Db, email: string) {
  const [user] = await db.query<{ id: string; email: string; name: string; phone: string | null }>(
    `SELECT id, email, name, phone FROM "User" WHERE lower(email) = lower($1)`,
    [email],
  );
  return user;
}

export async function getAddresses(db: Db, email: string) {
  return db.query<{ label: string; isDefault: boolean }>(
    `SELECT a.label, a."isDefault" FROM "Address" a JOIN "User" u ON u.id = a."userId" WHERE lower(u.email) = lower($1) ORDER BY a.label`,
    [email],
  );
}

/** How many of each product an account's cart holds, summed across lines. */
export async function getCartLines(db: Db, email: string) {
  return db.query<{ name: string; quantity: number }>(
    `SELECT p.name, sum(l.quantity)::int AS quantity FROM "CartLine" l JOIN "Cart" c ON c.id = l."cartId"
     JOIN "User" u ON u.id = c."userId" JOIN "Product" p ON p.id = l."productId"
     WHERE lower(u.email) = lower($1) GROUP BY p.name ORDER BY p.name`,
    [email],
  );
}
