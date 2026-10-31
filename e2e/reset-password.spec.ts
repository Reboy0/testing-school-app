import { expect, test, type Page } from "@playwright/test";
import { clearMailbox, readLatestResetLink } from "./helpers";

const SEEDED_EMAIL = "student@example.com";
const ORIGINAL_PASSWORD = "Password123!";
const NEW_PASSWORD = "NewPassw0rd!";

async function requestReset(page: Page): Promise<void> {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(SEEDED_EMAIL);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If that address is registered, a reset link is on its way.")).toBeVisible();
}

async function completeReset(page: Page, newPassword: string): Promise<void> {
  const resetLink = await readLatestResetLink();
  await page.goto(resetLink);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL("/login");
}

async function signIn(page: Page, password: string): Promise<void> {
  await page.getByLabel("Email address").fill(SEEDED_EMAIL);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}

test("PWD-034: reset the seeded student's password by email link", async ({ page }) => {
  await clearMailbox();
  await requestReset(page);

  // From here on the seeded account's password may actually change on the
  // server, so a failure anywhere in this block must not skip the restore
  // below — otherwise a single broken assertion here leaves
  // student@example.com permanently on NEW_PASSWORD, which would then also
  // fail every other spec that signs in as the seeded student until the
  // next database reset.
  let bodyError: unknown;
  try {
    await completeReset(page, NEW_PASSWORD);
    await signIn(page, NEW_PASSWORD);
  } catch (error) {
    bodyError = error;
  }

  // Always attempt the restore, whether or not the block above succeeded.
  let restoreError: unknown;
  try {
    await clearMailbox();
    await requestReset(page);
    await completeReset(page, ORIGINAL_PASSWORD);
  } catch (error) {
    restoreError = error;
  }

  // Surface whatever went wrong without letting either failure hide the
  // other: a failed restore must never be swallowed, and a failed test body
  // must still be the error that's reported when the restore itself
  // succeeds.
  if (bodyError && restoreError) {
    throw new AggregateError(
      [bodyError, restoreError],
      "The reset flow failed AND the password restore that follows it also failed — " +
        `${SEEDED_EMAIL} may be left on a non-seeded password.`,
    );
  }
  if (restoreError) throw restoreError;
  if (bodyError) throw bodyError;

  // Prove the restore actually took effect, not just that it ran.
  await signIn(page, ORIGINAL_PASSWORD);
});
