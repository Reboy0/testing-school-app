import { pageSlice, totalPages } from "./pagination";

describe("totalPages", () => {
  it("SORT-021: is none when there is nothing to page through", () => {
    expect(totalPages(0, 12)).toBe(0);
  });

  it("SORT-022: is one when everything fits on one page", () => {
    expect(totalPages(7, 12)).toBe(1);
  });

  it("SORT-023: is exact when the total divides evenly", () => {
    expect(totalPages(24, 12)).toBe(2);
  });

  it("SORT-024: counts a part-full last page", () => {
    expect(totalPages(20, 12)).toBe(2);
  });
});

describe("pageSlice", () => {
  const items = ["a", "b", "c", "d", "e"];

  it("SORT-014 U-CAT-06: returns the first page", () => {
    expect(pageSlice(items, 1, 2)).toEqual(["a", "b"]);
  });

  it("SORT-015 U-CAT-06: returns a later page", () => {
    expect(pageSlice(items, 2, 2)).toEqual(["c", "d"]);
  });

  it("SORT-016 U-CAT-06: returns the part-full last page", () => {
    expect(pageSlice(items, 3, 2)).toEqual(["e"]);
  });

  it("SORT-017 U-CAT-06: returns nothing past the end", () => {
    expect(pageSlice(items, 9, 2)).toEqual([]);
  });
});
