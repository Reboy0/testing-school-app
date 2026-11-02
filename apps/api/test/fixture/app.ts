import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import { AppModule } from "../../src/app.module";
import { AllExceptionsFilter } from "../../src/common/all-exceptions.filter";
import { PrismaService } from "../../src/prisma/prisma.service";
import { ApiClient } from "../client/api-client";

export interface TestApp {
  server: import("http").Server;
  prisma: PrismaService;
  /** HTTP against this app instance; `api.withCookies(...)` sends a session. */
  api: ApiClient;
  close(): Promise<void>;
}

/**
 * Builds the Nest application the same way `main.ts` does — same cookie
 * parser middleware, same exception filter — so integration tests exercise
 * exactly what the app does in production. Truncates every table before
 * returning so each suite starts from an empty database.
 */
export async function createTestApp(): Promise<TestApp> {
  const app: INestApplication = await NestFactory.create(AppModule, { logger: false });
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    `TRUNCATE "User", "RefreshToken", "PasswordResetToken", "Address", "Category", "Product", "ProductCategory", "Cart", "CartLine" RESTART IDENTITY CASCADE`,
  );

  const server = app.getHttpServer();
  return {
    server,
    prisma,
    api: new ApiClient(server),
    async close() {
      await app.close();
      await prisma.$disconnect();
    },
  };
}
