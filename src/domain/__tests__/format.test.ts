import { firstName, initials, statusLabel } from "../format";

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
