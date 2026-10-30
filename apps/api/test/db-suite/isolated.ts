/**
 * The isolation harness for the database suites: every case creates through
 * code each row it acts on, removes them when it ends whatever happened, and
 * then checks that the whole database is byte-for-byte what it was before.
 */
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { fingerprint } from "../db-helpers";

export const prisma = new PrismaClient();

afterAll(() => prisma.$disconnect());

/** Rows a case created, removed in reverse order when it ends, whatever happened. */
export class Created {
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
export function isolated(title: string, body: (created: Created) => Promise<void>) {
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

export const errorCode = (promise: Promise<unknown>) =>
  promise.then(
    () => "no error",
    (error: unknown) => (error instanceof Prisma.PrismaClientKnownRequestError ? error.code : String(error)),
  );

