import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api";
import { readPendingLicense, savePendingLicense, uploadLicense, uploadPendingLicense } from "../documents";
import { setupApiHarness } from "./apiHarness";

jest.mock("../supabase", () => ({ db: jest.fn() }));
jest.mock("../mapbox", () => ({ directions: jest.fn() }));
jest.mock("expo-image-picker", () => ({}));
jest.mock("@react-native-async-storage/async-storage", () => {
  const items = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => items.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => void items.set(key, value)),
    removeItem: jest.fn(async (key: string) => void items.delete(key)),
    clear: jest.fn(async () => items.clear()),
  };
});

const harness = setupApiHarness();
const bucket = "driver-documents";
const driverId = "driver-1";
const path = "license/driver-1.jpg";
const email = "driver@example.test";
const photo = { uri: "file:///license.jpg", base64: "/9j/2Q==", width: 200, height: 120 };
const jpegBytes = [0xff, 0xd8, 0xff, 0xd9];
const signedUrl = "https://storage.example.test/license/driver-1.jpg?token=fixture";

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

function expectUpload(bytes = jpegBytes, error?: string) {
  harness.fake.storage(
    bucket,
    ["upload", path, new Uint8Array(bytes).buffer, { contentType: "image/jpeg", upsert: true }],
    null,
    error,
  );
}

function expectAttachment(data: { user_id: string } | null = { user_id: driverId }, error?: string) {
  harness.fake.table(
    "drivers",
    [
      ["update", { license_doc_attached: true }],
      ["eq", "user_id", driverId],
      ["select", "user_id"],
      ["maybeSingle"],
    ],
    data,
    error,
  );
}

describe("uploadLicense", () => {
  test.each([
    ["/9j/2Q==", jpegBytes],
    ["/9j/2Q", jpegBytes],
    ["/9j/2f8=", [...jpegBytes, 0xff]],
    ["/9j/", jpegBytes.slice(0, 3)],
  ])("uploads %s as JPEG bytes before attaching it to the driver", async (base64, bytes) => {
    expectUpload(bytes);
    expectAttachment();
    await expect(uploadLicense(driverId, base64)).resolves.toBeUndefined();
    const [storageOrder] = harness.fake.client.storage.from.mock.invocationCallOrder;
    const [driverOrder] = harness.fake.client.from.mock.invocationCallOrder;
    expect(storageOrder).toBeLessThan(driverOrder);
  });

  test.each(["", "A", "YQ=", "abc@"])("rejects invalid base64 %p before uploading", async (base64) => {
    await expect(uploadLicense(driverId, base64)).rejects.toThrow("Invalid license photo data.");
    expect(harness.fake.client.storage.from).not.toHaveBeenCalled();
  });

  it("surfaces a storage denial without marking the driver profile", async () => {
    expectUpload(jpegBytes, "Storage policy denied the upload");
    await expect(uploadLicense(driverId, photo.base64)).rejects.toMatchObject({
      message: "Storage policy denied the upload",
    });
    expect(harness.fake.client.from).not.toHaveBeenCalled();
  });
});

describe("uploadPendingLicense", () => {
  it("returns false without touching storage when there is no photo", async () => {
    await expect(uploadPendingLicense(driverId, email)).resolves.toBe(false);
    expect(harness.fake.client.storage.from).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it("normalizes the email and clears the photo after both writes succeed", async () => {
    await savePendingLicense(" DRIVER@EXAMPLE.TEST ", photo);
    expectUpload();
    expectAttachment();
    await expect(uploadPendingLicense(driverId, email)).resolves.toBe(true);
    await expect(readPendingLicense(email)).resolves.toBeNull();
  });

  it("retains the photo before the bucket migration and uploads it on retry", async () => {
    await savePendingLicense(email, photo);
    expectUpload(jpegBytes, "Bucket not found");
    await expect(uploadPendingLicense(driverId, email)).resolves.toBe(false);
    await expect(readPendingLicense(email)).resolves.toBe(photo.base64);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();

    expectUpload();
    expectAttachment();
    await expect(uploadPendingLicense(driverId, email)).resolves.toBe(true);
    await expect(readPendingLicense(email)).resolves.toBeNull();
  });

  test.each(["Driver update denied", undefined])(
    "retains the pending photo if the profile update returns no row with error %p",
    async (error) => {
      await savePendingLicense(email, photo);
      expectUpload();
      expectAttachment(null, error);
      await expect(uploadPendingLicense(driverId, email)).resolves.toBe(false);
      await expect(readPendingLicense(email)).resolves.toBe(photo.base64);
    },
  );

  it("keeps a new pending photo saved during the upload", async () => {
    await savePendingLicense(email, photo);
    expectUpload();
    expectAttachment();
    const uploading = uploadPendingLicense(driverId, email);
    await savePendingLicense(email, { ...photo, base64: "/9j/" });
    await expect(uploading).resolves.toBe(true);
    await expect(readPendingLicense(email)).resolves.toBe("/9j/");
  });

  it("returns false and keeps the photo when local removal fails", async () => {
    await savePendingLicense(email, photo);
    expectUpload();
    expectAttachment();
    jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error("Storage unavailable"));
    await expect(uploadPendingLicense(driverId, email)).resolves.toBe(false);
    await expect(readPendingLicense(email)).resolves.toBe(photo.base64);
  });
});

describe("GET /documents/license/:userId", () => {
  test.each(["GET", undefined])("returns a ten-minute signed URL for method %p", async (method) => {
    harness.fake.storage(bucket, ["createSignedUrl", path, 600], { signedUrl });
    await expect(api(`/documents/license/${driverId}`, undefined, method)).resolves.toEqual({ url: signedUrl });
  });

  test.each(["Object not found", "Forbidden", "Bucket not found", undefined])(
    "returns a null URL when signed URL data is absent with error %p",
    async (error) => {
      harness.fake.storage(bucket, ["createSignedUrl", path, 600], null, error);
      await expect(api(`/documents/license/${driverId}`, undefined, "GET")).resolves.toEqual({ url: null });
    },
  );
});
