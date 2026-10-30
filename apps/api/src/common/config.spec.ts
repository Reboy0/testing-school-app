import { cookieSecurity, resolvePort } from "./config";

describe("resolvePort", () => {
  it("XC-024 U-CFG-01: uses the port the platform assigns", () => {
    expect(resolvePort({ PORT: "10000" })).toBe(10000);
  });

  it("XC-025 U-CFG-01: falls back to 4000 when no port is assigned", () => {
    expect(resolvePort({})).toBe(4000);
  });

  it("XC-026 U-CFG-01: falls back to 4000 when the assigned port is not a number", () => {
    expect(resolvePort({ PORT: "not-a-port" })).toBe(4000);
  });
});

describe("cookieSecurity", () => {
  it("LOGIN-003 U-AUTH-12: requires SameSite=None and Secure when the web app is on another site", () => {
    expect(cookieSecurity({ CROSS_SITE_COOKIES: "true" })).toEqual({
      sameSite: "none",
      secure: true,
    });
  });

  it("LOGIN-004 U-AUTH-12: keeps same-site, insecure cookies for local development over plain HTTP", () => {
    expect(cookieSecurity({})).toEqual({ sameSite: "lax", secure: false });
  });
});
