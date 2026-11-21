import { money } from "../../common/ui";

jest.mock("react-native-reanimated", () => ({}));

test.each([
  [0, "\u20b10.00"],
  [125, "\u20b1125.00"],
  [9.5, "\u20b19.50"],
  [2.125, "\u20b12.13"],
  [-3.75, "\u20b1-3.75"],
  [1234.56, "\u20b11234.56"],
])("formats the peso amount %p as %p", (amount, expected) => {
  expect(money(amount)).toBe(expected);
});
