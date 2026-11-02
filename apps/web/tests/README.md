# Component tests

Same layering as the other suites (see `e2e/docs/architecture.md`), sized
for components rendered without a server:

```
tests/
├── support/api-stub.ts   stubbed fetch that records every call · canned responses
├── data/builders.ts      payloads: profile, products, catalogue page, cart lines
├── utils/ids.ts          withIds for table-driven cases
├── <area>/*.test.tsx     auth · profile · catalogue · cart · home · cross-cutting
└── setup.ts              cleanup after every test, matchMedia for jsdom
```

Every test unmounts what it rendered and restores stubbed globals, so no
case depends on another. Queries go by role and label, never test ids.

```bash
pnpm --filter @school/web test
```
