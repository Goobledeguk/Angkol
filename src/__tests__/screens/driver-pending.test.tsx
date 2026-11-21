import { button, press } from "./screen-mocks";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import DriverPending from "../../driver/DriverPending";
import { makeUser, pujDriver } from "../../testing/fixtures";
import { pickLicensePhoto, uploadLicense } from "../../services/documents";
import type { User } from "../../types/types";

jest.mock("../../services/documents", () => ({
  pickLicensePhoto: jest.fn(),
  uploadLicense: jest.fn(),
}));

async function openPending(overrides: Partial<User> = {}) {
  const refresh = jest.fn<Promise<boolean>, []>().mockResolvedValue(false);
  const logout = jest.fn().mockResolvedValue(undefined);
  const user = makeUser({
    ...pujDriver,
    verified: false,
    applicationStatus: "pending",
    licenseDocAttached: true,
    ...overrides,
  });
  const view = await render(
    <DriverPending user={user} refresh={refresh} logout={logout} />,
  );
  return { user, refresh, logout, ...view };
}

beforeEach(() => {
  jest.mocked(pickLicensePhoto).mockReset();
  jest.mocked(uploadLicense).mockReset();
});

it("names the franchise reviewing a PUJ/PUV application", async () => {
  await openPending();
  expect(screen.getByText("Almost ready to drive")).toBeOnTheScreen();
  expect(
    screen.getByText(/^Samar Northline approves every driver/),
  ).toBeOnTheScreen();
  expect(
    screen.getByText("Samar Northline confirms you drive for the franchise."),
  ).toBeOnTheScreen();
});

it("sends tricycle drivers to the city transport office", async () => {
  await openPending({ role: "Tricycle driver", franchiseName: undefined });
  expect(
    screen.getByText(/^The Calbayog transport office approves every driver/),
  ).toBeOnTheScreen();
  expect(screen.getByText(/^Tricycle driver ·/)).toBeOnTheScreen();
});

it("falls back to a generic reviewer when no franchise is listed", async () => {
  await openPending({ franchiseName: undefined });
  expect(
    screen.getByText(/^Your franchise owner approves every driver/),
  ).toBeOnTheScreen();
});

it("explains a decline and hides the status check", async () => {
  await openPending({ applicationStatus: "declined" });
  expect(screen.getByText("Your application was declined")).toBeOnTheScreen();
  expect(screen.getByText(/^Samar Northline declined your application/)).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Check status" })).toBeNull();
});

it("marks the license step done once the photo is stored", async () => {
  await openPending();
  expect(screen.getByText("License photo received")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Take a photo of my license" })).toBeNull();
});

it("asks for the license photo and uploads it from the camera", async () => {
  jest.mocked(pickLicensePhoto).mockResolvedValue({ uri: "file://l.jpg", base64: "QUJD", width: 1, height: 1 });
  jest.mocked(uploadLicense).mockResolvedValue(undefined);
  const { user, refresh } = await openPending({ licenseDocAttached: false });
  expect(screen.getByText("Add your driver license photo")).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Check status" })).toBeNull();
  await press("Take a photo of my license");
  expect(pickLicensePhoto).toHaveBeenCalledWith("camera");
  expect(uploadLicense).toHaveBeenCalledWith(user.id, "QUJD");
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("does nothing when the photo picker is cancelled", async () => {
  jest.mocked(pickLicensePhoto).mockResolvedValue(null);
  const { refresh } = await openPending({ licenseDocAttached: false });
  await press("Choose from my photos");
  expect(pickLicensePhoto).toHaveBeenCalledWith("library");
  expect(uploadLicense).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
});

it("shows the upload error and lets the driver try again", async () => {
  jest.mocked(pickLicensePhoto).mockRejectedValue(new Error("Camera access is off."));
  await openPending({ licenseDocAttached: false });
  await press("Take a photo of my license");
  expect(screen.getByText("Camera access is off.")).toBeOnTheScreen();
  expect(button("Take a photo of my license")).toBeEnabled();
});

it("refreshes status and announces that approval is still pending", async () => {
  const { refresh } = await openPending();
  expect(screen.queryByText(/^Not approved yet/)).toBeNull();
  await press("Check status");
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/^Not approved yet/)).toBeOnTheScreen();
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
