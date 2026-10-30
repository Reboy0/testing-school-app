/**
 * API cases A-AUTH-01 … A-AUTH-26 from docs/test-plan.md §6.1. Each test
 * title starts with its plan id.
 */
import { JwtService } from "@nestjs/jwt";
import request from "supertest";
import { verifyPassword } from "../src/common/crypto.util";
import { generateToken, hashToken } from "../src/common/token.util";
import { clearMail, createUser, latestResetToken, loginAs } from "./factories";
import { attributesOf, cookiePair, cookieValue, expectErrorContract, maxAgeOf, setCookie, setCookies, wait } from "./plan-helpers";
import { createTestApp, TestApp } from "./setup";

const MAILDEV_URL = process.env.MAILDEV_URL ?? "http://localhost:1080";
const PASSWORD = "Password123!";
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

describe("authentication API (A-AUTH)", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await clearMail();
    await app.prisma.user.deleteMany();
  });

  const register = (body: Record<string, unknown>) => request(app.server).post("/auth/register").send(body);
  const login = (email: string, password: string) => request(app.server).post("/auth/login").send({ email, password });
  const refresh = (cookies: string[]) => request(app.server).post("/auth/refresh").set("Cookie", cookies);
  const forgot = (email: string) => request(app.server).post("/auth/forgot-password").send({ email });
  const reset = (token: string, password: string) =>
    request(app.server).post("/auth/reset-password").send({ token, password });

  const refreshCookie = (res: request.Response) => [cookiePair(res, "refresh_token")];

  async function issueResetToken(email: string): Promise<string> {
    await forgot(email).expect(202);
    return latestResetToken();
  }

  describe("registration", () => {
    const body = { email: "new@example.com", name: "New User", password: "Abcdefghi1" };

    it("REG-01 A-AUTH-01: registering with valid details answers 201 with the new account and sets both session cookies", async () => {
      const res = await register(body).expect(201);

      const user = await app.prisma.user.findUniqueOrThrow({ where: { email: body.email } });
      expect(res.body.id).toBe(user.id);
      expect(user.name).toBe("New User");
      expect(setCookie(res, "access_token")).toBeDefined();
      expect(setCookie(res, "refresh_token")).toBeDefined();
    });

    it("REG-02 A-AUTH-02: a password of exactly 10 characters is accepted and one of 9 is rejected against password", async () => {
      await register({ ...body, password: "Abcdefghi1" }).expect(201);

      const res = await register({ ...body, email: "nine@example.com", password: "Abcdefgh1" }).expect(400);
      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(res.body.fieldErrors.password).toEqual(["Password must be at least 10 characters"]);
    });

    it("REG-02 A-AUTH-03: a password breaking several rules reports every one of them against password", async () => {
      const res = await register({ ...body, password: "abc" }).expect(400);

      expect(res.body.fieldErrors.password).toEqual(
        expect.arrayContaining([
          "Password must be at least 10 characters",
          "Password must contain an uppercase letter",
          "Password must contain a digit",
        ]),
      );
      expect(res.body.fieldErrors.password).toHaveLength(3);
    });

    it("REG-04 A-AUTH-04: registering an email that already exists answers 409, in the same case or in another", async () => {
      await register(body).expect(201);

      const same = await register(body).expect(409);
      expect(same.body.code).toBe("EMAIL_TAKEN");

      await register({ ...body, email: "NEW@Example.com" }).expect(409);
      expect(await app.prisma.user.count()).toBe(1);
    });
  });

  describe("passwords", () => {
    it("REG-05 A-AUTH-05: no response from register, login, GET /users/me, GET /users/:id or PATCH /users/me carries the password or its hash", async () => {
      const registered = await register({ email: "ada@example.com", name: "Ada", password: "Abcdefghi1" }).expect(201);
      const { passwordHash } = await app.prisma.user.findUniqueOrThrow({ where: { email: "ada@example.com" } });
      const signedIn = await login("ada@example.com", "Abcdefghi1").expect(200);
      const cookies = setCookies(signedIn);

      const responses = [
        registered,
        signedIn,
        await request(app.server).get("/users/me").set("Cookie", cookies).expect(200),
        await request(app.server).get(`/users/${registered.body.id}`).set("Cookie", cookies).expect(200),
        await request(app.server).patch("/users/me").set("Cookie", cookies).send({ name: "Ada L." }).expect(200),
      ];

      for (const res of responses) {
        expect(res.text).not.toContain("Abcdefghi1");
        expect(res.text).not.toContain(passwordHash);
        expect(res.text.toLowerCase()).not.toContain("password");
      }
    });

    it("REG-05 A-AUTH-06: the stored user record holds a hash of the password, never the password itself", async () => {
      await register({ email: "ada@example.com", name: "Ada", password: "Abcdefghi1" }).expect(201);

      const { passwordHash } = await app.prisma.user.findUniqueOrThrow({ where: { email: "ada@example.com" } });
      expect(passwordHash).not.toBe("Abcdefghi1");
      expect(passwordHash).not.toContain("Abcdefghi1");
      expect(await verifyPassword("Abcdefghi1", passwordHash)).toBe(true);
    });
  });

  describe("sign-in", () => {
    beforeEach(() => createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: PASSWORD }));

    it("LOGIN-01 A-AUTH-07: signing in answers 200 with two HttpOnly cookies that live about 15 minutes and 30 days", async () => {
      const res = await login("sam@example.com", PASSWORD).expect(200);

      const access = setCookie(res, "access_token");
      const refreshToken = setCookie(res, "refresh_token");
      expect(access).toMatch(/;\s*HttpOnly/i);
      expect(refreshToken).toMatch(/;\s*HttpOnly/i);
      expect(maxAgeOf(access)).toBe(15 * 60);
      expect(maxAgeOf(refreshToken)).toBe(30 * 24 * 60 * 60);
    });

    it("LOGIN-01 A-AUTH-08: the access cookie from sign-in opens GET /users/me", async () => {
      const { cookies } = await loginAs(app, "sam@example.com", PASSWORD);

      const res = await request(app.server).get("/users/me").set("Cookie", cookies).expect(200);
      expect(res.body.id).toBe("usr_sam");
    });

    it("LOGIN-02 A-AUTH-09: an access token past its expiry is refused with 401", async () => {
      const jwt = new JwtService({ secret: process.env.JWT_SECRET });
      const expired = jwt.sign({ sub: "usr_sam", role: "USER", exp: Math.floor(Date.now() / 1000) - 60 });

      const res = await request(app.server).get("/users/me").set("Cookie", [`access_token=${expired}`]).expect(401);
      expectErrorContract(res.body);
    });

    it("LOGIN-03 A-AUTH-10: a wrong password for a known email and an unknown email both answer 401 with byte-identical bodies", async () => {
      const wrongPassword = await login("sam@example.com", "WrongPassword1");
      const unknownEmail = await login("nobody@example.com", "WrongPassword1");

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.text).toBe(wrongPassword.text);
    });

    it("LOGIN-03 A-AUTH-11: signing in with an empty or invalid body answers 400 in the error contract", async () => {
      const empty = await request(app.server).post("/auth/login").send({}).expect(400);
      expectErrorContract(empty.body);
      expect(Object.keys(empty.body.fieldErrors).sort()).toEqual(["email", "password"]);

      const invalid = await request(app.server).post("/auth/login").send({ email: "not-an-email", password: "" }).expect(400);
      expect(invalid.body.code).toBe("VALIDATION_FAILED");
      expect(Object.keys(invalid.body.fieldErrors).sort()).toEqual(["email", "password"]);
    });
  });

  describe("session refresh", () => {
    beforeEach(() => createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: PASSWORD }));

    it("LOGIN-04 A-AUTH-12: refreshing with a valid refresh token answers 200 with a different refresh token", async () => {
      const signedIn = await login("sam@example.com", PASSWORD).expect(200);

      const refreshed = await refresh(refreshCookie(signedIn)).expect(200);
      expect(cookieValue(refreshed, "refresh_token")).not.toBe(cookieValue(signedIn, "refresh_token"));
      expect(setCookie(refreshed, "access_token")).toBeDefined();
    });

    it("LOGIN-04 A-AUTH-13: refreshing again with the token that was just rotated answers 401", async () => {
      const signedIn = await login("sam@example.com", PASSWORD).expect(200);
      await refresh(refreshCookie(signedIn)).expect(200);

      await refresh(refreshCookie(signedIn)).expect(401);
    });

    it("LOGIN-04 A-AUTH-14: a refresh token presented after its 30 days are up answers 401", async () => {
      const signedIn = await login("sam@example.com", PASSWORD).expect(200);
      // Thirty days and a minute pass: move the stored expiry back by that much.
      const row = await app.prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashToken(cookieValue(signedIn, "refresh_token")) },
      });
      await app.prisma.refreshToken.update({
        where: { id: row.id },
        data: { expiresAt: new Date(row.expiresAt.getTime() - 30 * DAY - MINUTE) },
      });

      await refresh(refreshCookie(signedIn)).expect(401);
    });

    it("LOGIN-04 A-AUTH-15: an unknown refresh token and no refresh cookie at all both answer 401", async () => {
      const unknown = await refresh([`refresh_token=${generateToken()}`]).expect(401);
      expectErrorContract(unknown.body);

      const none = await request(app.server).post("/auth/refresh").expect(401);
      expectErrorContract(none.body);
    });
  });

  describe("password reset", () => {
    beforeEach(() => createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: PASSWORD }));

    it("PWD-01 A-AUTH-16: forgot-password → token from the Maildev email → reset-password changes the password", async () => {
      const token = await issueResetToken("sam@example.com");

      await reset(token, "BrandNewPass1").expect(204);

      await login("sam@example.com", PASSWORD).expect(401);
      await login("sam@example.com", "BrandNewPass1").expect(200);
    });

    it("PWD-02 A-AUTH-17: a reset token that has been used once is refused the second time, and the password stays as first set", async () => {
      const token = await issueResetToken("sam@example.com");
      await reset(token, "BrandNewPass1").expect(204);

      const second = await reset(token, "SecondNewPass2");
      expect(second.status).toBe(400);
      expectErrorContract(second.body);

      await login("sam@example.com", "SecondNewPass2").expect(401);
      await login("sam@example.com", "BrandNewPass1").expect(200);
    });

    it("PWD-02 A-AUTH-18: a reset token redeemed more than 15 minutes after it was issued is refused", async () => {
      const token = await issueResetToken("sam@example.com");
      // Sixteen minutes pass: move the stored expiry back by that much.
      const row = await app.prisma.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hashToken(token) } });
      await app.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { expiresAt: new Date(row.expiresAt.getTime() - 16 * MINUTE) },
      });

      expect((await reset(token, "BrandNewPass1")).status).toBe(400);
      await login("sam@example.com", PASSWORD).expect(200);
    });

    it("PWD-02 A-AUTH-19: a reset token that was never issued is refused", async () => {
      const res = await reset(generateToken(), "BrandNewPass1").expect(400);

      expect(res.body.code).toBe("INVALID_TOKEN");
      await login("sam@example.com", PASSWORD).expect(200);
    });

    it("PWD-03 A-AUTH-20: redeeming a reset token ends every other session: refresh from each one answers 401", async () => {
      const first = await login("sam@example.com", PASSWORD).expect(200);
      const second = await login("sam@example.com", PASSWORD).expect(200);

      await reset(await issueResetToken("sam@example.com"), "BrandNewPass1").expect(204);

      await refresh(refreshCookie(first)).expect(401);
      await refresh(refreshCookie(second)).expect(401);
    });

    it("PWD-04 A-AUTH-21: a new password that breaks the AUTH-01 rules is refused against password", async () => {
      const token = await issueResetToken("sam@example.com");

      const res = await reset(token, "weak").expect(400);
      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(res.body.fieldErrors.password.length).toBeGreaterThan(0);
      await login("sam@example.com", PASSWORD).expect(200);
    });

    it("PWD-05 A-AUTH-24: forgot-password answers 202 with the same body for a registered and an unregistered address, and sends nothing for the unregistered one", async () => {
      const unknown = await forgot("nobody@example.com").expect(202);
      await wait(500);
      expect(await app.prisma.passwordResetToken.count()).toBe(0);
      const inbox = (await (await fetch(`${MAILDEV_URL}/email`)).json()) as unknown[];
      expect(inbox).toHaveLength(0);

      const known = await forgot("sam@example.com").expect(202);
      expect(known.text).toBe(unknown.text);
      expect(await app.prisma.passwordResetToken.count()).toBe(1);
    });

    it("PWD-06 A-AUTH-25: forgot-password with an invalid email answers 400 against email", async () => {
      const res = await forgot("not-an-email").expect(400);

      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(res.body.fieldErrors.email).toEqual(["Enter a valid email address"]);
    });
  });

  describe("sign-out", () => {
    beforeEach(() => createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: PASSWORD }));

    it("LOGIN-06 A-AUTH-22: signing out answers 204 and clears both cookies with the attributes they were set with", async () => {
      const signedIn = await login("sam@example.com", PASSWORD).expect(200);

      const res = await request(app.server).post("/auth/logout").set("Cookie", setCookies(signedIn)).expect(204);

      for (const name of ["access_token", "refresh_token"]) {
        const cleared = setCookie(res, name);
        expect(cleared).toMatch(new RegExp(`^${name}=;`));
        expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
        expect(attributesOf(cleared)).toEqual(attributesOf(setCookie(signedIn, name)));
      }
    });

    it("LOGIN-06 A-AUTH-23: a refresh token kept from before sign-out is refused afterwards, because the server revoked it", async () => {
      const signedIn = await login("sam@example.com", PASSWORD).expect(200);
      const kept = refreshCookie(signedIn);

      await request(app.server).post("/auth/logout").set("Cookie", setCookies(signedIn)).expect(204);

      await refresh(kept).expect(401);
    });
  });

  describe("protected endpoints", () => {
    beforeEach(() => createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: PASSWORD }));

    it("LOGIN-02 A-AUTH-26: without a cookie, with a forged JWT, or with a JWT signed by another key, protected endpoints answer 401", async () => {
      const otherKey = new JwtService({ secret: "not-the-server-secret" }).sign({ sub: "usr_sam", role: "USER" });
      const credentials: string[][] = [[], ["access_token=forged.jwt.value"], [`access_token=${otherKey}`]];
      const endpoints = [
        () => request(app.server).get("/users/me"),
        () => request(app.server).patch("/users/me").send({ name: "X" }),
        () => request(app.server).get("/users/me/addresses"),
        () => request(app.server).get("/users/usr_sam"),
      ];

      for (const cookies of credentials) {
        for (const endpoint of endpoints) {
          const res = await endpoint().set("Cookie", cookies);
          expect(res.status).toBe(401);
          expect(res.body.code).toBe("UNAUTHENTICATED");
        }
      }
    });
  });
});
