import { MailService } from "./mail.service";

describe("MailService without a configured SMTP server", () => {
  const originalHost = process.env.SMTP_HOST;
  const originalAppUrl = process.env.APP_URL;

  beforeEach(() => {
    delete process.env.SMTP_HOST;
  });

  afterAll(() => {
    if (originalHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = originalHost;
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
  });

  it("PWD-019: delivers nowhere instead of rejecting, so forgot-password still answers 202", async () => {
    const service = new MailService();

    await expect(service.sendPasswordReset("sam@example.com", "a-token")).resolves.toBeUndefined();
  });

  it("PWD-020: logs the reset link so it stays recoverable from the service logs", async () => {
    process.env.APP_URL = "https://school-web.onrender.com";
    const service = new MailService();
    const warn = jest
      .spyOn(service["logger"], "warn")
      .mockImplementation(() => undefined) as jest.SpyInstance;

    await service.sendPasswordReset("sam@example.com", "a-token");

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("https://school-web.onrender.com/reset-password?token=a-token"),
    );
  });
});
