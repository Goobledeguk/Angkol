import { firstName, initials, isPhMobile, normalizePhMobile, statusLabel } from "../format";

describe("statusLabel", () => {
  it.each([
    ["open", "Open"],
    ["OPEN", "Open"],
    ["resolved", "Resolved"],
    ["in_review", "In review"],
    ["in review", "In review"],
    ["closed", "Closed"],
    ["dismissed", "Dismissed"],
    ["needs-follow_up", "Needs follow up"],
    ["", "Open"],
  ])("%s → %s", (raw, label) => {
    expect(statusLabel(raw)).toBe(label);
  });
});

describe("initials", () => {
  it.each([
    ["Maria Dela Cruz", "MC"],
    ["jun", "J"],
    ["  Rey   Tan  ", "RT"],
    ["", "?"],
  ])("%s → %s", (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe("firstName", () => {
  it("takes the first word", () => {
    expect(firstName("Maria Dela Cruz")).toBe("Maria");
  });

  it("falls back politely for empty names", () => {
    expect(firstName("   ")).toBe("there");
  });
});

describe("Philippine mobile numbers", () => {
  it.each([
    ["09171234567", true],
    ["0917 123 4567", true],
    ["0917-123-4567", true],
    ["+639171234567", true],
    ["639171234567", true],
    ["0817123456", false],
    ["9171234567", false],
    ["+63917123456", false],
    ["hello", false],
  ])("%s → %s", (value, ok) => {
    expect(isPhMobile(value)).toBe(ok);
  });

  it("normalizes international and spaced numbers to the local form", () => {
    expect(normalizePhMobile("+63 917 123 4567")).toBe("09171234567");
    expect(normalizePhMobile("0917 123 4567")).toBe("09171234567");
  });
});
