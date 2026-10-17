import React, { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import type { AdminDashboardProps } from "./AdminDashboard";
import type { Trip, User } from "./types";
import AdminPanel from "./AdminPanel";
import CalbayogMap from "./CalbayogMap";

import { adminDashboardStyles } from "./adminDashboardStyles";

const pages = [
  "Overview",
  "People",
  "Routes & terminals",
  "Trips & reports",
  "System monitor",
];
const titles = [
  "Operations overview",
  "People & verification",
  "Routes, terminals & fares",
  "Trips & reports",
  "System & audit monitor",
];
const subtitles = [
  "Live mobility status across Calbayog City",
  "Manage commuters, driver partners, identity and association records",
  "Configure the local network, schedules, and transparent fare rules",
  "Search operational records, investigate exceptions, and export civic mobility data",
  "Platform health, location freshness, security events, and accountable change history",
];
const paths: Record<string, string> = {
  overview: "M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h6v6h-6z",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  route:
    "M6 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6M18 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6M9 6h8a4 4 0 0 1 0 8H7a4 4 0 0 0 0 8M15 18H7",
  report: "M6 3h12v18H6zM9 7h6M9 11h6M9 15h4",
  shield: "M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7zM8 12l3 3 5-6",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  calendar: "M4 5h16v16H4zM8 2v6M16 2v6M4 10h16",
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  pin: "M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 6v6l4 2",
  arrow: "M22 2 9 15M22 2l-7 20-6-7-7-6z",
  activity: "M2 12h5l3-9 4 18 3-9h5",
  money: "M2 5h20v14H2zM8 12h8M5 8h1M18 16h1M12 8v8",
  download: "M12 3v12M7 10l5 5 5-5M4 15v6h16v-6",
  warning: "M12 3 2 21h20zM12 9v5M12 17v1",
  close: "M6 6l12 12M18 6 6 18",
  chevron: "M9 5l7 7-7 7",
  logout: "M9 3H3v18h6M9 12h12M16 7l5 5-5 5",
};
function Glyph({ name, size = 17 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.report} />
    </svg>
  );
}
function Pill({
  children,
  tone = "",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`aa-pill ${tone}`}>{children}</span>;
}
function Panel({
  title,
  sub,
  tag,
  children,
}: {
  title: string;
  sub?: string;
  tag?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="aa-panel">
      <div className="aa-panelhead">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {tag}
      </div>
      {children}
    </section>
  );
}
type Stat = {
  label: string;
  value: string | number;
  note: string;
  icon: string;
  tone?: string;
};
function Stats({ items }: { items: Stat[] }) {
  return (
    <div className="aa-stats">
      {items.map((item) => (
        <div key={item.label} className={`aa-stat ${item.tone || ""}`}>
          <div className="aa-statlabel">{item.label}</div>
          <span className="aa-stat-icon">
            <Glyph name={item.icon} />
          </span>
          <div className="aa-statvalue">{item.value}</div>
          <div className="aa-statnote">{item.note}</div>
        </div>
      ))}
    </div>
  );
}
function Meter({
  label,
  value,
  total,
  color = "#08634d",
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
}) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="aa-meter">
      <div className="aa-meterhead">
        <span>{label}</span>
        <b>
          {value} · {percent}%
        </b>
      </div>
      <div className="aa-track">
        <div style={{ width: `${percent}%`, background: color }} />
      </div>
    </div>
  );
}
function Empty({
  children = "No records yet.",
}: {
  children?: React.ReactNode;
}) {
  return <div className="aa-empty">{children}</div>;
}
function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="aa-search">
      <Glyph name="search" size={15} />
      <input
        aria-label={placeholder}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
const currency = (value: number) =>
  `₱${value.toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;
const shortId = (id: string) => id.slice(0, 12).toUpperCase();
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
const terminalStatus = (status: string) =>
  status === "Completed" ? "" : status === "Cancelled" ? "red" : "blue";
function departureTime(
  route: AdminDashboardProps["data"]["routes"][number],
  now: Date,
) {
  const [sh, sm] = route.startsAt.split(":").map(Number);
  const [eh, em] = route.endsAt.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const current = now.getHours() * 60 + now.getMinutes();
  const next = Math.max(
    start,
    start +
      Math.ceil((current - start) / Math.max(1, route.interval)) *
        Math.max(1, route.interval),
  );
  return next <= end
    ? `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`
    : "Tomorrow";
}
export default function AdminDashboard({
  data,
  busy,
  connected,
  notice,
  dismissNotice,
  action,
  logout,
}: AdminDashboardProps) {
  const params = useLocalSearchParams<{ screen?: string }>();
  const oldPages: Record<string, string> = {
    Manage: "Routes & terminals",
    "My trips": "Trips & reports",
    Reports: "Trips & reports",
    Activity: "System monitor",
  };
  const page = pages.includes(params.screen || "")
    ? params.screen!
    : oldPages[params.screen || ""] || "Overview";
  const pageIndex = pages.indexOf(page);
  const [search, setSearch] = useState("");
  const [peopleTab, setPeopleTab] = useState("Drivers");
  const [routeTab, setRouteTab] = useState("Routes");
  const [modal, setModal] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tripStatus, setTripStatus] = useState("All statuses");
  const [tripDate, setTripDate] = useState("");

  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modal) {
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModal(null);
      }
      if (event.key !== "Tab") {
        return;
      }
      const elements = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input,select,textarea,[tabindex="0"],a[href]',
      );
      if (!elements?.length) {
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [modal]);
  const go = (next: string) => {
    router.setParams({ screen: next });
    setSearch("");
  };
  const open = (kind: string, id?: string) => {
    setSelectedId(id || null);
    setModal(kind);
  };
  const now = new Date(data.serverTime);
  const today = now.toLocaleDateString("en-CA");
  const isToday = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA") === today;
  const drivers = data.users.filter((u) => u.role.includes("driver"));
  const commuters = data.users.filter((u) => u.role === "Passenger");
  const pending = drivers.filter((u) => !u.verified);
  const online = drivers.filter(
    (u) =>
      u.available &&
      u.verified &&
      u.location &&
      data.serverTime - u.location.updatedAt <= 60000,
  );
  const active = data.trips.filter(
    (t) => !["Completed", "Cancelled"].includes(t.status),
  );
  const todays = data.trips.filter((t) => isToday(t.createdAt));
  const completed = todays.filter((t) => t.status === "Completed");
  const openReports = data.reports.filter((r) => r.status !== "resolved");
  const stale = data.vehicles.filter((v) => v.stale);
  const live = data.vehicles.filter((v) => !v.stale);
  const routes = data.routes.filter((r) => r.active);
  const terminals = data.terminals.filter((t) => t.active);
  const associations = [
    ...new Set(drivers.map((u) => u.association).filter(Boolean)),
  ];
  const selectedUser = data.users.find((u) => u.id === selectedId);
  const selectedTrip = data.trips.find((t) => t.id === selectedId);
  const unread = data.notifications.filter((n) => !n.read).length;
  const people = (peopleTab === "Commuters" ? commuters : drivers).filter((u) =>
    `${u.name} ${u.email} ${u.plate} ${u.association}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredTrips = data.trips.filter(
    (t) =>
      (tripStatus === "All statuses" || t.status === tripStatus) &&
      (!tripDate ||
        new Date(t.createdAt).toLocaleDateString("en-CA") === tripDate) &&
      `${t.id} ${t.passenger} ${t.driver || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const depart = routes
    .map((r) => ({ route: r, time: departureTime(r, now) }))
    .sort((a, b) => a.time.localeCompare(b.time));
  const waits = todays
    .filter((t) => t.timestamps.Accepted)
    .map((t) =>
      Math.max(0, t.timestamps.Accepted! - new Date(t.createdAt).getTime()),
    );
  const averageWait = waits.length
    ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length / 1000)
    : null;
  const stats: Stat[][] = [
    [
      {
        label: "Active trips",
        value: active.length,
        note: "Live transport operations",
        icon: "arrow",
      },
      {
        label: "Available drivers",
        value: online.length,
        note: "Verified · GPS within 60 sec",
        icon: "people",
        tone: "blue",
      },
      {
        label: "Today's bookings",
        value: todays.length,
        note: `${todays.length ? Math.round((completed.length / todays.length) * 100) : 0}% completion rate`,
        icon: "route",
        tone: "amber",
      },
      {
        label: "Location alerts",
        value: stale.length,
        note: `${stale.length} outdated positions`,
        icon: "pin",
        tone: "red",
      },
    ],
    [
      {
        label: "Active drivers",
        value: drivers.length,
        note: `${online.length} currently online`,
        icon: "people",
      },
      {
        label: "Registered commuters",
        value: commuters.length.toLocaleString(),
        note: "Registered passenger accounts",
        icon: "people",
        tone: "blue",
      },
      {
        label: "Pending review",
        value: pending.length,
        note: "Driver applications to verify",
        icon: "report",
        tone: "amber",
      },
      {
        label: "Expiring documents",
        value: data.sampleMetrics?.expiringDocuments ?? "—",
        note: "Sample documents due within 30 days",
        icon: "shield",
        tone: "red",
      },
    ],
    [
      {
        label: "Active routes",
        value: routes.length,
        note: `${data.routes.length} configured corridors`,
        icon: "route",
      },
      {
        label: "Terminals",
        value: terminals.length,
        note: "Active pickup locations",
        icon: "overview",
        tone: "blue",
      },
      {
        label: "Scheduled departures",
        value: routes.reduce((sum, r) => {
          const m = (v: string) => {
            const [h, min] = v.split(":").map(Number);
            return h * 60 + min;
          };
          return (
            sum +
            Math.max(
              0,
              Math.floor(
                (m(r.endsAt) - m(r.startsAt)) / Math.max(1, r.interval),
              ) + 1,
            )
          );
        }, 0),
        note: "Daily configured intervals",
        icon: "calendar",
        tone: "amber",
      },
      {
        label: "Fare rules",
        value: 1 + data.routes.length,
        note: `${(data.fareApproved ? 0 : 1) + data.routes.filter((r) => !r.approved).length} unapproved examples`,
        icon: "money",
        tone: "red",
      },
    ],
    [
      {
        label: "Trips today",
        value: todays.length.toLocaleString(),
        note: `${completed.length} completed`,
        icon: "route",
      },
      {
        label: "Collected fares",
        value: currency(completed.reduce((s, t) => s + t.fare, 0)),
        note: "Recorded completed cash fares",
        icon: "money",
        tone: "blue",
      },
      {
        label: "Average wait",
        value:
          averageWait === null
            ? "—"
            : `${Math.floor(averageWait / 60)}m ${averageWait % 60}s`,
        note: "Booking to driver acceptance",
        icon: "clock",
        tone: "amber",
      },
      {
        label: "Exceptions",
        value:
          openReports.length +
          todays.filter((t) => t.status === "Cancelled").length,
        note: `${todays.filter((t) => t.status === "Cancelled").length} cancelled · ${openReports.length} open reports`,
        icon: "warning",
        tone: "red",
      },
    ],
    [
      {
        label: "System uptime",
        value: data.sampleMetrics
          ? `${data.sampleMetrics.uptimePercent}%`
          : "—",
        note: "Sample availability · illustrative only",
        icon: "activity",
      },
      {
        label: "API response",
        value: data.sampleMetrics ? `${data.sampleMetrics.responseMs} ms` : "—",
        note: "Sample response time · no live request",
        icon: "activity",
        tone: "blue",
      },
      {
        label: "GPS freshness",
        value: data.vehicles.length
          ? `${Math.round((live.length / data.vehicles.length) * 100)}%`
          : "—",
        note: "Updated within 60 sec",
        icon: "arrow",
        tone: "amber",
      },
      {
        label: "Open incidents",
        value: openReports.length,
        note: "Unresolved user reports",
        icon: "shield",
        tone: "red",
      },
    ],
  ];
  function exportTrips() {
    const cell = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(text)) {
        text = `'${text}`;
      }
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [
      [
        "Trip ID",
        "Date",
        "Passenger",
        "Driver",
        "Pickup",
        "Destination",
        "Fare PHP",
        "Status",
      ],
      ...filteredTrips.map((t) => [
        t.id,
        t.createdAt,
        t.passenger,
        t.driver,
        t.pickup,
        t.destination,
        t.fare,
        t.status,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `angkol-trips-${today}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function tripTable(trips: Trip[]) {
    return (
      <div className="aa-tablewrap">
        <table className="aa-table">
          <thead>
            <tr>
              {[
                "Trip ID",
                "Passenger",
                "Driver / unit",
                "Route",
                "Fare",
                "Status",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trips.slice(0, 50).map((t) => (
              <tr
                key={t.id}
                data-clickable
                onClick={() => open("Trip details", t.id)}
              >
                <td>
                  <button
                    className="aa-button plain"
                    style={{ fontSize: 9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      open("Trip details", t.id);
                    }}
                  >
                    {shortId(t.id)}
                  </button>
                </td>
                <td>
                  <strong>{t.passenger}</strong>
                </td>
                <td>
                  {t.driver || "Awaiting driver"}
                  <br />
                  <small>{t.plate}</small>
                </td>
                <td
                  style={{
                    maxWidth: 180,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={`${t.pickup} → ${t.destination}`}
                >
                  {t.pickup} → {t.destination}
                </td>
                <td>
                  <strong>{currency(t.fare)}</strong>
                </td>
                <td>
                  <Pill tone={terminalStatus(t.status)}>{t.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!trips.length && (
          <Empty>
            No trips match this view. New mobile bookings will appear here.
          </Empty>
        )}
        {trips.length > 50 && (
          <p className="aa-muted">
            Showing the first 50 records. Export CSV includes all matching
            records.
          </p>
        )}
      </div>
    );
  }
  function schedule(limit = 4) {
    return depart.slice(0, limit).map(({ route, time }) => (
      <div className="aa-schedule" key={route.id}>
        <time>{time}</time>
        <div>
          <strong>{route.name}</strong>
          <small>
            {route.id} · Every {route.interval} min
          </small>
        </div>
        <Pill tone={route.approved ? "" : "amber"}>
          {route.approved ? "Scheduled" : "Sample"}
        </Pill>
      </div>
    ));
  }
  let content: React.ReactNode;
  if (page === "Overview") {
    const hours = Array.from(
      { length: 12 },
      (_, i) => Math.max(0, now.getHours() - 11) + i,
    );
    const counts = hours.map(
      (h) =>
        todays.filter((t) => new Date(t.createdAt).getHours() === h).length,
    );
    const max = Math.max(1, ...counts);
    content = (
      <>
        <div className="aa-grid equal">
          <Panel
            title="Live trip map"
            sub="Tricycles and PUVs reporting in the last 60 sec"
            tag={<Pill>● Live</Pill>}
          >
            <div className="aa-map">
              <CalbayogMap
                vehicles={data.vehicles}
                landmarks={data.landmarks}
                terminals={terminals}
                stops={data.stopRequests}
              />
            </div>
          </Panel>
          <Panel
            title="Trips by hour"
            sub="Bookings created today"
            tag={<Pill tone="gray">Today</Pill>}
          >
            <div className="aa-chart">
              {hours.map((h, i) => (
                <div
                  className="aa-barcol"
                  key={h}
                  title={`${h}:00 · ${counts[i]} bookings`}
                >
                  <div
                    className="aa-bar"
                    style={{ height: `${(counts[i] / max) * 90}%` }}
                  />
                  <span>{h}</span>
                </div>
              ))}
            </div>
            {!todays.length && (
              <p className="aa-muted">No bookings recorded today.</p>
            )}
          </Panel>
        </div>
        <div className="aa-grid equal">
          <Panel
            title="Upcoming terminal departures"
            tag={
              <button
                className="aa-button plain"
                onClick={() => go("Routes & terminals")}
              >
                Manage schedules
              </button>
            }
          >
            {schedule()}
            {!depart.length && <Empty>No active schedules configured.</Empty>}
          </Panel>
          <Panel
            title="Needs attention"
            tag={
              <Pill tone="red">
                {pending.length + stale.length + openReports.length} alerts
              </Pill>
            }
          >
            <div className="aa-list">
              {[
                {
                  label: "Driver locations stale",
                  detail: `${stale.length} drivers over 60 seconds`,
                  count: stale.length,
                  page: "System monitor",
                },
                {
                  label: "Driver verification pending",
                  detail: `${pending.length} applications need review`,
                  count: pending.length,
                  page: "People",
                },
                {
                  label: "Unresolved reports",
                  detail: `${openReports.length} reports need attention`,
                  count: openReports.length,
                  page: "Trips & reports",
                },
              ].map((item) => (
                <button
                  className="aa-listitem"
                  key={item.label}
                  onClick={() => go(item.page)}
                >
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <Glyph name="chevron" size={14} />
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </>
    );
  } else if (page === "People") {
    content = (
      <>
        <div className="aa-toolbar">
          <div className="aa-tabs">
            {[
              ["Drivers", drivers.length],
              ["Commuters", commuters.length],
              ["Associations", associations.length],
            ].map(([label, count]) => (
              <button
                key={label}
                className={`aa-pill ${peopleTab === label ? "" : "gray"}`}
                onClick={() => setPeopleTab(String(label))}
              >
                {label} · {count}
              </button>
            ))}
          </div>
          <div className="aa-controls">
            <Search
              value={search}
              onChange={setSearch}
              placeholder="Search name, ID, plate…"
            />
            <button className="aa-button" onClick={() => open("Add driver")}>
              <Glyph name="people" />
              Add driver
            </button>
          </div>
        </div>
        <div className="aa-grid split">
          <Panel
            title={peopleTab === "Associations" ? "Transport associations" : ""}
          >
            {peopleTab === "Associations" ? (
              <div className="aa-list">
                {associations
                  .filter((a) => a.toLowerCase().includes(search.toLowerCase()))
                  .map((a) => (
                    <div className="aa-listitem" key={a}>
                      <strong>{a}</strong>
                      <Pill>
                        {drivers.filter((u) => u.association === a).length}{" "}
                        drivers
                      </Pill>
                    </div>
                  ))}
                {!associations.length && (
                  <Empty>
                    Association records appear when drivers register.
                  </Empty>
                )}
              </div>
            ) : (
              <div className="aa-tablewrap">
                <table className="aa-table">
                  <thead>
                    <tr>
                      {[
                        peopleTab === "Drivers" ? "Driver" : "Commuter",
                        "Type",
                        "Association / unit",
                        "Verification",
                        "Status",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((u) => (
                      <tr
                        key={u.id}
                        data-clickable
                        onClick={() => open("Person details", u.id)}
                      >
                        <td>
                          <button
                            className="aa-button plain aa-person"
                            style={{ textAlign: "left" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              open("Person details", u.id);
                            }}
                          >
                            <span className="aa-avatar">
                              {initials(u.name)}
                            </span>
                            <span>
                              <b>{u.name}</b>
                              <small>{shortId(u.id)}</small>
                            </span>
                          </button>
                        </td>
                        <td>
                          {u.role === "Tricycle driver"
                            ? "Tricycle"
                            : u.role === "Passenger"
                              ? "Commuter"
                              : "PUJ / PUV driver"}
                        </td>
                        <td>
                          {u.association || "—"}
                          <br />
                          {u.plate}
                        </td>
                        <td>
                          <Pill
                            tone={
                              u.role === "Passenger"
                                ? "gray"
                                : u.verified
                                  ? ""
                                  : "amber"
                            }
                          >
                            {u.role === "Passenger"
                              ? "Registered"
                              : u.verified
                                ? "Verified"
                                : "Pending"}
                          </Pill>
                        </td>
                        <td>
                          <span
                            className={
                              online.some((d) => d.id === u.id)
                                ? "aa-online"
                                : "aa-offline"
                            }
                          >
                            {online.some((d) => d.id === u.id)
                              ? "Online"
                              : "Offline"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!people.length && (
                  <Empty>
                    No matching accounts. Registered mobile users will appear
                    here.
                  </Empty>
                )}
              </div>
            )}
          </Panel>
          <Panel
            title="Verification queue"
            tag={<Pill tone="amber">{pending.length}</Pill>}
          >
            <div className="aa-list">
              {pending.slice(0, 5).map((u) => (
                <button
                  className="aa-listitem"
                  key={u.id}
                  onClick={() => open("Person details", u.id)}
                >
                  <span>
                    <strong>{u.name}</strong>
                    <small>New driver application</small>
                    <small style={{ color: "#dfaa4d" }}>
                      {u.association || "Association not supplied"}
                    </small>
                  </span>
                  <Glyph name="chevron" size={13} />
                </button>
              ))}
              {!pending.length && (
                <Empty>No applications awaiting review.</Empty>
              )}
            </div>
            <div className="aa-policy">
              <strong>
                <Glyph name="shield" size={13} />
                Verification policy
              </strong>
              Match ID, license, association roster, and vehicle franchise
              before approval.
            </div>
          </Panel>
        </div>
      </>
    );
  } else if (page === "Routes & terminals") {
    content = (
      <>
        <div className="aa-toolbar">
          <div className="aa-tabs">
            {["Routes", "Terminals", "Fares"].map((tab) => (
              <button
                className={`aa-pill ${routeTab === tab ? "" : "gray"}`}
                key={tab}
                onClick={() => setRouteTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <button
            className="aa-button"
            onClick={() => open("Transport configuration")}
          >
            <Glyph name="plus" />
            {routeTab === "Terminals"
              ? "Create terminal"
              : routeTab === "Fares"
                ? "Edit fare rules"
                : "Create route"}
          </button>
        </div>
        {routeTab !== "Fares" && (
          <div className="aa-grid routes">
            <Panel
              title={
                routeTab === "Routes" ? "Route registry" : "Terminal registry"
              }
              sub="Published routes visible to commuters"
              tag={
                <Pill tone="gray">
                  {routeTab === "Routes"
                    ? data.routes.length
                    : data.terminals.length}{" "}
                  total
                </Pill>
              }
            >
              <div className="aa-tablewrap">
                <table className="aa-table">
                  <thead>
                    <tr>
                      {(routeTab === "Routes"
                        ? ["Code", "Route", "Stops", "Base fare", "Status"]
                        : ["Code", "Terminal", "Route", "Status", ""]
                      ).map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {routeTab === "Routes"
                      ? data.routes.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button
                                className="aa-pill"
                                onClick={() => open("Transport configuration")}
                              >
                                {r.id}
                              </button>
                            </td>
                            <td>
                              <strong>{r.name}</strong>
                            </td>
                            <td>{r.stops.length} stops</td>
                            <td>
                              <strong>{currency(r.fare)}</strong>
                            </td>
                            <td>
                              <Pill
                                tone={
                                  !r.active ? "gray" : r.approved ? "" : "amber"
                                }
                              >
                                {!r.active
                                  ? "Inactive"
                                  : r.approved
                                    ? "Active"
                                    : "Sample"}
                              </Pill>
                            </td>
                          </tr>
                        ))
                      : data.terminals.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <button
                                className="aa-pill"
                                onClick={() => open("Transport configuration")}
                              >
                                {t.id}
                              </button>
                            </td>
                            <td>
                              <strong>{t.name}</strong>
                            </td>
                            <td>{t.routeId}</td>
                            <td>
                              <Pill tone={t.active ? "" : "gray"}>
                                {t.active ? "Active" : "Inactive"}
                              </Pill>
                            </td>
                            <td>
                              <button
                                className="aa-button plain"
                                onClick={() => open("Transport configuration")}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
                {!(routeTab === "Routes"
                  ? data.routes.length
                  : data.terminals.length) && (
                  <Empty>No records configured.</Empty>
                )}
              </div>
            </Panel>
            <Panel
              title={terminals[0]?.name || "Calbayog transport terminals"}
              tag={
                <button
                  className="aa-button plain"
                  aria-label="Manage terminals"
                  onClick={() => open("Transport configuration")}
                >
                  •••
                </button>
              }
            >
              <div className="aa-controls" style={{ marginBottom: 10 }}>
                <Pill tone="blue">{terminals[0]?.id || "No terminal"}</Pill>
                <Pill tone="gray">{terminals.length} active locations</Pill>
              </div>
              {schedule()}
              {!depart.length && <Empty>No departures scheduled.</Empty>}
            </Panel>
          </div>
        )}
        <Panel
          title="LGU and terminal fare configuration"
          sub="Published amounts appear in rider and driver apps before confirmation."
          tag={
            <button
              className="aa-button light"
              onClick={() => open("Transport configuration")}
            >
              <Glyph name="plus" />
              Edit fare rules
            </button>
          }
        >
          <div className="aa-fares">
            <button
              className="aa-fare"
              onClick={() => open("Transport configuration")}
            >
              <strong>Tricycle · Base fare</strong>
              <b>{currency(data.baseFare)}</b>
              <small>First kilometer</small>
              <small>
                {data.fareApproved
                  ? data.fareReference
                  : "Unapproved sample fare"}
              </small>
            </button>
            <button
              className="aa-fare"
              onClick={() => open("Transport configuration")}
            >
              <strong>Tricycle · Additional distance</strong>
              <b>{currency(data.perKm)}</b>
              <small>Per additional kilometer</small>
              <small>
                {data.fareApproved
                  ? data.fareReference
                  : "Unapproved sample fare"}
              </small>
            </button>
            {data.routes.map((r) => (
              <button
                className="aa-fare"
                key={r.id}
                onClick={() => open("Transport configuration")}
              >
                <strong>{r.id} · Minimum fare</strong>
                <b>{currency(r.fare)}</b>
                <small>{r.name}</small>
                <small>
                  {r.approved ? r.reference : "Unapproved sample fare"}
                </small>
              </button>
            ))}
          </div>
        </Panel>
      </>
    );
  } else if (page === "Trips & reports") {
    content = (
      <>
        <div className="aa-toolbar">
          <div className="aa-controls">
            <input
              className="aa-select"
              type="date"
              aria-label="Filter trip date"
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
            />
            <select
              className="aa-select"
              aria-label="Trip status"
              value={tripStatus}
              onChange={(e) => setTripStatus(e.target.value)}
            >
              {[
                "All statuses",
                "Requested",
                "Accepted",
                "Arrived",
                "In progress",
                "Completed",
                "Cancelled",
              ].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <Pill>
              <Glyph name="pin" size={12} />
              Calbayog City
            </Pill>
          </div>
          <div className="aa-controls">
            <button
              className="aa-button light"
              onClick={() => open("User reports")}
            >
              <Glyph name="report" />
              Review reports
            </button>
            <button className="aa-button" onClick={exportTrips}>
              <Glyph name="download" />
              Export CSV
            </button>
          </div>
        </div>
        <div className="aa-grid split">
          <Panel
            title="Recent trip records"
            sub={`${filteredTrips.length} matching records`}
            tag={
              <Search
                value={search}
                onChange={setSearch}
                placeholder="Trip ID or passenger…"
              />
            }
          >
            {tripTable(filteredTrips)}
          </Panel>
          <div className="aa-list">
            <Panel title="Trips by mode" tag={<Pill tone="gray">Today</Pill>}>
              <Meter
                label="Tricycle"
                value={todays.length}
                total={todays.length}
              />
              <Meter
                label="PUJ / PUV"
                value={0}
                total={todays.length}
                color="#2d8bcc"
              />
              <p className="aa-muted">
                PUJ/PUV pickup requests are tracked separately from booked
                tricycle trips.
              </p>
            </Panel>
            <Panel
              title="User reports"
              tag={
                <button
                  className="aa-button plain"
                  aria-label="Open reports"
                  onClick={() => open("User reports")}
                >
                  <Glyph name="plus" size={16} />
                </button>
              }
            >
              <div className="aa-list">
                {data.reports.slice(0, 3).map((r) => (
                  <button
                    className="aa-listitem"
                    key={r.id}
                    onClick={() => open("User reports")}
                  >
                    <span>
                      <strong>{r.details.slice(0, 50)}</strong>
                      <small>
                        {r.reporter} · {r.status}
                      </small>
                    </span>
                    <Glyph name="report" size={14} />
                  </button>
                ))}
                {!data.reports.length && <Empty>No reports submitted.</Empty>}
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  } else {
    const staleShort = stale.filter(
      (v) => data.serverTime - v.location.updatedAt <= 300000,
    );
    const staleLong = stale.filter(
      (v) => data.serverTime - v.location.updatedAt > 300000,
    );
    content = (
      <>
        <div className="aa-grid routes">
          <Panel
            title="Service health"
            sub="Illustrative sample status for the standalone prototype"
            tag={
              <Pill tone={connected ? "" : "red"}>
                {connected ? "● Sample data loaded" : "Connection lost"}
              </Pill>
            }
          >
            {[
              {
                label: "Authentication & session",
                detail: "Sample administrator session",
                good: true,
              },
              {
                label: "Local sample data",
                detail: connected ? "Connected" : "Unavailable",
                good: connected,
              },
              {
                label: "Driver location freshness",
                detail: stale.length
                  ? `${stale.length} stale`
                  : data.vehicles.length
                    ? "Fresh"
                    : "No positions",
                good: !stale.length,
              },
              {
                label: "Routes & schedules",
                detail: `${routes.length} active routes`,
                good: true,
              },
              {
                label: "Notifications",
                detail: `${unread} unread`,
                good: true,
              },
            ].map((row) => (
              <div className="aa-statusrow" key={row.label}>
                <span>
                  <span style={{ color: row.good ? "#087154" : "#efaa43" }}>
                    ●
                  </span>{" "}
                  &nbsp;{row.label}
                </span>
                <Pill tone={row.good ? "" : "amber"}>{row.detail}</Pill>
              </div>
            ))}
          </Panel>
          <Panel
            title="Driver location freshness"
            tag={<Pill tone="gray">{data.vehicles.length} positions</Pill>}
          >
            <Meter
              label="Live · < 60 sec"
              value={live.length}
              total={data.vehicles.length}
            />
            <Meter
              label="Stale · 1–5 min"
              value={staleShort.length}
              total={data.vehicles.length}
              color="#efa53e"
            />
            <Meter
              label="Offline · > 5 min"
              value={staleLong.length}
              total={data.vehicles.length}
              color="#e87964"
            />
            <div className="aa-policy amber">
              <strong>
                <Glyph name="clock" size={13} />
                Location freshness
              </strong>
              Rider apps show a timestamp and last known position when GPS is
              stale.
            </div>
          </Panel>
        </div>
        <Panel
          title="Audit trail"
          sub="Recorded administrative and automated actions"
          tag={<Pill tone="gray">Latest {data.logs.length}</Pill>}
        >
          <div className="aa-tablewrap">
            <table className="aa-table">
              <thead>
                <tr>
                  {["Time", "Actor", "Action", "Event"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log, i) => {
                  const actorId = (log as typeof log & { actor_id?: string })
                    .actor_id;
                  return (
                    <tr key={log.id || i}>
                      <td>
                        {new Date(log.at).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                          hour12: false,
                        })}
                      </td>
                      <td>
                        {data.users.find((u) => u.id === actorId)?.name ||
                          (actorId ? shortId(actorId) : "System")}
                      </td>
                      <td>
                        <strong>{log.action}</strong>
                      </td>
                      <td>
                        <Pill tone="gray">
                          {log.action.toLowerCase().replaceAll(" ", ".")}
                        </Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!data.logs.length && <Empty>No audit events recorded.</Empty>}
          </div>
        </Panel>
      </>
    );
  }
  return (
    <div className="angkol-admin">
      <style>{adminDashboardStyles}</style>
      <aside className="aa-sidebar">
        <div className="aa-brand">
          <span className="aa-brandmark">
            <Glyph name="report" size={20} />
          </span>
          Angkol
        </div>
        <nav className="aa-nav" aria-label="Administrator navigation">
          {pages.map((name, i) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              onClick={() => go(name)}
            >
              <Glyph
                name={["overview", "people", "route", "report", "shield"][i]}
              />
              {name}
            </button>
          ))}
        </nav>
        <button className="aa-user" onClick={() => open("Your account")}>
          <span className="aa-avatar">{initials(data.user.name)}</span>
          <span>
            <b>{data.user.name}</b>
            <small>City transport admin</small>
          </span>
        </button>
      </aside>
      <main className="aa-main">
        <div className="aa-inner">
          <header className="aa-header">
            <div>
              <h1>{titles[pageIndex]}</h1>
              <p>{subtitles[pageIndex]}</p>
            </div>
            <div className="aa-headtools">
              <span className="aa-date">
                <Glyph name="calendar" size={13} />
                {now.toLocaleDateString("en-PH", {
                  timeZone: "Asia/Manila",
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <button
                className="aa-iconbutton"
                aria-label={`Notifications, ${unread} unread`}
                onClick={() => open("Notifications")}
              >
                <Glyph name="bell" />
                {unread > 0 && <span className="aa-dot" />}
              </button>
            </div>
          </header>
          {(!connected || notice) && (
            <div className="aa-alert" role="status">
              <span>
                {notice || "Connection lost. Showing last synced records."}
              </span>
              {notice && (
                <button aria-label="Dismiss message" onClick={dismissNotice}>
                  <Glyph name="close" size={16} />
                </button>
              )}
            </div>
          )}
          <Stats items={stats[pageIndex]} />
          {content}
        </div>
      </main>
      {modal && (
        <div
          className="aa-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModal(null);
            }
          }}
        >
          <div
            className="aa-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aa-dialog-title"
            tabIndex={-1}
            ref={dialog}
          >
            <div className="aa-dialoghead">
              <h2 id="aa-dialog-title">{modal}</h2>
              <button
                className="aa-iconbutton"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <Glyph name="close" />
              </button>
            </div>
            {modal === "Transport configuration" && (
              <AdminPanel data={data} busy={busy} action={action} />
            )}
            {modal === "Add driver" && (
              <>
                <p>
                  Drivers create their own account in the Angkol mobile app and
                  submit their license, vehicle, and association details.
                </p>
                <p>
                  Once registered, their application appears in this page’s
                  verification queue. Select an application to review it and
                  grant approval.
                </p>
                <button
                  className="aa-button"
                  onClick={() => {
                    setModal(null);
                    setPeopleTab("Drivers");
                  }}
                >
                  View driver applications
                </button>
              </>
            )}
            {modal === "Person details" && selectedUser && (
              <>
                <dl>
                  {[
                    ["Full name", selectedUser.name],
                    ["Email", selectedUser.email],
                    ["Contact", selectedUser.phone || "—"],
                    ["Account type", selectedUser.role],
                    ["License", selectedUser.license || "—"],
                    ["Association", selectedUser.association || "—"],
                    ["Plate / body no.", selectedUser.plate || "—"],
                    ["Capacity", selectedUser.capacity || "—"],
                  ].map(([label, value]) => (
                    <React.Fragment key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
                {selectedUser.role.includes("driver") && (
                  <div className="aa-formstack">
                    <button
                      className="aa-button"
                      disabled={busy}
                      onClick={() =>
                        action(
                          `/drivers/${selectedUser.id}`,
                          { verified: !selectedUser.verified },
                          "PATCH",
                        )
                      }
                    >
                      {selectedUser.verified
                        ? "Revoke approval"
                        : "Approve driver"}
                    </button>
                    {selectedUser.role === "PUJ / PUV driver" && (
                      <label>
                        Assigned route{" "}
                        <select
                          className="aa-select"
                          value={selectedUser.routeId || ""}
                          disabled={busy}
                          onChange={(e) =>
                            action(
                              `/drivers/${selectedUser.id}`,
                              {
                                verified: selectedUser.verified,
                                routeId: e.target.value || null,
                              },
                              "PATCH",
                            )
                          }
                        >
                          <option value="">No route assigned</option>
                          {routes.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                )}
              </>
            )}
            {modal === "Trip details" && selectedTrip && (
              <>
                <dl>
                  {[
                    ["Trip ID", selectedTrip.id],
                    ["Passenger", selectedTrip.passenger],
                    ["Driver", selectedTrip.driver || "Awaiting assignment"],
                    ["Pickup", selectedTrip.pickup],
                    ["Destination", selectedTrip.destination],
                    ["Fixed fare", currency(selectedTrip.fare)],
                    ["Status", selectedTrip.status],
                    [
                      "Created",
                      new Date(selectedTrip.createdAt).toLocaleString("en-PH", {
                        timeZone: "Asia/Manila",
                      }),
                    ],
                  ].map(([label, value]) => (
                    <React.Fragment key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
                <CalbayogMap
                  pickup={selectedTrip.pickupPoint}
                  destination={selectedTrip.destinationPoint}
                  geometry={selectedTrip.geometry}
                  vehicles={data.vehicles}
                />
              </>
            )}
            {modal === "User reports" && (
              <>
                {data.reports.map((r) => (
                  <div className="aa-modal-list" key={r.id}>
                    <p>{r.details}</p>
                    <div className="aa-toolbar">
                      <span className="aa-muted">
                        {r.reporter} ·{" "}
                        {new Date(r.createdAt).toLocaleDateString("en-PH")}
                      </span>
                      <select
                        aria-label={`Report status for ${r.reporter}`}
                        className="aa-select"
                        value={r.status}
                        disabled={busy}
                        onChange={(e) =>
                          action(
                            `/reports/${r.id}`,
                            { status: e.target.value },
                            "PATCH",
                          )
                        }
                      >
                        {["open", "reviewing", "resolved"].map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
                {!data.reports.length && <Empty>No reports submitted.</Empty>}
              </>
            )}
            {modal === "Notifications" && (
              <>
                <button
                  className="aa-button light"
                  disabled={busy || !unread}
                  onClick={() => action("/notifications/read", {})}
                >
                  Mark all as read
                </button>
                <div style={{ marginTop: 18 }}>
                  {data.notifications.map((n) => (
                    <div className="aa-modal-list" key={n.id}>
                      <p style={{ fontWeight: n.read ? 400 : 600 }}>
                        {n.message}
                      </p>
                      <span className="aa-muted">
                        {new Date(n.createdAt).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                        })}
                      </span>
                    </div>
                  ))}
                  {!data.notifications.length && (
                    <Empty>You’re all caught up.</Empty>
                  )}
                </div>
              </>
            )}
            {modal === "Your account" && (
              <Account
                user={data.user}
                busy={busy}
                action={action}
                logout={logout}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function Account({
  user,
  busy,
  action,
  logout,
}: { user: User } & Pick<AdminDashboardProps, "busy" | "action" | "logout">) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  return (
    <div className="aa-formstack">
      <p>{user.email} · Administrator</p>
      <label>
        Display name{" "}
        <input
          className="aa-select"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Contact number{" "}
        <input
          className="aa-select"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      <button
        className="aa-button"
        disabled={busy || !name.trim()}
        onClick={() => action("/profile", { name, phone }, "PATCH")}
      >
        Save profile
      </button>
      <button className="aa-button light" disabled={busy} onClick={logout}>
        <Glyph name="logout" />
        Sign out
      </button>
    </div>
  );
}
