// The API reads apps/api/.env for itself; this loads the same file for the
// suite and validates what the suite needs, so a missing variable stops the
// run with a clear message instead of a confusing failure mid-test.
import "../src/common/load-env";
import { cleanEnv, url } from "envalid";

export const env = cleanEnv(process.env, {
  TEST_DATABASE_URL: url({ desc: "The database the suite owns and empties after every case" }),
  MAILDEV_URL: url({ default: "http://localhost:1080", desc: "Maildev's REST endpoint, where reset emails land" }),
});
