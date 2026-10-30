/**
 * OpenCards suite «API» (prefix API): the contract of every /auth endpoint,
 * one case per behaviour, API-01 … API-15. These run alongside the
 * feature-level A-AUTH cases in test/plan-auth.e2e-spec.ts.
 */
import request from "supertest";
import { hashToken } from "../../src/common/token.util";
import { clearMail, createUser, latestResetToken } from "../factories";
import { attributesOf, cookiePair, cookieValue, expectErrorContract, maxAgeOf, setCookie, setCookies } from "../plan-helpers";
import { createTestApp, TestApp } from "../setup";

const PASSWORD = "Password123!";

describe("API suite: /auth", () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    await clearMail();
    await app.prisma.user.deleteMany();
    await createUser(app.prisma, { id: "usr_sam", email: "sam@example.com", password: PASSWORD });
  });

  const post = (path: string, body?: object, cookies: string[] = []) =>
    request(app.server).post(path).set("Cookie", cookies).send(body ?? {});

  describe("POST /auth/register", () => {
    it("API-01: answers 201 with the new id, stores the account, and sets HttpOnly access and refresh cookies", async () => {
      const res = await post("/auth/register", { email: "ada@example.com", name: "Ada", password: "Abcdefghi1" }).expect(201);

      expect(Object.keys(res.body)).toEqual(["id"]);
      expect(await app.prisma.user.findUnique({ where: { id: res.body.id } })).toMatchObject({ email: "ada@example.com", name: "Ada" });
      expect(setCookie(res, "access_token")).toMatch(/HttpOnly/i);
      expect(setCookie(res, "refresh_token")).toMatch(/HttpOnly/i);
    });

    it("API-02: an empty body answers 400 VALIDATION_FAILED with an error for email, name and password", async () => {
      const res = await post("/auth/register", {}).expect(400);

      expectErrorContract(res.body);
      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["email", "name", "password"]);
    });

    it("API-03: an email that is already registered answers 409 EMAIL_TAKEN and creates nothing", async () => {
      const res = await post("/auth/register", { email: "sam@example.com", name: "Sam", password: "Abcdefghi1" }).expect(409);

      expect(res.body).toEqual({ code: "EMAIL_TAKEN", message: "That email is already registered", fieldErrors: null });
      expect(await app.prisma.user.count()).toBe(1);
    });
  });

  describe("POST /auth/login", () => {
    it("API-04: valid credentials answer 200 with no body and set a 15-minute access cookie and a 30-day refresh cookie", async () => {
      const res = await post("/auth/login", { email: "sam@example.com", password: PASSWORD }).expect(200);

      expect(res.text).toBe("");
      expect(maxAgeOf(setCookie(res, "access_token"))).toBe(900);
      expect(maxAgeOf(setCookie(res, "refresh_token"))).toBe(2592000);
    });

    it("API-05: a wrong password and an unknown email both answer 401 with the same body", async () => {
      const wrong = await post("/auth/login", { email: "sam@example.com", password: "WrongPassword1" });
      const unknown = await post("/auth/login", { email: "nobody@example.com", password: "WrongPassword1" });

      expect([wrong.status, unknown.status]).toEqual([401, 401]);
      expect(unknown.body).toEqual(wrong.body);
    });

    it("API-06: a body without a valid email or a password answers 400 against both fields", async () => {
      const res = await post("/auth/login", { email: "sam" }).expect(400);

      expect(res.body.code).toBe("VALIDATION_FAILED");
      expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["email", "password"]);
    });
  });

  describe("POST /auth/refresh", () => {
    it("API-07: a valid refresh cookie answers 200, issues new access and refresh cookies, and revokes the old token", async () => {
      const login = await post("/auth/login", { email: "sam@example.com", password: PASSWORD }).expect(200);
      const old = cookieValue(login, "refresh_token");

      const res = await post("/auth/refresh", {}, [cookiePair(login, "refresh_token")]).expect(200);

      expect(setCookie(res, "access_token")).toBeDefined();
      expect(cookieValue(res, "refresh_token")).not.toBe(old);
      const stored = await app.prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashToken(old) } });
      expect(stored.revokedAt).not.toBeNull();
    });

    it("API-08: no cookie, an unknown token and a revoked token each answer 401 INVALID_SESSION", async () => {
      const login = await post("/auth/login", { email: "sam@example.com", password: PASSWORD }).expect(200);
      const revoked = [cookiePair(login, "refresh_token")];
      await post("/auth/refresh", {}, revoked).expect(200);

      for (const cookies of [[], ["refresh_token=unknown"], revoked]) {
        const res = await post("/auth/refresh", {}, cookies).expect(401);
        expect(res.body.code).toBe("INVALID_SESSION");
      }
    });
  });

  describe("POST /auth/logout", () => {
    it("API-09: answers 204, clears both cookies with their original attributes, and revokes the refresh token", async () => {
      const login = await post("/auth/login", { email: "sam@example.com", password: PASSWORD }).expect(200);

      const res = await post("/auth/logout", {}, setCookies(login)).expect(204);

      for (const name of ["access_token", "refresh_token"]) {
        expect(setCookie(res, name)).toMatch(new RegExp(`^${name}=;`));
        expect(attributesOf(setCookie(res, name))).toEqual(attributesOf(setCookie(login, name)));
      }
      const stored = await app.prisma.refreshToken.findUniqueOrThrow({
        where: { tokenHash: hashToken(cookieValue(login, "refresh_token")) },
      });
      expect(stored.revokedAt).not.toBeNull();
    });

    it("API-10: without any session it still answers 204 and clears the cookies", async () => {
      const res = await post("/auth/logout").expect(204);

      expect(setCookie(res, "access_token")).toMatch(/^access_token=;/);
      expect(setCookie(res, "refresh_token")).toMatch(/^refresh_token=;/);
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("API-11: answers 202 with the same empty body for a registered and an unregistered address", async () => {
      const known = await post("/auth/forgot-password", { email: "sam@example.com" }).expect(202);
      const unknown = await post("/auth/forgot-password", { email: "nobody@example.com" }).expect(202);

      expect(known.text).toBe("");
      expect(unknown.text).toBe(known.text);
      expect(await app.prisma.passwordResetToken.count()).toBe(1);
    });

    it("API-12: an invalid email answers 400 against email", async () => {
      const res = await post("/auth/forgot-password", { email: "sam" }).expect(400);

      expect(res.body.fieldErrors).toEqual({ email: ["Enter a valid email address"] });
    });
  });

  describe("POST /auth/reset-password", () => {
    async function issuedToken() {
      await post("/auth/forgot-password", { email: "sam@example.com" }).expect(202);
      return latestResetToken();
    }

    it("API-13: a valid token and password answer 204 and the new password signs in", async () => {
      const res = await post("/auth/reset-password", { token: await issuedToken(), password: "BrandNewPass1" }).expect(204);

      expect(res.text).toBe("");
      await post("/auth/login", { email: "sam@example.com", password: "BrandNewPass1" }).expect(200);
    });

    it("API-14: an unknown token, and a token that was already used, answer 400 INVALID_TOKEN", async () => {
      const unknown = await post("/auth/reset-password", { token: "f".repeat(64), password: "BrandNewPass1" }).expect(400);
      expect(unknown.body.code).toBe("INVALID_TOKEN");

      const token = await issuedToken();
      await post("/auth/reset-password", { token, password: "BrandNewPass1" }).expect(204);
      const reused = await post("/auth/reset-password", { token, password: "OtherNewPass2" });
      expect(reused.status).toBe(400);
      expect(reused.body.code).toBe("INVALID_TOKEN");
    });

    it("API-15: a missing token or a weak password answers 400 against that field", async () => {
      const res = await post("/auth/reset-password", { token: "", password: "weak" }).expect(400);

      expect(Object.keys(res.body.fieldErrors).sort()).toEqual(["password", "token"]);
    });
  });
});
