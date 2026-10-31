import { PrismaClient } from "@prisma/client";
import { resetDatabase } from "./db-helpers";

/**
 * Runs around every API test (see setupFilesAfterEnv in jest-e2e.json). The
 * suite owns school_test outright, and every case builds the rows it needs in
 * its own beforeEach or body — so emptying every table after each case
 * leaves the database exactly as the next case, in any order or alone,
 * expects to find it: empty.
 */
const prisma = new PrismaClient();

afterEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());
