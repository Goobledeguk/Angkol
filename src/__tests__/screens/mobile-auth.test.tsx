import { button, fill, press } from "./screen-mocks";
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from "@testing-library/react-native";
import MobileAuth from "../../auth/MobileAuth";
import {
  registerAccount,
  requestPasswordReset,
  signInAccount,
} from "../../auth/session";
import { pickLicensePhoto, savePendingLicense } from "../../services/documents";
import { passenger, tricycleDriver } from "../../testing/fixtures";

jest.mock("../../auth/session", () => ({
  registerAccount: jest.fn(),
  requestPasswordReset: jest.fn(),
  signInAccount: jest.fn(),
}));

jest.mock("../../services/documents", () => ({
  pickLicensePhoto: jest.fn(),
  savePendingLicense: jest.fn(),
}));

jest.mock("react-native-gesture-handler", () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  Gesture: {
    Pan: () => {
      const gesture = {
        onStart: () => gesture,
        onUpdate: () => gesture,
        onEnd: () => gesture,
      };
      return gesture;
    },
  },
}));

const photo = {
  uri: "file:///license.jpg",
  base64: "/9j/2Q==",
  width: 200,
  height: 120,
};
const password = "pass123456";
const credentials = { "Email address": passenger.email, Password: password };
const registration = {
  "Full name": passenger.name,
  Birthday: "06-25-1998",
  "Phone number": passenger.phone,
  ...credentials,
};
const takePhoto = "Take photo of your driver's license";
const choosePhoto = "Choose photo of your driver's license";

beforeEach(() => {
  jest.mocked(signInAccount).mockReset().mockResolvedValue(undefined);
  jest
    .mocked(registerAccount)
    .mockReset()
    .mockResolvedValue({ needsConfirmation: false });
  jest.mocked(requestPasswordReset).mockReset().mockResolvedValue(undefined);
  jest.mocked(pickLicensePhoto).mockReset().mockResolvedValue(null);
  jest.mocked(savePendingLicense).mockReset().mockResolvedValue(undefined);
});

async function enter(fields: Record<string, string>) {
  for (const [label, value] of Object.entries(fields)) {
    await fill(label, value);
  }
}

async function openAuth() {
  const onSignedIn = jest.fn().mockResolvedValue(true);
  await render(<MobileAuth onSignedIn={onSignedIn} />);
  return onSignedIn;
}

async function openRegistration(
  fields: Record<string, string> = {},
  driver = false,
) {
  const onSignedIn = await openAuth();
  await press(/Create an account/);
  if (driver) {
    await fireEvent.press(screen.getByRole("radio", { name: /^Driver/ }));
  }
  await enter(fields);
  return onSignedIn;
}

async function openDriverStep() {
  const onSignedIn = await openRegistration(
    {
      ...registration,
      "Full name": tricycleDriver.name,
      "Phone number": tricycleDriver.phone,
      "Email address": tricycleDriver.email,
    },
    true,
  );
  await fireEvent.press(screen.getByRole("checkbox"));
  await press("Continue");
  return onSignedIn;
}

describe("Mobile sign-in", () => {
  test.each([
    ["Invalid email or password. Please try again."],
    ["Email not confirmed"],
  ])("announces the authentication error %s", async (message) => {
    jest.mocked(signInAccount).mockRejectedValueOnce(new Error(message));
    const onSignedIn = await openAuth();
    await enter(credentials);
    await press("Sign in");
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("clears a credential error when the password is edited", async () => {
    jest
      .mocked(signInAccount)
      .mockRejectedValueOnce(
        new Error("Invalid email or password. Please try again."),
      );
    await openAuth();
    await enter(credentials);
    await press("Sign in");
    await fill("Password", "new-password");
    expect(
      screen.queryByText("Invalid email or password. Please try again."),
    ).toBeNull();
  });

  it("forwards credentials, clears the password, and notifies the parent after successful sign-in", async () => {
    const onSignedIn = await openAuth();
    await enter(credentials);
    await press("Sign in");
    expect(signInAccount).toHaveBeenCalledWith(passenger.email, password);
    expect(onSignedIn).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Password")).toHaveDisplayValue("");
  });

  it("disables sign-in while a request is pending", async () => {
    let finish!: () => void;
    jest.mocked(signInAccount).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await openAuth();
    await enter(credentials);
    const user = userEvent.setup();
    await user.press(button("Sign in"));
    expect(button("Signing in...")).toBeDisabled();
    await user.press(button("Signing in..."));
    expect(signInAccount).toHaveBeenCalledTimes(1);
    await act(finish);
    expect(button("Sign in")).toBeEnabled();
  });

  it("asks for an email address before sending a password reset", async () => {
    await openAuth();
    await press("Forgot password?");
    expect(
      screen.getByText("Enter your email address first."),
    ).toBeOnTheScreen();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("shows the password reset delivery message", async () => {
    await openAuth();
    await fill("Email address", passenger.email);
    await press("Forgot password?");
    expect(requestPasswordReset).toHaveBeenCalledWith(passenger.email);
    expect(
      screen.getByText(`We sent a password reset link to ${passenger.email}.`),
    ).toBeOnTheScreen();
  });
});

describe("Registration step one", () => {
  it("reports the required fields when the form is blank", async () => {
    await openRegistration();
    await press("Continue");
    for (const field of [
      "Full name",
      "Birthday",
      "Phone number",
      "Email address",
      "Password",
    ]) {
      expect(screen.getByText(`${field} is required.`)).toBeOnTheScreen();
    }
    expect(registerAccount).not.toHaveBeenCalled();
  });

  test.each([
    ["Email address", "maria@angkol", "Enter a valid email address."],
    ["Password", "123456789", "Use at least 10 characters for your password."],
    ["Birthday", "02-31-1998", "Enter a valid birthday in MM-DD-YYYY format."],
    [
      "Phone number",
      "0123456",
      "Use a Philippine mobile number, like 0917 123 4567.",
    ],
  ])("blocks advancing when %s is invalid", async (field, value, message) => {
    await openRegistration({ ...registration, [field]: value });
    await fireEvent.press(screen.getByRole("checkbox"));
    await press("Continue");
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(
      screen.getByText("Commuter registration, step 1 of 2"),
    ).toBeOnTheScreen();
  });

  it("requires consent and removes the validation message after acknowledgement", async () => {
    await openRegistration(registration);
    await press("Continue");
    expect(
      screen.getByText("Please review and acknowledge this information."),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(
      screen.queryByText("Please review and acknowledge this information."),
    ).toBeNull();
  });

  it("accepts an exactly 10-character password and advances to confirmation", async () => {
    await openRegistration(registration);
    await fireEvent.press(screen.getByRole("checkbox"));
    await press("Continue");
    expect(
      screen.getByText("Commuter registration, step 2 of 2"),
    ).toBeOnTheScreen();
    expect(screen.getByText(passenger.email)).toBeOnTheScreen();
    expect(screen.queryByText("Driver’s license photo")).toBeNull();
  });

  it("retains the entered information when returning from confirmation", async () => {
    await openRegistration(registration);
    await fireEvent.press(screen.getByRole("checkbox"));
    await press("Continue");
    await press("Go back");
    expect(screen.getByLabelText("Full name")).toHaveDisplayValue(
      passenger.name,
    );
    expect(screen.getByLabelText("Birthday")).toHaveDisplayValue(
      registration.Birthday,
    );
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});

describe("Driver registration and license photo", () => {
  it("offers the camera and photo library during the driver details step", async () => {
    await openDriverStep();
    expect(
      screen.getByText("Driver registration, step 2 of 2"),
    ).toBeOnTheScreen();
    expect(button(takePhoto)).toBeOnTheScreen();
    expect(button(choosePhoto)).toBeOnTheScreen();
  });

  test.each([
    [takePhoto, "camera"],
    [choosePhoto, "library"],
  ])(
    "shows a preview and remove button after using %s",
    async (label, source) => {
      jest.mocked(pickLicensePhoto).mockResolvedValueOnce(photo);
      await openDriverStep();
      await press(label);
      expect(pickLicensePhoto).toHaveBeenCalledWith(source);
      expect(screen.getByText("License photo added")).toBeOnTheScreen();
      expect(
        screen.getByLabelText("Photo of your driver's license"),
      ).toBeOnTheScreen();
      expect(button("Remove license photo")).toBeOnTheScreen();
    },
  );

  it("restores both pickers after the photo is removed", async () => {
    jest.mocked(pickLicensePhoto).mockResolvedValueOnce(photo);
    await openDriverStep();
    await press(choosePhoto);
    await press("Remove license photo");
    expect(screen.queryByText("License photo added")).toBeNull();
    expect(button(takePhoto)).toBeOnTheScreen();
    expect(button(choosePhoto)).toBeOnTheScreen();
  });

  it("leaves the picker available after cancellation", async () => {
    await openDriverStep();
    await press(choosePhoto);
    expect(pickLicensePhoto).toHaveBeenCalledWith("library");
    expect(screen.queryByText("License photo added")).toBeNull();
    expect(button(choosePhoto)).toBeEnabled();
  });

  it("shows a picker failure and clears it after a successful retry", async () => {
    jest
      .mocked(pickLicensePhoto)
      .mockRejectedValueOnce(new Error("Photo access is off."))
      .mockResolvedValueOnce(photo);
    await openDriverStep();
    await press(choosePhoto);
    expect(screen.getByText("Photo access is off.")).toBeOnTheScreen();
    await press(takePhoto);
    expect(screen.queryByText("Photo access is off.")).toBeNull();
    expect(screen.getByText("License photo added")).toBeOnTheScreen();
  });

  it("validates the required tricycle driver details", async () => {
    await openDriverStep();
    await press("Process Application");
    for (const field of [
      "License No.",
      "Plate No.",
      "Permit No. (Prangkisa)",
    ]) {
      expect(screen.getByText(`${field} is required.`)).toBeOnTheScreen();
    }
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it("requires a business or franchise for PUJ drivers", async () => {
    await openDriverStep();
    await fireEvent.press(screen.getByRole("radio", { name: /^PUJ \/ PUV/ }));
    await fill("License No.", tricycleDriver.license);
    await press("Process Application");
    expect(
      screen.getByText("Select a business / franchise."),
    ).toBeOnTheScreen();
    expect(registerAccount).not.toHaveBeenCalled();
  });

  it("keeps the selected photo pending when registration requires email confirmation", async () => {
    jest.mocked(pickLicensePhoto).mockResolvedValueOnce(photo);
    jest
      .mocked(registerAccount)
      .mockResolvedValueOnce({ needsConfirmation: true });
    const onSignedIn = await openDriverStep();
    await enter({
      "License No.": tricycleDriver.license,
      "Plate No.": "tc12345",
      "Permit No. (Prangkisa)": "P-123",
    });
    await press(choosePhoto);
    await press("Process Application");
    expect(registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "Tricycle driver",
        plate: "TC-12345",
        licenseDocAttached: true,
      }),
    );
    expect(savePendingLicense).toHaveBeenCalledWith(
      tricycleDriver.email,
      photo,
    );
    expect(
      screen.getByText(/^We sent a confirmation link to/),
    ).toBeOnTheScreen();
    expect(onSignedIn).not.toHaveBeenCalled();
  });
});
