import { describe, it, expect } from "vitest";
import { parseImport } from "../src/services/imports";
describe("question import", () => {
  it("parses quoted CSV and gives missing optional columns defaults", () => {
    const r = parseImport(
      "csv",
      'title,content\n"Cache, design","Line 1\nLine 2"',
    );
    expect(r.errors).toEqual([]);
    expect(r.questions[0]).toMatchObject({
      title: "Cache, design",
      content: "Line 1\nLine 2",
      category: "",
      source_url: null,
    });
  });
  it("returns row errors without accepting invalid rows", () => {
    const r = parseImport(
      "json",
      JSON.stringify([
        { title: "Good" },
        { title: "", source_url: "javascript:alert(1)" },
      ]),
    );
    expect(r.errors[0].row).toBe(2);
    expect(r.questions).toHaveLength(1);
  });
  it("handles malformed JSON/CSV and limits rows", () => {
    expect(parseImport("json", "broken").errors.length).toBe(1);
    expect(parseImport("csv", 'title\n"broken').errors.length).toBe(1);
    expect(
      parseImport(
        "json",
        JSON.stringify(Array.from({ length: 1001 }, () => ({ title: "x" }))),
      ).errors.length,
    ).toBe(1);
  });
  it("supports documented export shape and preserves metadata", () => {
    expect(
      parseImport(
        "json",
        '{"questions":[{"title":"Bonjour","metadata":{"solution":"Hello"}}]}',
      ).questions[0].metadata,
    ).toEqual({ solution: "Hello" });
  });
  it("rejects unexpected fields, executable URLs and oversized content", () => {
    expect(
      parseImport("json", '[{"title":"x","user_id":"forged"}]').errors.length,
    ).toBe(1);
    expect(
      parseImport(
        "json",
        JSON.stringify([{ title: "x", source_url: "ftp://x.com" }]),
      ).errors.length,
    ).toBe(1);
    expect(parseImport("csv", "x".repeat(1_000_001)).errors.length).toBe(1);
  });
});
