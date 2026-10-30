import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:3000",
  },
  // The JUnit report is what CI posts to OpenCards. Annotations go in as
  // properties so test.fail / test.fixme arrive as known defects rather
  // than as passes or skips. Its path is overridable so CI can collect every
  // suite's report in one place.
  reporter: [
    ["list"],
    [
      "junit",
      {
        outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT_FILE ?? "reports/junit.xml",
        embedAnnotationsAsProperties: true,
      },
    ],
  ],
  fullyParallel: false,
  workers: 1,
});
