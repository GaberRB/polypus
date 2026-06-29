import { describe, expect, it } from "vitest";
import { query } from "../src/core/protocol/jsonpath.js";

const obj = {
  message: "hello",
  nested: { value: 42 },
  arr: [{ name: "a" }, { name: "b" }],
  matrix: [[1, 2], [3, 4]],
};

describe("jsonpath.query", () => {
  it("$.key", () => expect(query(obj, "$.message")).toBe("hello"));
  it("$.a.b", () => expect(query(obj, "$.nested.value")).toBe(42));
  it("$.arr[0]", () => expect(query(obj, "$.arr[0]")).toEqual({ name: "a" }));
  it("$.arr[1].name", () => expect(query(obj, "$.arr[1].name")).toBe("b"));
  it("$.arr[*].name", () => expect(query(obj, "$.arr[*].name")).toEqual(["a", "b"]));
  it("$.* keys", () => {
    const r = query({ x: 1, y: 2 }, "$.*") as number[];
    expect(r.sort()).toEqual([1, 2]);
  });
  it("$[0] on array root", () => expect(query([10, 20], "$[0]")).toBe(10));
  it("missing key returns undefined", () => expect(query(obj, "$.missing")).toBeUndefined());
  it("missing nested returns undefined", () => expect(query(obj, "$.nested.x")).toBeUndefined());
  it("throws on missing $", () => expect(() => query(obj, "message")).toThrow());
  it("$.access_token — typical OAuth2", () => {
    expect(query({ access_token: "tok123", expires_in: 3600 }, "$.access_token")).toBe("tok123");
  });
  it("$.expires_in — numeric", () => {
    expect(query({ access_token: "x", expires_in: 3600 }, "$.expires_in")).toBe(3600);
  });
});
