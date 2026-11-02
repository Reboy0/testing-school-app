import { env } from "../env";
import { settleMail } from "../../src/mail/mail.service";

const MAILDEV_URL = env.MAILDEV_URL;
const RESET_TOKEN_PATTERN = /[?&]token=([0-9a-f]+)/;
const POLL_INTERVAL_MS = 100;
// Comfortably below the suite's testTimeout (see test/jest-e2e.json) so a
// mail that never arrives fails with the diagnostic below rather than with
// Jest's generic "exceeded timeout" message.
const POLL_TIMEOUT_MS = 3000;

interface MaildevMessage {
  time: string;
  text?: string;
  html?: string;
}

/**
 * Deletes every message currently sitting in Maildev's mailbox. Drains any
 * fire-and-forget send still in flight from a previous request first —
 * Maildev's own store can throw if a delete lands while it's mid-write for
 * an incoming message, so this avoids racing it rather than depending on
 * Maildev to handle that gracefully.
 */
export async function clearMail(): Promise<void> {
  await settleMail();
  await fetch(`${MAILDEV_URL}/email/all`, { method: "DELETE" });
}

/**
 * Reads the most recently received message from Maildev's REST API and
 * extracts the `token` query parameter from the reset link in its body.
 * Polls with a bounded retry, since SMTP delivery to Maildev happens
 * asynchronously relative to the HTTP response that triggered it.
 */
export async function latestResetToken(): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(`${MAILDEV_URL}/email`);
    if (res.ok) {
      const messages = (await res.json()) as MaildevMessage[];
      if (messages.length > 0) {
        // Maildev returns messages oldest-first and its `time` field only has
        // second-level precision, so ties must favor the later array entry
        // rather than the first-seen one.
        const latest = messages.reduce((newest, message) =>
          new Date(message.time) >= new Date(newest.time) ? message : newest,
        );
        const match = RESET_TOKEN_PATTERN.exec(latest.text ?? latest.html ?? "");
        if (match) return match[1];
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`No password reset email found at ${MAILDEV_URL} within ${POLL_TIMEOUT_MS}ms`);
}
