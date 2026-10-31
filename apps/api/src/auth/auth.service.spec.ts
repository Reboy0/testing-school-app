import { AuthService } from "./auth.service";

describe("AuthService.login", () => {
  it("LOGIN-036: looks the user up before verifying the password", async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const jwtService = { signAsync: jest.fn() };
    const mailService = { sendPasswordReset: jest.fn() };
    const service = new AuthService(prisma as any, jwtService as any, mailService as any);

    await service.login({ email: "sam@example.com", password: "Password123!" }).catch(() => {});

    expect(prisma.user.findUnique).toHaveBeenCalled();
  });
});
