import { test as base, expect } from "@playwright/test";
import pg from "pg";
import { createdEmails } from "./plan-helpers";

/** The application's tables, the same set the API suite fingerprints. */
const TABLES = ["CartLine", "Cart", "Address", "PasswordResetToken", "RefreshToken", "ProductCategory", "Product", "Category", "UapReport", "User"];

async function fingerprint(db: pg.Client): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const table of TABLES) {
    const { rows } = await db.query(
      `SELECT count(*) AS rows, md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) AS digest FROM "${table}" t`,
    );
    result[table] = `${rows[0].rows}:${rows[0].digest}`;
  }
  return result;
}

/**
 * Every browser case runs against the development database the servers use,
 * so each one cleans up after itself: the accounts it registered (their
 * sessions, reset tokens, addresses and carts go with them) and the guest
 * carts its browser started. It then checks that the database is exactly
 * what it was before the case began, so no case can lean on another's
 * leftovers or leave any behind.
 */
export const test = base.extend<{ cleanDatabase: void }>({
  cleanDatabase: [
    async ({ context }, use) => {
      const db = new pg.Client({ connectionString: process.env.DATABASE_URL ?? "postgresql://school:school@localhost:5432/school" });
      await db.connect();
      const before = await fingerprint(db);
      createdEmails.length = 0;

      await use();

      const guestTokens = (await context.cookies()).filter((cookie) => cookie.name === "cart_token").map((cookie) => cookie.value);
      await db.query(`DELETE FROM "Cart" WHERE token = ANY($1)`, [guestTokens]);
      await db.query(`DELETE FROM "User" WHERE lower(email) = ANY($1)`, [createdEmails.map((email) => email.toLowerCase())]);

      expect(await fingerprint(db), "the case left the database different from how it found it").toEqual(before);
      await db.end();
    },
    { auto: true },
  ],
});

export { expect };
