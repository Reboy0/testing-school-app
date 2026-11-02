import { test as playwrightTest, expect } from "@playwright/test";
import { ApiClient, type User } from "../api";
import { Application } from "../app";
import { createDb, deleteGuestCarts, deleteUsers, fingerprint, type Db } from "../db";
import { env } from "../env";
import { buildUser } from "../utils/user";

/** Accounts a case brings into being, so its teardown can delete them. */
export class TestData {
  readonly emails: string[] = [];

  /** A new, valid, not-yet-registered account, removed after the case. */
  user(tag = "user"): User {
    const user = buildUser(tag);
    this.emails.push(user.email);
    return user;
  }
}

interface TestFixtures {
  cleanDatabase: void;
  testData: TestData;
  api: ApiClient;
  createdUser: User;
  app: Application;
  unauthorizedUserApp: Application;
}

interface WorkerFixtures {
  db: Db;
}

export const test = playwrightTest.extend<TestFixtures, WorkerFixtures>({
  // Worker-scoped: one connection pool per worker, health-checked up front.
  db: [
    async ({}, use) => {
      const db = createDb(env.DATABASE_URL);
      await db.ping();
      await use(db);
      await db.close();
    },
    { scope: "worker" },
  ],

  testData: async ({}, use) => {
    await use(new TestData());
  },

  // Every case runs against the database the servers use, so each one
  // removes what it created — its accounts (sessions, reset tokens,
  // addresses and carts go with them) and the guest carts its browser and
  // API context started — and then proves the database is exactly what it
  // was before the case began.
  cleanDatabase: [
    async ({ db, testData, context, request }, use) => {
      const before = await fingerprint(db);

      await use();

      const cookies = [...(await context.cookies()), ...(await request.storageState()).cookies];
      await deleteGuestCarts(db, cookies.filter((cookie) => cookie.name === "cart_token").map((cookie) => cookie.value));
      await deleteUsers(db, testData.emails);
      expect(await fingerprint(db), "the case left the database different from how it found it").toEqual(before);
    },
    { auto: true },
  ],

  // The API through the test's own request context (not the browser's).
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },

  // A unique account registered through the API; the browser is untouched.
  createdUser: async ({ api, testData }, use) => {
    const user = testData.user("created");
    await api.register(user);
    await use(user);
  },

  // A browser already signed in as createdUser: the session comes from the
  // API, so only the cases about signing in go through the form.
  app: async ({ page, createdUser }, use) => {
    const app = new Application(page);
    await app.signInThroughApi(createdUser);
    await app.home.open();
    await use(app);
  },

  // A browser with no session, for sign-in pages, redirects and guest flows.
  unauthorizedUserApp: async ({ page }, use) => {
    await use(new Application(page));
  },
});

export { expect };
