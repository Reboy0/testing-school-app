import { expect } from "@playwright/test";
import { env } from "../env";

interface MaildevMessage {
  to: { address: string }[];
  text?: string;
}

const RESET_LINK = /https?:\/\/\S+\/reset-password\?token=[0-9a-f]+/;

/**
 * The newest password-reset link Maildev holds for one address. SMTP
 * delivery lags the HTTP response that triggered it, so it polls rather
 * than sleeping a guessed amount.
 */
export async function resetLinkFor(email: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const messages = (await (await fetch(`${env.MAILDEV_URL}/email`)).json()) as MaildevMessage[];
        const mine = messages.filter((message) => message.to.some((to) => to.address === email));
        link = RESET_LINK.exec(mine.at(-1)?.text ?? "")?.[0];
        return link;
      },
      { message: `a reset email for ${email}`, timeout: 15_000 },
    )
    .toBeTruthy();
  return link!;
}

export function tokenOf(resetLink: string): string {
  return new URL(resetLink).searchParams.get("token") ?? "";
}
