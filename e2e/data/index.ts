/**
 * Fixed test data: seeded catalogue products the cases rely on, worked out
 * by hand from apps/api/prisma/seed-catalogue.ts, and the password rules'
 * reference values.
 */
export const PRODUCTS = {
  deskLamp: { name: "Desk lamp", search: "lamp", price: "$34.50" },
  iphoneDock: { name: "iPhone dock", search: "dock", price: "$19.99", discountPercent: 25 },
  usbCable: { name: "USB-C cable", search: "cable", price: "$8.99" },
} as const;

/** Meets every AUTH-01 rule: 10 characters, upper, lower, digit. */
export const VALID_PASSWORD = "Abcdefghi1";

export const RESET_CONFIRMATION = "If that address is registered, a reset link is on its way.";
