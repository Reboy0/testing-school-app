import type { Server } from "node:http";
import request from "supertest";

/**
 * A thin HTTP client for the app under test. Each call builds its request
 * when it is made — never ahead of time — and sends the session cookies the
 * client was created with, so `api.withCookies(sam).get("/users/me")` reads
 * as what it does. Every method returns supertest's chainable Test, so a
 * test can still `.send()`, `.set()` and `.expect()` on it.
 */
export class ApiClient {
  constructor(
    private readonly server: Server,
    private readonly cookies: readonly string[] = [],
  ) {}

  /** The same client, sending these cookies on every request. */
  withCookies(cookies: readonly string[]): ApiClient {
    return new ApiClient(this.server, cookies);
  }

  get(path: string) {
    return this.prepare(request(this.server).get(path));
  }

  post(path: string) {
    return this.prepare(request(this.server).post(path));
  }

  put(path: string) {
    return this.prepare(request(this.server).put(path));
  }

  patch(path: string) {
    return this.prepare(request(this.server).patch(path));
  }

  delete(path: string) {
    return this.prepare(request(this.server).delete(path));
  }

  private prepare(test: request.Test): request.Test {
    return this.cookies.length > 0 ? test.set("Cookie", [...this.cookies]) : test;
  }
}
