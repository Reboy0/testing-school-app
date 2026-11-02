import request from "supertest";

/** Every Set-Cookie header on a response. */
export function setCookies(res: request.Response): string[] {
  return (res.get("set-cookie") ?? []) as unknown as string[];
}

/** The Set-Cookie header for one cookie, or undefined. */
export function setCookie(res: request.Response, name: string): string | undefined {
  return setCookies(res).find((cookie) => cookie.startsWith(`${name}=`));
}

/** `name=value` for one cookie a response set, ready to send back. */
export function cookiePair(res: request.Response, name: string): string {
  const cookie = setCookie(res, name);
  if (!cookie) throw new Error(`No ${name} cookie in ${JSON.stringify(setCookies(res))}`);
  return cookie.split(";")[0];
}

/** The value of one cookie a response set. */
export function cookieValue(res: request.Response, name: string): string {
  return cookiePair(res, name).slice(name.length + 1);
}

/** The Max-Age attribute of a Set-Cookie header, in seconds. */
export function maxAgeOf(cookie: string | undefined): number | undefined {
  const match = /;\s*Max-Age=(\d+)/i.exec(cookie ?? "");
  return match ? Number(match[1]) : undefined;
}

/** The attributes of a Set-Cookie header, lower-cased, without the value or the expiry. */
export function attributesOf(cookie: string | undefined): string[] {
  return (cookie ?? "")
    .split(";")
    .slice(1)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => !part.startsWith("expires=") && !part.startsWith("max-age="))
    .sort();
}

/** The error envelope every failure must come back in. */
export function expectErrorContract(body: unknown): void {
  const { code, message, fieldErrors } = body as Record<string, unknown>;
  expect(Object.keys(body as object).sort()).toEqual(["code", "fieldErrors", "message"]);
  expect(typeof code).toBe("string");
  expect(typeof message).toBe("string");
  expect(fieldErrors === null || typeof fieldErrors === "object").toBe(true);
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
