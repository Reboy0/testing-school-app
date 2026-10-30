/**
 * Unit cases from docs/test-plan.md §6.1 for how the API issues secrets.
 * Expiries are read off what AuthService actually hands to the database and
 * to the client, with the clock pinned, rather than recomputed with the same
 * helper the service uses.
 */
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import { hashPassword, verifyPassword } from "../common/crypto.util";
import { jwtOptions } from "../common/jwt-options";
import { AuthService } from "./auth.service";

const NOW = new Date("2026-03-01T12:00:00.000Z");
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// Only Date is faked: bcrypt and Prisma mocks still need real timers and
// microtasks to resolve.
function pinClock() {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ["nextTick", "setImmediate", "queueMicrotask", "setTimeout", "setInterval", "clearTimeout", "clearInterval"],
  });
}

async function serviceWithUser() {
  const user = {
    id: "usr_1",
    email: "ada@example.com",
    name: "Ada",
    role: Role.USER,
    passwordHash: await hashPassword("Abcdefghi1"),
  };
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    refreshToken: { create: jest.fn().mockResolvedValue({}) },
    passwordResetToken: { create: jest.fn().mockResolvedValue({}) },
  };
  const mail = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
  const jwt = new JwtService(jwtOptions());
  const service = new AuthService(prisma as never, jwt, mail as never);
  return { service, prisma, mail, jwt };
}

describe("AuthService token lifetimes", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = "unit-test-secret";
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("LOGIN-01 U-AUTH-08: the access token issued at sign-in expires exactly 15 minutes after it is issued", async () => {
    const { service, jwt } = await serviceWithUser();
    pinClock();

    const { accessToken } = await service.login({ email: "ada@example.com", password: "Abcdefghi1" });
    const payload = jwt.decode(accessToken) as { iat: number; exp: number };

    expect(payload.iat * 1000).toBe(NOW.getTime());
    expect(payload.exp * 1000).toBe(NOW.getTime() + 15 * MINUTE);
  });

  it("LOGIN-01 U-AUTH-09: the refresh token issued at sign-in is stored to expire exactly 30 days later", async () => {
    const { service, prisma } = await serviceWithUser();
    pinClock();

    await service.login({ email: "ada@example.com", password: "Abcdefghi1" });

    const { expiresAt } = prisma.refreshToken.create.mock.calls[0][0].data;
    expect(expiresAt.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it("PWD-01 U-AUTH-10: a password-reset token is stored to expire exactly 15 minutes after it is issued", async () => {
    const { service, prisma } = await serviceWithUser();
    pinClock();

    await service.requestPasswordReset("ada@example.com");

    const { expiresAt } = prisma.passwordResetToken.create.mock.calls[0][0].data;
    expect(expiresAt.getTime()).toBe(NOW.getTime() + 15 * MINUTE);
  });
});

describe("password hashing", () => {
  it("REG-05 U-AUTH-06: hashing the same password twice gives two different salted hashes, both of which verify", async () => {
    const first = await hashPassword("Abcdefghi1");
    const second = await hashPassword("Abcdefghi1");

    expect(first).not.toBe("Abcdefghi1");
    expect(first).not.toContain("Abcdefghi1");
    expect(first).not.toBe(second);
    expect(await verifyPassword("Abcdefghi1", first)).toBe(true);
    expect(await verifyPassword("Abcdefghi1", second)).toBe(true);
  });
});
