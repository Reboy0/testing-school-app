import { categoryWhere, searchWhere } from "./product-filters";

describe("searchWhere", () => {
  it("SEARCH-023: matches the name anywhere in it, ignoring case", () => {
    expect(searchWhere("lamp")).toEqual({ name: { contains: "lamp", mode: "insensitive" } });
  });

  it("SEARCH-024: is no filter at all when nothing was searched for", () => {
    expect(searchWhere(undefined)).toBeNull();
  });
});

describe("categoryWhere", () => {
  it("SEARCH-025: matches products that are in the category", () => {
    expect(categoryWhere("garden")).toEqual({
      categories: { some: { category: { slug: "garden" } } },
    });
  });

  it("SEARCH-026: is no filter at all when no category was chosen", () => {
    expect(categoryWhere(undefined)).toBeNull();
  });
});
