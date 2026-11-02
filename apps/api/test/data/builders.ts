import { faker } from "@faker-js/faker";

/** Meets every AUTH-01 rule: 10 characters, upper, lower, digit. */
export const VALID_PASSWORD = "Abcdefghi1";

/** A valid registration body with a unique email. */
export function buildRegistration(overrides: Partial<{ email: string; name: string; password: string }> = {}) {
  return {
    email: `api-${faker.string.alphanumeric(10).toLowerCase()}@example.com`,
    name: faker.person.fullName(),
    password: VALID_PASSWORD,
    ...overrides,
  };
}

/** A valid address body. */
export function buildAddress(overrides: Partial<{ label: string; line1: string; city: string; postalCode: string; country: string; isDefault: boolean }> = {}) {
  return {
    label: faker.helpers.arrayElement(["Home", "Work", "Parents"]),
    line1: faker.location.streetAddress(),
    city: faker.location.city(),
    postalCode: faker.location.zipCode("#####"),
    country: "UA",
    ...overrides,
  };
}
