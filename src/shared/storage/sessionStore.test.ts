import { afterEach, describe, expect, it, vi } from "vitest";

import { sessionStore } from "./sessionStore";

const isString = (value: unknown): value is string => typeof value === "string";

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("sessionStore", () => {
  it("stores values under its private session prefix and reads guarded data", () => {
    sessionStore.write("customer", "pedro-perez");

    expect(sessionStorage.getItem("wcsr:customer")).toBe('"pedro-perez"');
    expect(sessionStore.read("customer", isString)).toBe("pedro-perez");
  });

  it("does not expose corrupt or guard-rejected data", () => {
    sessionStorage.setItem("wcsr:customer", "not json");
    expect(sessionStore.read("customer", isString)).toBeUndefined();

    sessionStorage.setItem("wcsr:customer", "123");
    expect(sessionStore.read("customer", isString)).toBeUndefined();
  });

  it("removes only its prefixed session key", () => {
    sessionStorage.setItem("wcsr:customer", '"pedro-perez"');
    sessionStore.remove("customer");

    expect(sessionStorage.getItem("wcsr:customer")).toBeNull();
  });

  it("does not throw when session storage rejects reads, writes, or removals", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => sessionStore.read("customer", isString)).not.toThrow();
    expect(() => {
      sessionStore.write("customer", "pedro-perez");
    }).not.toThrow();
    expect(() => {
      sessionStore.remove("customer");
    }).not.toThrow();
  });
});
