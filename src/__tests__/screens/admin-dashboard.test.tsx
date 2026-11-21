import { appCallbacks, button, press } from "./screen-mocks";
import { act, render, screen, within } from "@testing-library/react-native";
import AdminDashboard from "../../admin/AdminDashboard";
import {
  admin,
  makeSnapshot,
  makeUser,
  pujDriver,
} from "../../testing/fixtures";
import type { Snapshot } from "../../types/types";

async function openAdmin(overrides: Partial<Snapshot> = {}) {
  const data = makeSnapshot({ user: admin, ...overrides });
  const callbacks = appCallbacks();
  await render(
    <AdminDashboard
      data={data}
      busy={false}
      connected
      notice=""
      {...callbacks}
    />,
  );
  return callbacks;
}

function expectCount(label: string, count: number) {
  const row = screen.getByText(label).parent!;
  expect(within(row).getByText(String(count))).toBeOnTheScreen();
}

it("counts pending applications alongside accepted and declined users", async () => {
  await openAdmin({
    users: [
      admin,
      pujDriver,
      makeUser({ id: "pending-a", applicationStatus: "pending" }),
      makeUser({ id: "pending-b", applicationStatus: "pending" }),
      makeUser({ id: "declined", applicationStatus: "declined" }),
    ],
  });
  expectCount("Driver applications waiting", 2);
});

it("counts open reports alongside resolved reports", async () => {
  const [report] = makeSnapshot().reports;
  await openAdmin({
    reports: [report, { ...report, id: "resolved", status: "resolved" }],
  });
  expectCount("Open passenger reports", 1);
});

it("counts fresh locations alongside stale ones", async () => {
  const [vehicle] = makeSnapshot().vehicles;
  await openAdmin({
    vehicles: [
      { ...vehicle, id: "live-a", stale: false },
      { ...vehicle, id: "live-b", stale: false },
      { ...vehicle, id: "stale", stale: true },
    ],
  });
  expectCount("Vehicles reporting location", 2);
});

it("shows zero in each count for an empty snapshot", async () => {
  await openAdmin({ users: [], reports: [], vehicles: [] });
  for (const label of [
    "Driver applications waiting",
    "Open passenger reports",
    "Vehicles reporting location",
  ]) {
    expectCount(label, 0);
  }
});

it("shows the signed-in administrator and directs them to the web portal", async () => {
  await openAdmin();
  expect(
    screen.getByText("Operations run on the web portal"),
  ).toBeOnTheScreen();
  expect(screen.getByText(/Signed in as Lea Operations/)).toBeOnTheScreen();
});

it("shows the fleet heading for an operator", async () => {
  await openAdmin({ user: makeUser({ role: "Vehicle Owner / Operator" }) });
  expect(screen.getByText("Manage your fleet on the web")).toBeOnTheScreen();
});

it("signs out and prevents a duplicate request while logout is pending", async () => {
  const { logout } = await openAdmin();
  let finish!: () => void;
  logout.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await press("Sign out");
  expect(button("Signing out…")).toBeDisabled();
  await press("Signing out…");
  expect(logout).toHaveBeenCalledTimes(1);
  await act(finish);
  expect(button("Sign out")).toBeEnabled();
});
