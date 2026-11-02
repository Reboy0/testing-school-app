import os from "node:os";
import { defineConfig, devices, type Project } from "@playwright/test";
import { env } from "./env";
import { Tag } from "./tags";

// Every case checks that it left the shared development database exactly as
// it found it (fixture/test.ts). That check compares the whole database, so
// two cases running at once would see each other's rows: workers stay at one
// until the suite moves to per-worker databases. E2E_WORKERS=<n> overrides it,
// and E2E_WORKERS=0 uses the CPU-based count the architecture describes.
const CPU = os.cpus()?.length ?? 2;
const WORKERS = Number(process.env.E2E_WORKERS ?? 1) || (env.CI ? Math.min(3, CPU) : Math.max(1, Math.min(6, CPU - 1)));

// Chromium by default; E2E_BROWSERS=chromium,firefox,webkit adds the others
// once their browsers are installed (`playwright install firefox webkit`).
const BROWSERS: Record<string, Project["use"]> = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
};
const selected = (process.env.E2E_BROWSERS ?? "chromium").split(",").map((name) => name.trim());
const projectsAll: Project[] = selected.map((name) => ({ name, use: { ...BROWSERS[name] } }));

const projects: Project[] = [
  ...projectsAll,
  ...projectsAll.map((project) => ({ ...project, name: `smoke-${project.name}`, grep: new RegExp(Tag.Smoke) })),
];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: env.CI,
  retries: env.CI ? 2 : 0,
  workers: WORKERS,
  // The JUnit report is what CI posts to OpenCards. Annotations go in as
  // properties so test.fail / test.fixme arrive as known defects rather than
  // as passes or skips.
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["junit", { outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT_FILE ?? "reports/junit.xml", embedAnnotationsAsProperties: true }],
  ],
  use: {
    baseURL: env.BASE_URL_WEB,
    trace: env.CI ? "on-first-retry" : "retain-on-failure",
    video: env.CI ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects,
});
