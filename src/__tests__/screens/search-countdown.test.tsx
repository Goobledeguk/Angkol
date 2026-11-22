import "./screen-mocks";
import { render, screen } from "@testing-library/react-native";
import { SearchCountdown } from "../../passenger/SearchCountdown";

const NOW = Date.parse("2026-11-21T09:30:00+08:00");

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

it("shows the minutes and seconds left in the search window", async () => {
  await render(<SearchCountdown expires={NOW + 8 * 60_000 + 42_000} />);
  expect(screen.getByText("8:42")).toBeOnTheScreen();
  expect(screen.getByText("Search closes in")).toBeOnTheScreen();
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 522, text: "8:42" });
});

it("switches to a last-call message in the final minute", async () => {
  await render(<SearchCountdown expires={NOW + 45_000} />);
  expect(screen.getByText("0:45")).toBeOnTheScreen();
  expect(screen.getByText("Last call")).toBeOnTheScreen();
});

it("never counts below zero once the window has passed", async () => {
  await render(<SearchCountdown expires={NOW - 5_000} />);
  expect(screen.getByText("0:00")).toBeOnTheScreen();
  expect(screen.getByText("Closing the search…")).toBeOnTheScreen();
});
