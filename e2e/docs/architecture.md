# Architecture

Framework architecture for the Clubs-AI test automation monorepo, with code examples from the actual codebase.

---

## Monorepo Layout

```
test-automation/
├── admin-panel-testing/
│   └── e2e/
│       ├── app/                    # Page Object Model
│       │   ├── abstractClasses.ts  # PageHolder, AppPage
│       │   ├── declaration/        # Interfaces (LoadableComponent)
│       │   ├── index.ts            # Application facade
│       │   └── page/               # Concrete page objects
│       ├── fixture/test.ts         # Custom Playwright fixtures
│       ├── api/index.ts            # API client init
│       ├── tests/                  # Test specs
│       ├── env.ts                  # Environment validation
│       ├── tags.ts                 # Test tags
│       └── playwright.config.ts
│
├── web-app-testing/
│   └── e2e/
│       ├── app/                    # Page Object Model (same pattern)
│       │   ├── abstractClasses.ts
│       │   ├── index.ts
│       │   └── page/
│       │       └── dashboards/     # Sub-feature grouping
│       ├── fixture/test.ts
│       ├── utils/                  # Redis helpers (OTP, reset password)
│       ├── data/                   # Test data constants
│       ├── shared/                 # Performance thresholds
│       ├── tests/
│       ├── env.ts
│       └── playwright.config.ts
│
├── packages/
│   ├── shared/                     # Types (User, UserRole), utilities
│   ├── db-client/                  # PostgreSQL pool + query functions
│   └── testing-api-client/         # Axios-based HTTP client
│
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Test Specs (.spec.ts)                  │
│  login.spec.ts · create-company.spec.ts · metrics.spec.ts   │
└──────────┬────────────────┬────────────────┬────────────────┘
           │                │                │
           ▼                ▼                ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────┐
│   Fixtures       │ │  API Client  │ │  DB Client   │
│  (test.ts)       │ │  (packages/) │ │  (packages/) │
│                  │ │              │ │              │
│  db (worker)     │ │  adminAuth() │ │  createDb()  │
│  apiAdmin (wrkr) │ │  createUser()│ │  deleteUser()│
│  app (test)      │ │  post/get/.. │ │  query()     │
│  createdUser     │ │              │ │              │
└───────┬──────────┘ └──────┬──────┘ └──────┬──────┘
        │                   │               │
        ▼                   ▼               ▼
┌──────────────────┐ ┌─────────────┐ ┌──────────────┐
│   Application    │ │   Backend   │ │  PostgreSQL   │
│  (Page Objects)  │ │   REST API  │ │  Database     │
│                  │ │             │ │              │
│  Home            │ └─────────────┘ └──────────────┘
│  SignIn / Auth   │
│  Users           │        ┌──────────────┐
│  Companies       │        │    Redis      │
│  Metrics         │        │  (OTP, keys)  │
│  Dashboards      │        └──────────────┘
│  Membership      │
└───────┬──────────┘
        │
        ▼
┌──────────────────┐
│  Playwright Page │
│  (Browser)       │
└──────────────────┘
```

---

## Key Abstractions

### Base Classes

Both projects share the same inheritance chain:

```typescript
// app/abstractClasses.ts

abstract class PageHolder {
  constructor(protected readonly page: Page) {}
}

abstract class AppPage extends PageHolder {
  abstract expectLoaded(message?: string): Promise<void>;
}
```

- `PageHolder` — holds the Playwright `Page` instance, base for all classes that interact with the browser
- `AppPage` — adds the contract that every page must implement `expectLoaded()` to verify successful navigation

The web-app variant also includes shared UI elements:

```typescript
// web-app-testing/e2e/app/abstractClasses.ts

abstract class AppPage extends PageHolder {
  abstract expectLoaded(message?: string): Promise<void>;

  protected readonly continueBtn = this.page.getByTestId('continue');
  private readonly backBtn = this.page.getByTestId('btn-back');

  async goBack() {
    await this.backBtn.click();
  }
}
```

### Application Facade

Each project has an `Application` class that composes all page objects:

```typescript
// admin-panel-testing/e2e/app/index.ts

class Application extends PageHolder {
  home = new Home(this.page);
  signIn = new SignIn(this.page);
  users = new Users(this.page);
  companies = new Companies(this.page);
}
```

```typescript
// web-app-testing/e2e/app/index.ts

class Application extends PageHolder {
  home = new Home(this.page);
  auth = new Auth(this.page);
  metrics = new Metrics(this.page);
  mainDashboardsPage = new MainDashboardsPage(this.page);
  fullFinancialKpiDashboard = new FullFinancialKpiDashboard(this.page);
  membership = new Membership(this.page);
}
```

Tests access pages via the `Application` instance: `app.companies.open()`, `app.auth.fillEmail()`.

---

## Page Object Example

A concrete page object encapsulates locators as private fields and exposes semantic methods:

```typescript
// admin-panel-testing/e2e/app/page/companies.page.ts

class Companies extends AppPage {
  // --- Locators (private) ---
  private readonly companiesTab = this.page.getByTestId('Companies');
  private readonly createCompanyBtn = this.page.getByTestId('create-company');
  private readonly companySearch = this.page.getByTestId('company-search');
  private readonly companyNameInput = this.page.getByTestId('company-name-input');
  private readonly submitBtn = this.page.getByTestId('submit');

  // --- Navigation ---
  async open() {
    await this.companiesTab.click();
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/companies/);
  }

  // --- Actions ---
  async fillCompanyName(name: string) {
    await this.companyNameInput.fill(name);
  }

  async submitForm() {
    await this.submitBtn.click();
  }

  // --- Assertions ---
  async expectCompanyRowVisible(id: string) {
    await expect(this.companyRow(id)).toBeVisible();
  }

  // --- API response interception ---
  async expectApiCreateCompanySuccess() {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (res) => /\/companies\b/i.test(res.url()) && res.request().method() === 'POST',
      ),
      this.submitForm(),
    ]);
    expect(response.ok()).toBeTruthy();
  }

  // --- Polling-based search stabilization ---
  async waitForSearchResults(searchValue: string, expectedId: string) {
    await expect.poll(async () => {
      const count = await this.companyRow(expectedId).count();
      return count >= 1 ? 'ready' : 'waiting';
    }).toBe('ready');
  }
}
```

**Key patterns:**
- Locators as private `readonly` fields initialized in the class body
- `expectLoaded()` required by `AppPage` base class
- `expectApi*()` methods combine `waitForResponse()` + `submitForm()` in `Promise.all()`
- `waitForSearchResults()` uses `expect.poll()` for eventual consistency

---

## Fixture Architecture

### Worker-Scoped vs Test-Scoped

```
Worker (1 per CPU core)
├── db: Db                        ← created once, shared across all tests in worker
├── apiAdmin: ApiClient           ← authenticated once, reused
│
├── Test 1
│   ├── app: Application          ← fresh authenticated browser per test
│   └── createdUser: User         ← unique user, cleaned up after test
│
├── Test 2
│   ├── app: Application
│   └── createdUser: User
│
└── ... (pool closes after all tests)
```

### Admin Panel Fixture (Simplified)

```typescript
// admin-panel-testing/e2e/fixture/test.ts

const test = playwrightTest.extend<
  { app: Application; unauthorizedUserApp: Application },
  { db: Db; apiAdmin: ApiClient }
>({
  // Worker-scoped: DB connection pool
  db: [async ({}, use, workerInfo) => {
    const db = createDb();
    await db.ping(); // health check
    await use(db);
    await db.close(); // cleanup
  }, { scope: 'worker' }],

  // Worker-scoped: authenticated API client
  apiAdmin: [async ({}, use) => {
    const client = new ApiClient({ baseURL: env.API_URL });
    const auth = await adminAuth(client, {
      email: env.SUPER_ADMIN_EMAIL,
      password: env.SUPER_ADMIN_PASSWORD,
    });
    client.setToken(auth.accessToken);
    await use(client);
  }, { scope: 'worker' }],

  // Test-scoped: authenticated browser session
  app: async ({ page, context }, use) => {
    const app = new Application(page);
    const { accessToken, user } = await api.post('auth/sign-in', { ... });

    await context.addCookies([{ name: 'auth_token', value: accessToken, ... }]);
    await page.addInitScript((u) => {
      window.sessionStorage.setItem('auth.user', u);
    }, JSON.stringify(user));

    await app.home.open();
    await use(app);
  },
});
```

### Web App Fixture (with OTP + User Creation)

```typescript
// web-app-testing/e2e/fixture/test.ts

// Additional test-scoped fixture: creates a unique user per test
createdUser: async ({ db, apiAdmin }, use) => {
  const user: User = {
    email: faker.internet.email().toLowerCase(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    password: generateStrongPassword(),
    role: UserRole.Editor,
    companyId: await getCompanyIdByName(db, COMPANY_1_NAME),
  };
  await createUser(apiAdmin, user);
  await use(user);
  await deleteUser(db, user.email); // cleanup
},

// App fixture with OTP flow
app: async ({ page, context, createdUser }, use) => {
  const pages = new Application(page);
  const client = new ApiClient({ baseURL: env.API_URL });

  await clearOtpForEmail(createdUser.email);

  // Step 1: Sign in
  const signIn = await client.post('auth/sign-in', {
    email: createdUser.email,
    password: createdUser.password,
  });

  // Step 2: Get OTP from Redis
  const otp = (await waitForOtpCode(createdUser.email)).value;

  // Step 3: Verify OTP
  const verify = await client.post('auth/otp/verify',
    { otp },
    { token: signIn.accessToken },
  );

  // Step 4: Set cookies + session
  await context.addCookies([
    buildCookie('access_token', verify.accessToken),
    buildCookie('refresh_token', verify.refreshToken),
  ]);
  await page.addInitScript((u) => {
    window.sessionStorage.setItem('auth.user', u);
  }, JSON.stringify(verify.user));

  await page.goto('/');
  await use({ pages, apiClient });
},
```

---

## Test Example

End-to-end test combining UI actions, API interception, DB verification, and cleanup:

```typescript
// admin-panel-testing/e2e/tests/companies/create-company.spec.ts

test.describe('Companies / Create', () => {
  const createdCompanies: string[] = [];

  test.beforeEach(async ({ app: { companies } }) => {
    await companies.open();
    await companies.openCreateCompany();
  });

  test.afterEach(async ({ db }) => {
    for (const name of createdCompanies.splice(0)) {
      await deleteCompanyByName(db, name);
    }
  });

  test('create company with address', async ({ app: { companies }, db }) => {
    const name = `QA Company ${faker.string.alphanumeric(8)}`;
    const address = faker.location.streetAddress();

    // 1. UI: fill form
    await companies.fillCompanyName(name);
    await companies.fillCompanyAddress(address);

    // 2. API: intercept POST and assert success
    await companies.expectApiCreateCompanySuccess();
    createdCompanies.push(name);

    // 3. DB: poll until record appears
    await expect.poll(async () => {
      return await getCompanyByName(db, name);
    }).not.toBeNull();

    // 4. UI: verify in search results
    const company = (await getCompanyByName(db, name))!;
    await companies.searchCompany(name);
    await companies.waitForSearchResults(name, company.id);
    await companies.expectCompanyRowVisible(company.id);

    // 5. DB: verify persisted data
    expect(company.address ?? '').toBe(address);
  });
});
```

---

## Shared Packages

### `@local/shared`

Types and utilities shared across both test projects:

```typescript
enum UserRole { Admin = 'admin', Editor = 'editor', Viewer = 'viewer' }

interface User {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: UserRole;
  companyId: string;
}

function normalizeEmail(email: string): string;
```

### `@local/db-client`

PostgreSQL connection pool with typed query functions:

```typescript
interface Db {
  query<R>(sql: string, params?: unknown[]): Promise<R[]>;
  withClient(fn: (client) => Promise<T>): Promise<T>;
  withTransaction(fn: (client) => Promise<T>): Promise<T>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

// Query functions
function deleteUser(db: Db, email: string): Promise<void>;
function getCompanyByName(db: Db, name: string): Promise<Company | undefined>;
function getCompanyIdByName(db: Db, name: string): Promise<string>;
function selectFirstCompany(db: Db): Promise<Company>;
// ... more
```

### `@local/testing-api-client`

Axios-based HTTP client with authentication:

```typescript
class ApiClient {
  constructor(config: { baseURL: string });
  setToken(token: string): void;
  get<T>(url: string): Promise<T>;
  post<T>(url: string, data?: unknown, options?: { token?: string }): Promise<T>;
  patch<T>(url: string, data: unknown): Promise<T>;
  delete(url: string): Promise<void>;
}

// Request functions
function adminAuth(client: ApiClient, credentials): Promise<{ accessToken: string }>;
function createUser(client: ApiClient, user: User): Promise<User>;
function createCompany(client: ApiClient, data): Promise<Company>;
```

---

## Configuration

### Playwright Config Pattern

Both projects follow the same configuration pattern:

```typescript
// playwright.config.ts

const CPU = os.cpus()?.length ?? 2;
const WORKERS = env.CI
  ? Math.min(3, CPU)
  : Math.max(1, Math.min(6, CPU - 1));

const projectsAll = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
];

// Generate smoke variants from base projects
const projects = [
  ...projectsAll,
  ...projectsAll.map((p) => ({
    ...p,
    name: `smoke-${p.name}`,
    grep: new RegExp(Tag.Smoke),
  })),
];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: env.CI ? 2 : 0,
  workers: WORKERS,
  reporter: [['list'], ['html'], ['junit']],
  use: {
    baseURL: env.BASE_URL_ADMIN, // or env.BASE_URL_WEB
    trace: env.CI ? 'on-first-retry' : 'retain-on-failure',
    video: env.CI ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects,
});
```

### Environment Validation

```typescript
// env.ts (envalid)

export const env = cleanEnv(process.env, {
  BASE_URL_ADMIN: url(),          // Admin Panel only
  BASE_URL_WEB: url(),            // Web App only
  API_URL: url(),
  CI: bool({ default: false }),
  SUPER_ADMIN_EMAIL: str(),
  SUPER_ADMIN_PASSWORD: str(),
  // ... Redis vars for Web App
});
```

Tests fail immediately if required variables are missing — no silent fallbacks.
