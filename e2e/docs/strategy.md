# Test Strategy

General E2E testing strategy applicable to any web application project.

---

## Scope

Each project covers the critical user-facing flows of its application. Typical feature areas include:

| Feature Area | Example Coverage |
|---|---|
| Authentication | Login (with/without OTP/2FA), logout, session persistence, device memory |
| Password Management | Forgot password, reset flow, password strength validation |
| CRUD Entities | Create, edit, search, deactivate/restore, table views |
| Dashboards & Reports | Page loading, data display, performance thresholds |
| User Management | Roles, permissions, user creation and editing |

The exact scope depends on the application under test. Each feature area should have its own test spec file and a corresponding test case document in `docs/`.

---

## Test Levels

### E2E UI Tests (Primary)

All tests run through Playwright against real browser engines. Tests interact with the full application stack — frontend, backend API, database.

- **Multi-browser**: Chromium, Firefox, WebKit
- **Smoke subset**: tagged with `@Smoke`, runnable via dedicated `smoke-*` Playwright projects
- **Full regression**: all tests across all browsers

### API Verification (Within E2E)

Tests intercept and assert API responses during UI flows using `page.waitForResponse()`. This validates that the frontend sends correct requests and the backend responds successfully, without needing a separate API test suite.

Pattern: page object methods like `expectApiCreateSuccess()` combine `waitForResponse()` + form submission in `Promise.all()`.

### Database Assertions

Direct database queries verify that UI/API actions persist correctly. Wrapped in `expect.poll()` for eventual consistency — the test retries the query until the expected state appears or timeout.

### Performance Thresholds

Load time assertions ensure pages render within acceptable bounds. Thresholds are defined as constants (e.g. in `shared/constants.ts`) and asserted against actual navigation timing.

---

## Test Data Management

### Creation

| Method | When to Use |
|---|---|
| **API** (via `apiAdmin` fixture) | Seed entities before tests — users, companies, etc. |
| **faker.js** | Generate unique random data per test (names, emails, passwords) |
| **Fixtures** (`createdUser`, etc.) | Combine API creation + faker + auto-cleanup in one reusable unit |

### Cleanup

- **afterEach / afterAll**: DB-level deletion to remove created entities
- **Fixture teardown**: automatic cleanup when fixture scope ends
- **Cache clearing**: remove OTP codes, tokens, or other cached state between runs

### Isolation

- Each test gets its own user/data via test-scoped fixtures to avoid collisions in parallel runs
- Worker-scoped DB/API connections prevent pool exhaustion
- Test-scoped browser contexts ensure no state leaks between tests

---

## Authentication Strategy

### API-Based Auth Bypass (Most Tests)

Login is bypassed for non-auth tests via API-based session setup:
1. Authenticate via API to obtain access/refresh tokens
2. Inject tokens as cookies on the browser context
3. Store user data in `sessionStorage` via `addInitScript()`
4. Navigate to the starting page — tests begin already authenticated

This avoids repeating the full login flow in every test, saving time and reducing flakiness.

### OTP / 2FA Flows

When the application uses OTP or 2FA:
1. Sign in via API to trigger OTP generation
2. Fetch OTP from the backend's cache (e.g. Redis) using test utilities
3. Complete verification via API
4. Inject resulting tokens into the browser context

### Unauthorized State

A separate `unauthorizedUserApp` fixture provides an unauthenticated browser session for testing login pages, redirects, and access control.

---

## Execution Configuration

### Workers

- **CI**: limited to available CPUs (typically 2–3 workers)
- **Local**: scale up to available cores minus one, keeping the system responsive

### Retries

- **CI**: 2 retries to handle transient failures
- **Local**: 0 retries for fast feedback during development

### Artifacts

| Artifact | CI | Local |
|---|---|---|
| Trace | on-first-retry | retain-on-failure |
| Video | off | retain-on-failure |
| Screenshot | only-on-failure | only-on-failure |

### Reporters

- **list** — console output during run
- **html** — interactive report with screenshots, traces, logs
- **junit** — XML for CI integration and dashboards

---

## Environment Strategy

### Local Development

- `.env` file loaded via `dotenv`
- Validated with `envalid` — tests fail fast if required variables are missing
- Headed browser mode for debugging (e.g. `pnpm run ui`)

### CI

- Secrets injected via a secret manager (e.g. Infisical, Vault, GitHub Secrets)
- Headless mode enforced
- Smoke suite on PRs; full regression on main branch + nightly schedule
- Artifacts uploaded: HTML report, JUnit XML, traces/videos for failures

### Environment Variables

Each project defines its required env vars in an `env.ts` file using `envalid`:
- Base URL of the application under test
- API URL(s)
- Test credentials (admin, viewer, etc.)
- Database connection parameters
- Cache connection parameters (if applicable)
- CI flag for conditional behavior

---

## Tag-Based Filtering

```typescript
enum Tag {
  Smoke = '@Smoke',
}
```

Playwright config generates `smoke-*` projects that grep for tag patterns in test titles. This enables running subsets without maintaining separate test lists:

```bash
# Smoke tests only
npx playwright test --project 'smoke-chromium'

# Full suite
npx playwright test
```

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Flaky tests from async data | `expect.poll()` with DB/cache polling instead of arbitrary waits |
| Parallel test collisions | Unique test data per run (faker.js), isolated fixtures per test |
| OTP / token timing | Retry-based cache polling with configurable attempts and intervals |
| Environment misconfiguration | `envalid` schema validation on startup — fail fast |
| Stale browser state | Test-scoped browser contexts, `beforeEach` navigation resets |
| Slow test suite | Worker parallelism, smoke subset for PRs, full regression on schedule |
