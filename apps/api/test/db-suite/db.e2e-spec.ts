/**
 * OpenCards suite «БД» (prefix DB): the data layer on its own — creating,
 * reading, updating and deleting every model, and the constraints and
 * cascades the schema promises.
 *
 * Every case is self-contained: it creates, through code, every row it acts
 * on (a delete case first creates the row it then deletes), never relies on
 * another case or on seed data, removes what it made, and finally checks
 * that the whole database is byte-for-byte what it was before it started.
 */
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { fingerprint } from "../db-helpers";

const prisma = new PrismaClient();

afterAll(() => prisma.$disconnect());

/** Rows a case created, removed in reverse order when it ends, whatever happened. */
class Created {
  private readonly cleanups: (() => Promise<unknown>)[] = [];

  async user(overrides: Partial<Prisma.UserUncheckedCreateInput> = {}) {
    const user = await prisma.user.create({
      data: {
        id: `usr_db_${randomUUID()}`,
        email: `db-${randomUUID()}@example.com`,
        passwordHash: "$2a$10$notarealhashnotarealhashnotarealhashnotarealhash.",
        name: "DB User",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        ...overrides,
      },
    });
    this.cleanups.push(() => prisma.user.deleteMany({ where: { id: user.id } }));
    return user;
  }

  async category() {
    const id = `cat_db_${randomUUID()}`;
    const category = await prisma.category.create({ data: { id, slug: id, name: "DB Category" } });
    this.cleanups.push(() => prisma.category.deleteMany({ where: { id } }));
    return category;
  }

  async product(overrides: Partial<Prisma.ProductUncheckedCreateInput> = {}) {
    const id = `prd_db_${randomUUID()}`;
    const product = await prisma.product.create({
      data: { id, slug: id, name: "DB Product", description: "", priceCents: 1000, imageUrl: "/x", stock: 5, ...overrides },
    });
    this.cleanups.push(() => prisma.product.deleteMany({ where: { id } }));
    return product;
  }

  async guestCart() {
    const cart = await prisma.cart.create({ data: { token: randomUUID() } });
    this.cleanups.push(() => prisma.cart.deleteMany({ where: { id: cart.id } }));
    return cart;
  }

  async cleanup() {
    for (const cleanup of this.cleanups.reverse()) await cleanup();
  }
}

/** A case that must leave the database exactly as it found it. */
function isolated(title: string, body: (created: Created) => Promise<void>) {
  it(title, async () => {
    const before = await fingerprint(prisma);
    const created = new Created();
    try {
      await body(created);
    } finally {
      await created.cleanup();
    }
    expect(await fingerprint(prisma)).toEqual(before);
  });
}

const errorCode = (promise: Promise<unknown>) =>
  promise.then(
    () => "no error",
    (error: unknown) => (error instanceof Prisma.PrismaClientKnownRequestError ? error.code : String(error)),
  );

describe("users", () => {
  isolated("DB-01: a created user is stored with every field and the USER role by default", async (created) => {
    const user = await created.user({ name: "Ada", phone: "+380501234567" });

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored).toMatchObject({ email: user.email, name: "Ada", phone: "+380501234567", role: "USER" });
    expect(stored.createdAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  isolated("DB-02: a second user with the same email is refused by the unique constraint", async (created) => {
    const user = await created.user();

    expect(await errorCode(created.user({ email: user.email }))).toBe("P2002");
    expect(await prisma.user.count({ where: { email: user.email } })).toBe(1);
  });

  isolated("DB-03: updating a user changes only the columns written", async (created) => {
    const user = await created.user({ name: "Before" });

    await prisma.user.update({ where: { id: user.id }, data: { phone: "+380000000000" } });

    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
      name: "Before",
      email: user.email,
      phone: "+380000000000",
    });
  });

  isolated("DB-04: deleting a user deletes their tokens, addresses, cart and cart lines with them", async (created) => {
    const user = await created.user();
    const product = await created.product();
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date() } });
    await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date() } });
    await prisma.address.create({ data: { userId: user.id, label: "Home", line1: "1", city: "Kyiv", postalCode: "1", country: "UA" } });
    const cart = await prisma.cart.create({ data: { userId: user.id, lines: { create: { productId: product.id, quantity: 2 } } } });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.address.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.cart.count({ where: { id: cart.id } })).toBe(0);
    expect(await prisma.cartLine.count({ where: { cartId: cart.id } })).toBe(0);
    expect(await prisma.product.count({ where: { id: product.id } })).toBe(1);
  });
});

describe("session and reset tokens", () => {
  isolated("DB-05: a refresh token hash can be stored only once", async (created) => {
    const user = await created.user();
    const tokenHash = randomUUID();
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date() } });

    expect(await errorCode(prisma.refreshToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date() } }))).toBe("P2002");
  });

  isolated("DB-06: revoking a refresh token records when, and leaves the row in place", async (created) => {
    const user = await created.user();
    const token = await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date() } });
    expect(token.revokedAt).toBeNull();

    const revokedAt = new Date("2026-02-01T00:00:00.000Z");
    await prisma.refreshToken.update({ where: { id: token.id }, data: { revokedAt } });

    expect((await prisma.refreshToken.findUniqueOrThrow({ where: { id: token.id } })).revokedAt).toEqual(revokedAt);
  });

  isolated("DB-07: a reset token starts unused, can be marked used, and is deleted on its own without touching the user", async (created) => {
    const user = await created.user();
    const token = await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: randomUUID(), expiresAt: new Date() } });
    expect(token.usedAt).toBeNull();

    await prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    expect((await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: token.id } })).usedAt).not.toBeNull();

    await prisma.passwordResetToken.delete({ where: { id: token.id } });
    expect(await prisma.passwordResetToken.count({ where: { id: token.id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
  });
});

describe("addresses", () => {
  const fields = { label: "Home", line1: "1 Main St", city: "Kyiv", postalCode: "01001", country: "UA" };

  isolated("DB-08: a created address belongs to its user and is not the default unless stated", async (created) => {
    const user = await created.user();

    const address = await prisma.address.create({ data: { userId: user.id, ...fields } });

    expect(address).toMatchObject({ ...fields, userId: user.id, isDefault: false });
    expect(await prisma.address.findMany({ where: { userId: user.id } })).toEqual([address]);
  });

  isolated("DB-09: updating an address changes it in place", async (created) => {
    const user = await created.user();
    const address = await prisma.address.create({ data: { userId: user.id, ...fields } });

    await prisma.address.update({ where: { id: address.id }, data: { city: "Lviv", isDefault: true } });

    expect(await prisma.address.findUniqueOrThrow({ where: { id: address.id } })).toMatchObject({ city: "Lviv", isDefault: true, label: "Home" });
  });

  isolated("DB-10: deleting an address created for the case removes only that address", async (created) => {
    const user = await created.user();
    const keep = await prisma.address.create({ data: { userId: user.id, ...fields, label: "Keep" } });
    const doomed = await prisma.address.create({ data: { userId: user.id, ...fields, label: "Delete me" } });

    await prisma.address.delete({ where: { id: doomed.id } });

    expect(await prisma.address.findMany({ where: { userId: user.id } })).toEqual([keep]);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
  });

  isolated("DB-11: an address for a user that does not exist is refused by the foreign key", async () => {
    expect(await errorCode(prisma.address.create({ data: { userId: "usr_missing", ...fields } }))).toBe("P2003");
  });
});

describe("catalogue", () => {
  isolated("DB-12: a category slug can be used only once", async (created) => {
    const category = await created.category();

    expect(await errorCode(prisma.category.create({ data: { id: `cat_${randomUUID()}`, slug: category.slug, name: "Dup" } }))).toBe("P2002");
  });

  isolated("DB-13: a product slug can be used only once, and discountPercent defaults to 0", async (created) => {
    const product = await created.product();
    expect(product.discountPercent).toBe(0);

    expect(await errorCode(created.product({ slug: product.slug }))).toBe("P2002");
  });

  isolated("DB-14: a product can be linked to several categories and read back with them", async (created) => {
    const toys = await created.category();
    const books = await created.category();
    const product = await created.product();

    await prisma.productCategory.createMany({ data: [{ productId: product.id, categoryId: toys.id }, { productId: product.id, categoryId: books.id }] });

    const stored = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, include: { categories: true } });
    expect(stored.categories.map((link) => link.categoryId).sort()).toEqual([toys.id, books.id].sort());
  });

  isolated("DB-15: the same product cannot be linked to the same category twice", async (created) => {
    const category = await created.category();
    const product = await created.product();
    await prisma.productCategory.create({ data: { productId: product.id, categoryId: category.id } });

    expect(await errorCode(prisma.productCategory.create({ data: { productId: product.id, categoryId: category.id } }))).toBe("P2002");
  });

  isolated("DB-16: deleting a product removes its category links and cart lines but keeps the category and the cart", async (created) => {
    const category = await created.category();
    const product = await created.product();
    const cart = await created.guestCart();
    await prisma.productCategory.create({ data: { productId: product.id, categoryId: category.id } });
    await prisma.cartLine.create({ data: { cartId: cart.id, productId: product.id, quantity: 1 } });

    await prisma.product.delete({ where: { id: product.id } });

    expect(await prisma.productCategory.count({ where: { productId: product.id } })).toBe(0);
    expect(await prisma.cartLine.count({ where: { productId: product.id } })).toBe(0);
    expect(await prisma.category.count({ where: { id: category.id } })).toBe(1);
    expect(await prisma.cart.count({ where: { id: cart.id } })).toBe(1);
  });

  isolated("DB-17: deleting a category removes its links but keeps the products", async (created) => {
    const category = await created.category();
    const product = await created.product();
    await prisma.productCategory.create({ data: { productId: product.id, categoryId: category.id } });

    await prisma.category.delete({ where: { id: category.id } });

    expect(await prisma.productCategory.count({ where: { categoryId: category.id } })).toBe(0);
    expect(await prisma.product.count({ where: { id: product.id } })).toBe(1);
  });
});

describe("carts", () => {
  isolated("DB-18: a user can have only one cart", async (created) => {
    const user = await created.user();
    await prisma.cart.create({ data: { userId: user.id } });

    expect(await errorCode(prisma.cart.create({ data: { userId: user.id } }))).toBe("P2002");
  });

  isolated("DB-19: a guest cart token can be used only once", async (created) => {
    const cart = await created.guestCart();

    expect(await errorCode(prisma.cart.create({ data: { token: cart.token } }))).toBe("P2002");
  });

  isolated("DB-20: cart lines are created, change quantity and are read back with their product", async (created) => {
    const cart = await created.guestCart();
    const product = await created.product({ name: "Lamp" });

    const line = await prisma.cartLine.create({ data: { cartId: cart.id, productId: product.id, quantity: 1 } });
    await prisma.cartLine.update({ where: { id: line.id }, data: { quantity: 4 } });

    const stored = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: { lines: { include: { product: true } } } });
    expect(stored.lines).toHaveLength(1);
    expect(stored.lines[0]).toMatchObject({ quantity: 4, product: { name: "Lamp" } });
  });

  isolated("DB-21: deleting a cart line created for the case removes just that line", async (created) => {
    const cart = await created.guestCart();
    const keep = await created.product();
    const doomed = await created.product();
    const kept = await prisma.cartLine.create({ data: { cartId: cart.id, productId: keep.id, quantity: 1 } });
    const line = await prisma.cartLine.create({ data: { cartId: cart.id, productId: doomed.id, quantity: 1 } });

    await prisma.cartLine.delete({ where: { id: line.id } });

    expect(await prisma.cartLine.findMany({ where: { cartId: cart.id } })).toEqual([kept]);
  });

  isolated("DB-22: deleting a cart removes its lines and nothing else", async (created) => {
    const cart = await created.guestCart();
    const product = await created.product();
    await prisma.cartLine.create({ data: { cartId: cart.id, productId: product.id, quantity: 3 } });

    await prisma.cart.delete({ where: { id: cart.id } });

    expect(await prisma.cartLine.count({ where: { cartId: cart.id } })).toBe(0);
    expect(await prisma.product.count({ where: { id: product.id } })).toBe(1);
  });

  isolated("DB-23: a cart line for a product that does not exist is refused by the foreign key", async (created) => {
    const cart = await created.guestCart();

    expect(await errorCode(prisma.cartLine.create({ data: { cartId: cart.id, productId: "prd_missing", quantity: 1 } }))).toBe("P2003");
  });
});
