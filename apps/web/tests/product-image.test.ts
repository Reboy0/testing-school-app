import { describe, expect, it } from "vitest";
import { initialsFrom, productImageSvg } from "../lib/product-image";

describe("initialsFrom", () => {
  it("CATL-040: takes the first letter of the first two words", () => {
    expect(initialsFrom("desk-lamp")).toBe("DL");
  });

  it("CATL-041: takes one letter from a one-word slug", () => {
    expect(initialsFrom("kite")).toBe("K");
  });

  it("CATL-042: stops at two letters however long the slug is", () => {
    expect(initialsFrom("noise-cancelling-headphones")).toBe("NC");
  });
});

describe("productImageSvg", () => {
  it("CATL-043: draws an SVG carrying the product's initials", () => {
    const svg = productImageSvg("desk-lamp");

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(">DL<");
  });

  it("CATL-044: is the same picture every time, so a catalogue does not shuffle", () => {
    expect(productImageSvg("desk-lamp")).toBe(productImageSvg("desk-lamp"));
  });

  it("CATL-045: gives different products different colours", () => {
    const lamp = /hsl\((\d+)/.exec(productImageSvg("desk-lamp"))?.[1];
    const kite = /hsl\((\d+)/.exec(productImageSvg("kite"))?.[1];

    expect(lamp).toBeDefined();
    expect(lamp).not.toBe(kite);
  });
});
