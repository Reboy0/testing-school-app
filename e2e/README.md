# Browser tests (@school/e2e)

Playwright suite built to `docs/architecture.md` and `docs/strategy.md`.

```
e2e/
├── app/                       Page Object Model
│   ├── pageHolder.ts          PageHolder, Component
│   ├── abstractClasses.ts     AppPage (path, expectLoaded, header, form conventions)
│   ├── declaration/           LoadableComponent
│   ├── component/             Header, ProductBrowser (shared by / and /catalogue)
│   ├── page/                  Home, Register, SignIn, ForgotPassword, ResetPassword, Profile, Catalogue, Cart
│   └── index.ts               Application facade
├── fixture/test.ts            db (worker) · api · testData · createdUser · app (signed in via API) · unauthorizedUserApp
├── api/index.ts               ApiClient over a Playwright request context
├── db/index.ts                pg pool, fingerprint, cleanup and assertion queries
├── data/                      Seeded products and reference values
├── utils/                     Maildev, axe/keyboard, theme, ids, faker users
├── tests/<feature>/*.spec.ts  One spec per feature area
├── env.ts                     dotenv + envalid — fails fast on a missing variable
└── tags.ts                    Tag.Smoke
```

Every case leaves the database exactly as it found it: the fixture deletes
the accounts and guest carts the case created and then compares a
fingerprint of every table with the one taken before the case. That check
is why the suite runs on one worker (see playwright.config.ts).

```bash
cp .env.example .env          # once
pnpm --filter @school/e2e test          # full suite, Chromium
pnpm --filter @school/e2e test:smoke    # @Smoke subset
pnpm --filter @school/e2e ui            # headed, interactive
```

The API (:4000), the web app (:3000), Postgres with seed data and Maildev
must be running.
