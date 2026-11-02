# API integration tests

Built to the same layering as the browser suite (see `e2e/docs/architecture.md`).

```
test/
├── client/        ApiClient (get/post/put/patch/delete, withCookies) · request functions (loginAs)
├── fixture/       app.ts (Nest app + api client) · seed.ts (rows a case needs) · isolation.ts
├── db/            db-helpers (fingerprint, reset) · isolated (create → act → remove → prove unchanged)
├── data/          faker builders for request bodies
├── utils/         cookies and the error contract · Maildev · withIds
├── specs/<area>/  auth · users · catalogue · cart · cross-cutting · db · validation
├── env.ts         envalid — fails fast on a missing variable
└── global-setup.ts, jest-e2e.json
```

Every case starts from and leaves behind an empty `school_test`
(`fixture/isolation.ts` truncates after each one); the db suite additionally
proves each case left the database byte-for-byte as it found it.

```bash
pnpm --filter @school/api test:e2e
```
