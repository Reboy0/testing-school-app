import { faker } from "@faker-js/faker";
import type { User } from "../api";
import { VALID_PASSWORD } from "../data";

/** A unique, valid account that has not been registered yet. */
export function buildUser(tag = "user"): User {
  return {
    email: `e2e-${tag}-${faker.string.alphanumeric(10).toLowerCase()}@example.com`,
    name: faker.person.fullName(),
    password: VALID_PASSWORD,
  };
}
