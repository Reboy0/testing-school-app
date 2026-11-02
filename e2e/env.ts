import path from "node:path";
import { config } from "dotenv";
import { bool, cleanEnv, url } from "envalid";

// Locally the values come from e2e/.env (see .env.example); in CI the
// workflow exports them. Either way a missing or malformed one stops the
// run before the first test rather than surfacing as a confusing failure.
config({ path: path.join(__dirname, ".env") });

export const env = cleanEnv(process.env, {
  BASE_URL_WEB: url({ desc: "The web app under test" }),
  API_URL: url({ desc: "The API the web app talks to" }),
  MAILDEV_URL: url({ desc: "Maildev's web/REST endpoint, where reset emails land" }),
  DATABASE_URL: url({ desc: "The database the servers use — every case cleans up after itself in it" }),
  CI: bool({ default: false }),
});
