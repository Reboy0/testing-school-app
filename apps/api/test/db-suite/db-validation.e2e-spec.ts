/**
 * OpenCards suite «Валідація» (prefix VAL), database level: what the schema
 * itself refuses, with no application code in front of it. Raw SQL is used
 * where Prisma would refuse first, so the test reaches Postgres.
 *
 * Every case runs through `isolated`: whatever it creates is removed, and
 * the database must be byte-identical afterwards — including when Postgres
 * unexpectedly accepts a row it should have refused.
 */
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { errorCode, isolated, prisma } from "./isolated";
import { withIds } from "../ids";

/** The Postgres SQLSTATE a raw statement failed with, or "accepted". */
async function sqlState(sql: string, ...values: unknown[]): Promise<string> {
  try {
    await prisma.$executeRawUnsafe(sql, ...values);
    return "accepted";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const meta = error.meta as { code?: string } | undefined;
      return meta?.code ?? error.code;
    }
    return String(error);
  }
}

const NOT_NULL = "23502";
const INVALID_TEXT = "22P02";

describe("required columns", () => {
  it.each(withIds("VAL-214", "VAL-219", [
    ["User.email", `INSERT INTO "User" (id, email, "passwordHash", name, role, "createdAt") VALUES ($1, NULL, 'h', 'n', 'USER', now())`],
    ["User.passwordHash", `INSERT INTO "User" (id, email, "passwordHash", name, role, "createdAt") VALUES ($1, 'x@example.com', NULL, 'n', 'USER', now())`],
    ["User.name", `INSERT INTO "User" (id, email, "passwordHash", name, role, "createdAt") VALUES ($1, 'x@example.com', 'h', NULL, 'USER', now())`],
    ["Product.priceCents", `INSERT INTO "Product" (id, slug, name, description, "priceCents", "imageUrl", stock) VALUES ($1, $1, 'n', '', NULL, '/x', 1)`],
    ["Product.stock", `INSERT INTO "Product" (id, slug, name, description, "priceCents", "imageUrl", stock) VALUES ($1, $1, 'n', '', 100, '/x', NULL)`],
    ["Category.slug", `INSERT INTO "Category" (id, slug, name) VALUES ($1, NULL, 'n')`],
  ]))("%s: NULL in %s is refused by the database", async (_id, _column, sql) => {
    const before = await import("../db-helpers").then(({ fingerprint }) => fingerprint(prisma));

    expect(await sqlState(sql, `val_${randomUUID()}`)).toBe(NOT_NULL);
    expect(await import("../db-helpers").then(({ fingerprint }) => fingerprint(prisma))).toEqual(before);
  });

  isolated("VAL-220: NULL in Address.city and CartLine.quantity is refused by the database", async (created) => {
    const user = await created.user();
    const cart = await created.guestCart();
    const product = await created.product();

    expect(
      await sqlState(`INSERT INTO "Address" (id, "userId", label, line1, city, "postalCode", country) VALUES ($1, $2, 'Home', '1', NULL, '1', 'UA')`, `adr_${randomUUID()}`, user.id),
    ).toBe(NOT_NULL);
    expect(await sqlState(`INSERT INTO "CartLine" (id, "cartId", "productId", quantity) VALUES ($1, $2, $3, NULL)`, `cln_${randomUUID()}`, cart.id, product.id)).toBe(NOT_NULL);
  });
});

describe("enums and types", () => {
  isolated("VAL-221: a role that is not USER or ADMIN is refused by the database", async () => {
    expect(
      await sqlState(`INSERT INTO "User" (id, email, "passwordHash", name, role, "createdAt") VALUES ($1, $2, 'h', 'n', 'SUPERUSER', now())`, `usr_${randomUUID()}`, `${randomUUID()}@example.com`),
    ).toBe(INVALID_TEXT);
  });

  isolated("VAL-222: Prisma refuses an unknown role before it reaches the database", async (created) => {
    const result = await created.user({ role: "SUPERUSER" as never }).then(
      () => "accepted",
      (error: unknown) => (error instanceof Prisma.PrismaClientValidationError ? "validation" : String(error)),
    );

    expect(result).toBe("validation");
  });

  isolated("VAL-223: text where a number belongs (price, stock, quantity) is refused by the database", async (created) => {
    const cart = await created.guestCart();
    const product = await created.product();

    expect(await sqlState(`INSERT INTO "Product" (id, slug, name, description, "priceCents", "imageUrl", stock) VALUES ($1, $1, 'n', '', 'cheap', '/x', 1)`, `prd_${randomUUID()}`)).toBe(INVALID_TEXT);
    expect(await sqlState(`INSERT INTO "Product" (id, slug, name, description, "priceCents", "imageUrl", stock) VALUES ($1, $1, 'n', '', 100, '/x', 'lots')`, `prd_${randomUUID()}`)).toBe(INVALID_TEXT);
    expect(await sqlState(`INSERT INTO "CartLine" (id, "cartId", "productId", quantity) VALUES ($1, $2, $3, 'two')`, `cln_${randomUUID()}`, cart.id, product.id)).toBe(INVALID_TEXT);
  });

  isolated("VAL-224: a fractional price is refused rather than silently truncated to a whole number of cents", async (created) => {
    const stored = await created.product({ priceCents: 9.99 }).then(
      (product) => `stored as ${product.priceCents}`,
      () => "refused",
    );

    expect(stored).toBe("refused");
  });
});

describe("business values the database should not hold", () => {
  // The API refuses all of these (VAL-07…VAL-10). These cases ask whether the
  // database would also refuse them, should any code path ever skip the API
  // checks — the schema declares no CHECK constraints, so it is expected
  // that it does not, and each failure here is that gap made visible.
  isolated("VAL-225: a negative price or stock is refused by the database", async (created) => {
    expect(await errorCode(created.product({ priceCents: -100 }))).not.toBe("no error");
    expect(await errorCode(created.product({ stock: -1 }))).not.toBe("no error");
  });

  isolated("VAL-226: a discount below 0 % or above 100 % is refused by the database", async (created) => {
    expect(await errorCode(created.product({ discountPercent: 150 }))).not.toBe("no error");
    expect(await errorCode(created.product({ discountPercent: -5 }))).not.toBe("no error");
  });

  isolated("VAL-227: a cart line with quantity 0 or below is refused by the database", async (created) => {
    const cart = await created.guestCart();
    const product = await created.product();

    expect(await errorCode(prisma.cartLine.create({ data: { cartId: cart.id, productId: product.id, quantity: 0 } }))).not.toBe("no error");
    expect(await errorCode(prisma.cartLine.create({ data: { cartId: cart.id, productId: product.id, quantity: -3 } }))).not.toBe("no error");
  });

  isolated("VAL-228: an empty email or name is refused by the database", async (created) => {
    expect(await errorCode(created.user({ email: "" }))).not.toBe("no error");
    expect(await errorCode(created.user({ name: "" }))).not.toBe("no error");
  });
});
