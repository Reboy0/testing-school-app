import { PrismaClient } from "@prisma/client";

/** Every table the application owns, in an order that is safe to delete in. */
export const TABLES = [
  "CartLine",
  "Cart",
  "Address",
  "PasswordResetToken",
  "RefreshToken",
  "ProductCategory",
  "Product",
  "Category",
  "UapReport",
  "User",
] as const;

/**
 * A fingerprint of the whole database: for every table its row count and an
 * md5 of every row's full text, in a stable order. Two equal fingerprints
 * mean the tables hold exactly the same rows — not just as many.
 */
export async function fingerprint(prisma: PrismaClient): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const table of TABLES) {
    const [row] = await prisma.$queryRawUnsafe<{ rows: bigint; digest: string }[]>(
      `SELECT count(*) AS rows, md5(coalesce(string_agg(t::text, ',' ORDER BY t::text), '')) AS digest FROM "${table}" t`,
    );
    result[table] = `${row.rows}:${row.digest}`;
  }
  return result;
}

/** Empties every table: what each API test starts from and leaves behind. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`);
}
