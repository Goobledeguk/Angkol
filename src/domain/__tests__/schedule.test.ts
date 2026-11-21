import {
  cityClock,
  cityHour,
  formatMinutes,
  greeting,
  minutesUntil,
  nextDeparture,
  toMinutes,
  waitLabel,
} from "../schedule";

const at = (clock: string) => Date.parse(`2026-11-21T${clock}:00+08:00`);

const route = {
  scheduled: true,
  interval: 15,
  startsAt: "06:00",
  endsAt: "20:00",
};

describe("toMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(toMinutes("00:00")).toBe(0);
    expect(toMinutes("06:30")).toBe(390);
    expect(toMinutes("23:59")).toBe(1439);
  });

  it("returns NaN for malformed values", () => {
    expect(toMinutes("noon")).toBeNaN();
    expect(toMinutes("")).toBeNaN();
  });
});

describe("formatMinutes", () => {
  it("pads hours and minutes", () => {
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(65)).toBe("01:05");
    expect(formatMinutes(1200)).toBe("20:00");
  });

  it("wraps past midnight", () => {
    expect(formatMinutes(24 * 60 + 15)).toBe("00:15");
  });
});

describe("city time", () => {
  it("reads the clock in Manila time regardless of the device zone", () => {
    expect(cityClock(Date.parse("2026-11-21T01:30:00Z"))).toBe("09:30");
  });

  it("reads the hour in 24h form", () => {
    expect(cityHour(at("00:10"))).toBe(0);
    expect(cityHour(at("13:45"))).toBe(13);
  });
});

describe("greeting", () => {
  it.each([
    ["05:00", "Maupay nga aga"],
    ["11:59", "Maupay nga aga"],
    ["12:00", "Maupay nga kulop"],
    ["17:59", "Maupay nga kulop"],
    ["18:00", "Maupay nga gab-i"],
    ["02:00", "Maupay nga gab-i"],
  ])("at %s says %s", (clock, expected) => {
    expect(greeting(at(clock))).toBe(expected);
  });
});

describe("nextDeparture", () => {
  it("returns the first departure before service starts", () => {
    expect(nextDeparture(route, at("04:10"))).toBe("06:00");
  });

  it("returns the current slot when exactly on an interval", () => {
    expect(nextDeparture(route, at("07:30"))).toBe("07:30");
  });

  it("rounds up to the next interval", () => {
    expect(nextDeparture(route, at("07:31"))).toBe("07:45");
    expect(nextDeparture(route, at("09:44"))).toBe("09:45");
  });

  it("still allows the final departure at closing time", () => {
    expect(nextDeparture(route, at("19:50"))).toBe("20:00");
  });

  it("rolls over to tomorrow after the last trip", () => {
    expect(nextDeparture(route, at("20:01"))).toBe("Tomorrow 06:00");
  });

  it("handles routes that start on an odd minute", () => {
    const odd = { ...route, startsAt: "05:30", endsAt: "19:30", interval: 20 };
    expect(nextDeparture(odd, at("05:31"))).toBe("05:50");
    expect(nextDeparture(odd, at("19:20"))).toBe("19:30");
  });

  it("treats a zero interval as unscheduled instead of dividing by zero", () => {
    expect(nextDeparture({ ...route, interval: 0 }, at("08:00"))).toBe("No fixed schedule");
  });

  it("reports routes without a timetable", () => {
    expect(nextDeparture({ ...route, scheduled: false }, at("08:00"))).toBe("No fixed schedule");
    expect(nextDeparture({ ...route, startsAt: "" }, at("08:00"))).toBe("No fixed schedule");
    expect(nextDeparture({ ...route, endsAt: "" }, at("08:00"))).toBe("No fixed schedule");
  });

  it("refuses malformed clock strings", () => {
    expect(nextDeparture({ ...route, startsAt: "six" }, at("08:00"))).toBe("No fixed schedule");
  });
});

describe("minutesUntil", () => {
  it("counts down to the next departure", () => {
    expect(minutesUntil(route, at("07:31"))).toBe(14);
    expect(minutesUntil(route, at("07:45"))).toBe(0);
  });

  it("is null when the next trip is tomorrow or unscheduled", () => {
    expect(minutesUntil(route, at("21:00"))).toBeNull();
    expect(minutesUntil({ ...route, scheduled: false }, at("08:00"))).toBeNull();
  });
});

describe("waitLabel", () => {
  it("counts minutes until the next departure", () => {
    expect(waitLabel(route, at("07:31"))).toBe("In 14 min");
  });

  it("says boarding now at departure time", () => {
    expect(waitLabel(route, at("07:45"))).toBe("Boarding now");
  });

  it("uses hours for long waits before service", () => {
    expect(waitLabel(route, at("04:00"))).toBe("In 2 h");
    expect(waitLabel(route, at("04:20"))).toBe("In 1 h 40 min");
  });

  it("falls back to an estimate when the next trip is tomorrow", () => {
    expect(waitLabel(route, at("21:00"))).toBe("Estimated");
  });
});
