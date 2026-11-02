import type { TestApp } from "../fixture/app";

/**
 * Request functions built on the ApiClient: whole interactions a test needs
 * as a precondition rather than as the thing under test.
 */
export async function loginAs(
  app: TestApp,
  email: string,
  password: string,
): Promise<{ cookies: string[] }> {
  const res = await app.api.post("/auth/login").send({ email, password }).expect(200);
  return { cookies: (res.get("set-cookie") ?? []) as unknown as string[] };
}

