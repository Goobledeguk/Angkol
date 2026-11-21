import {
  activeTripFor,
  hasLiveTrip,
  isAdminRole,
  isDriverRole,
  isFinished,
  isPujRole,
} from "../roles";
import { makeSnapshot, makeTrip, passenger, tricycleDriver } from "../../testing/fixtures";
import type { Role, Status } from "../../types/types";

describe("role checks", () => {
  it.each<[Role, boolean, boolean, boolean]>([
    ["Passenger", false, false, false],
    ["Tricycle driver", false, true, false],
    ["PUJ / PUV driver", false, true, true],
    ["Administrator", true, false, false],
    ["Vehicle Owner / Operator", true, false, false],
  ])("%s → admin %s, driver %s, puj %s", (role, admin, driver, puj) => {
    expect(isAdminRole(role)).toBe(admin);
    expect(isDriverRole(role)).toBe(driver);
    expect(isPujRole(role)).toBe(puj);
  });
});

describe("isFinished", () => {
  it.each<[Status, boolean]>([
    ["Requested", false],
    ["Accepted", false],
    ["Arrived", false],
    ["In progress", false],
    ["Completed", true],
    ["Cancelled", true],
  ])("%s → %s", (status, expected) => {
    expect(isFinished({ status })).toBe(expected);
  });
});

describe("activeTripFor", () => {
  it("ignores finished trips", () => {
    expect(activeTripFor(makeSnapshot())).toBeUndefined();
  });

  it("finds the passenger's open booking", () => {
    const live = makeTrip({ id: "live", status: "Accepted" });
    const data = makeSnapshot({ trips: [live, ...makeSnapshot().trips] });
    expect(activeTripFor(data)?.id).toBe("live");
  });

  it("finds a driver's assigned trip", () => {
    const live = makeTrip({ id: "drive", status: "In progress", driverId: tricycleDriver.id });
    const data = makeSnapshot({ user: tricycleDriver, trips: [live] });
    expect(activeTripFor(data)?.id).toBe("drive");
  });

  it("does not treat another passenger's request as mine", () => {
    const other = makeTrip({ id: "other", passengerId: "someone-else", status: "Requested" });
    const data = makeSnapshot({ user: passenger, trips: [other] });
    expect(activeTripFor(data)).toBeUndefined();
  });
});

describe("hasLiveTrip", () => {
  it("is false while a request is still waiting for a driver", () => {
    const data = makeSnapshot({ trips: [makeTrip({ status: "Requested" })] });
    expect(hasLiveTrip(data)).toBe(false);
  });

  it.each<Status>(["Accepted", "Arrived", "In progress"])("is true when %s", (status) => {
    const data = makeSnapshot({ trips: [makeTrip({ status })] });
    expect(hasLiveTrip(data)).toBe(true);
  });
});
