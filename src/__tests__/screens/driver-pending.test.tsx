import { button, press } from "./screen-mocks";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import DriverPending from "../../driver/DriverPending";
import { makeUser, pujDriver } from "../../testing/fixtures";
import type { User } from "../../types/types";

async function openPending(overrides: Partial<User> = {}) {
  const refresh = jest.fn<Promise<boolean>, []>().mockResolvedValue(false);
  const logout = jest.fn().mockResolvedValue(undefined);
  const user = makeUser({
    ...pujDriver,
    verified: false,
    applicationStatus: "pending",
    ...overrides,
  });
  const view = await render(
    <DriverPending user={user} refresh={refresh} logout={logout} />,
  );
  return { user, refresh, logout, ...view };
}

it("explains that the named franchise is reviewing the application", async () => {
  await openPending();
  expect(
    screen.getByText("Your application is under review"),
  ).toBeOnTheScreen();
  expect(
    screen.getByText(/^Samar Northline needs to approve/),
  ).toBeOnTheScreen();
});

it("explains a decline and hides the status check", async () => {
  await openPending({ applicationStatus: "declined" });
  expect(screen.getByText("Your application was declined")).toBeOnTheScreen();
  expect(
    screen.getByText(/^Samar Northline declined your PUJ/),
  ).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Check status" })).toBeNull();
});

it("shows the driver's submitted identity details", async () => {
  const { user } = await openPending();
  for (const detail of [user.name, user.license, user.franchiseName!]) {
    expect(screen.getByText(detail)).toBeOnTheScreen();
  }
});

it("handles an application with no license or franchise listed", async () => {
  await openPending({ license: "", franchiseName: undefined });
  expect(screen.getAllByText("Not provided")).toHaveLength(2);
  expect(
    screen.getByText(/^the franchise owner needs to approve/),
  ).toBeOnTheScreen();
});

it("refreshes status and announces that approval is still pending", async () => {
  const { refresh } = await openPending();
  expect(screen.queryByText("Still waiting for approval.")).toBeNull();
  await press("Check status");
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Still waiting for approval.")).toBeOnTheScreen();
});

it("disables another check until the current refresh finishes", async () => {
  const { refresh } = await openPending();
  let finish!: (value: boolean) => void;
  refresh.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const user = userEvent.setup();
  await user.press(button("Check status"));
  expect(button("Checking…")).toBeDisabled();
  await user.press(button("Checking…"));
  expect(refresh).toHaveBeenCalledTimes(1);
  await act(() => finish(false));
  expect(button("Check status")).toBeEnabled();
});

test.each(["pending", "declined"] as const)(
  "signs out from a %s application",
  async (applicationStatus) => {
    const { logout, refresh } = await openPending({ applicationStatus });
    await press("Sign out");
    expect(logout).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  },
);
