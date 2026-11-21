import "./screen-mocks";
import { render } from "@testing-library/react-native";
import AngkolApp from "../../AngkolApp";
import { api } from "../../services/api";
import { uploadPendingLicense } from "../../services/documents";
import { makeSnapshot, passenger, pujDriver } from "../../testing/fixtures";

jest.mock("../../services/supabase", () => {
  const channel = { on: jest.fn().mockReturnThis(), subscribe: jest.fn() };
  return {
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: {} } }),
      },
      channel: jest.fn(() => channel),
      removeChannel: jest.fn(),
    },
  };
});

jest.mock("../../services/documents", () => ({
  uploadPendingLicense: jest.fn(),
}));
jest.mock("../../services/location", () => ({ resumeSharing: jest.fn() }));
jest.mock("../../auth/Auth", () => () => null);
jest.mock("../../admin/AdminDashboard", () => () => null);
jest.mock("../../driver/DriverApp", () => () => null);
jest.mock("../../driver/DriverPending", () => () => null);
jest.mock("../../passenger/PassengerApp", () => () => null);

it("checks for a pending photo even if registration already set the attachment flag", async () => {
  const user = { ...pujDriver, available: false, licenseDocAttached: true };
  jest.mocked(api).mockResolvedValue(makeSnapshot({ user }));
  jest.mocked(uploadPendingLicense).mockResolvedValueOnce(true);
  await render(<AngkolApp />);
  expect(uploadPendingLicense).toHaveBeenCalledTimes(1);
  expect(uploadPendingLicense).toHaveBeenCalledWith(user.id, user.email);
  expect(jest.mocked(api).mock.calls).toEqual([["/state"], ["/state"]]);
});

it("skips the snapshot refresh when the pending photo cannot be uploaded yet", async () => {
  const user = { ...pujDriver, available: false };
  jest.mocked(api).mockResolvedValue(makeSnapshot({ user }));
  jest.mocked(uploadPendingLicense).mockResolvedValueOnce(false);
  await render(<AngkolApp />);
  expect(uploadPendingLicense).toHaveBeenCalledWith(user.id, user.email);
  expect(jest.mocked(api).mock.calls).toEqual([["/state"]]);
});

it("skips the upload check for a passenger session", async () => {
  jest.mocked(api).mockResolvedValue(makeSnapshot({ user: passenger }));
  await render(<AngkolApp />);
  expect(uploadPendingLicense).not.toHaveBeenCalled();
});
