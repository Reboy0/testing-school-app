import { randomUUID } from "node:crypto";
import { Category, Product, Role, User } from "@prisma/client";
import { hashPassword } from "../../src/common/crypto.util";
import { PrismaService } from "../../src/prisma/prisma.service";

const DEFAULT_CREATED_AT = new Date("2026-01-01T00:00:00.000Z");

export async function createUser(
  prisma: PrismaService,
  overrides: { id?: string; email?: string; password?: string; name?: string; role?: Role } = {},
): Promise<User> {
  const password = overrides.password ?? "Password123!";

  return prisma.user.create({
    data: {
      id: overrides.id ?? `usr_${randomUUID()}`,
      email: overrides.email ?? "test@example.com",
      passwordHash: await hashPassword(password),
      name: overrides.name ?? "Test User",
      role: overrides.role ?? Role.USER,
      createdAt: DEFAULT_CREATED_AT,
    },
  });
}

export function createCategory(
  prisma: PrismaService,
  input: { id: string; slug: string; name?: string },
): Promise<Category> {
  return prisma.category.create({
    data: { id: input.id, slug: input.slug, name: input.name ?? input.slug },
  });
}

/**
 * Every field a catalogue assertion can depend on — the price, the sale, the
 * categories — is passed in rather than defaulted. A factory that quietly
 * picks a price is a factory whose tests break when it changes its mind, and
 * a price a test did not choose is a price the test cannot justify asserting
 * on.
 */
export function createProduct(
  prisma: PrismaService,
  input: {
    id: string;
    slug?: string;
    name: string;
    priceCents: number;
    discountPercent?: number;
    stock?: number;
    categoryIds?: string[];
  },
): Promise<Product> {
  return prisma.product.create({
    data: {
      id: input.id,
      slug: input.slug ?? input.id,
      name: input.name,
      description: `${input.name} description`,
      priceCents: input.priceCents,
      discountPercent: input.discountPercent ?? 0,
      imageUrl: "/product-placeholder.svg",
      stock: input.stock ?? 10,
      categories: {
        create: (input.categoryIds ?? []).map((categoryId) => ({ categoryId })),
      },
    },
  });
}
