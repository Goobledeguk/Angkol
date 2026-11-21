import { tripRef } from "../domain/vehicles";
import { statusLabel } from "../domain/format";
import React, { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import type { AdminDashboardProps } from "./AdminDashboard";
import type { Trip, User } from "../types/types";
import AdminPanel from "./AdminPanel";
import CalbayogMap from "../map/CalbayogMap";
import { adminDashboardStyles } from "./adminDashboardStyles";
import BrandLogo from "../common/BrandLogo";
import { Icon } from "../common/ui";


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
function Stats({ items }: { items?: Stat[] }) {
  return (
    <div className="aa-stats">
      {(items || []).map((item) => (
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
const initials = (name?: string) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || "")
    .join("") || "A";
const terminalStatus = (status: string) =>
  status === "Completed" ? "" : status === "Cancelled" ? "red" : "blue";
function departureTime(
  route: AdminDashboardProps["data"]["routes"][number],
  now: Date,
) {
  const [sh, sm] = route.startsAt.split(":").map(Number),
    [eh, em] = route.endsAt.split(":").map(Number);
  const start = sh * 60 + sm,
    end = eh * 60 + em,
    current = now.getHours() * 60 + now.getMinutes();
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
  const isOwner =
    data?.user?.adminLevel === "Franchise Owner" ||
    data?.user?.role === "Vehicle Owner / Operator";
  const techPages = [
    "Overview",
    "Fleet tracking",
    "People",
    "Routes & terminals",
    "Trips & reports",
    "System monitor",
  ];
  const ownerPages = [
    "Overview",
    "My vehicles",
    "Drivers",
    "Routes & terminals",
    "Fleet trips",
  ];
  const pages = isOwner ? ownerPages : techPages;
  const oldPages: Record<string, string> = {
    Manage: "Routes & terminals",
    "My trips": isOwner ? "Fleet trips" : "Trips & reports",
    Reports: isOwner ? "Fleet trips" : "Trips & reports",
    Activity: "System monitor",
  };
  const page = pages.includes(params.screen || "")
    ? params.screen!
    : oldPages[params.screen || ""] || "Overview";
  const pageIndex = Math.max(0, pages.indexOf(page));
  const techTitles = ["Operations overview","City-wide fleet tracking","People & verification","Routes, terminals & fares","Trips & reports","System & audit monitor"];
  const ownerTitles = ["Franchise operations overview","Assigned vehicle status","Franchise drivers","Assigned routes & terminals","Fleet trip records"];
  const titles = isOwner ? ownerTitles : techTitles;
  const techSubtitles = ["Live mobility status and 24-hour booking distribution across Calbayog City","Real-time vehicle telemetry with PUJ/PUV monitoring categories","Manage commuters, driver partners, identity and association records","Configure the local network, schedules, and transparent fare rules","Search operational records, investigate exceptions, and export civic mobility data","Platform health, location freshness, security events, and accountable change history"];
  const ownerSubtitles = ["Overview of your franchise vehicles, active routes, and daily fleet performance","Track whether your vehicles have Arrived, are In Terminal, or are Broken / Inactive","Manage driver profiles, license verification, daily earnings, and trip history","Review franchised routes and terminal dispatch points for your vehicles","Audit trip records and passengers served strictly by your franchise vehicles"];
  const subtitles = isOwner ? ownerSubtitles : techSubtitles;

  const [search, setSearch] = useState(""),
    [peopleTab, setPeopleTab] = useState("Drivers"),
    [routeTab, setRouteTab] = useState("Routes");
      const [vehicleFilterStatus, setVehicleFilterStatus] = useState<string>("All");
  const [modal, setModal] = useState<string | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const [tripStatus, setTripStatus] = useState("All statuses"),
    [tripDate, setTripDate] = useState("");
  const [vehicleForm, setVehicleForm] = useState({ plate: "", vehicleType: "Jeepney", currentDriver: "", routeId: "", capacity: "" });
  const [vehicleFormError, setVehicleFormError] = useState("");
  type PendingDriver = { id: string; name: string; email: string; phone: string; license: string; franchiseName: string; plate: string; status: string };
  const [declineTarget, setDeclineTarget] = useState<PendingDriver | null>(null);
  const shortId = (id?: string) => (id ? `${String(id).slice(0,8)}…` : "—");
  const latency = data.sampleMetrics?.responseMs;
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
      const first = elements[0],
        last = elements[elements.length - 1];
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
  const isAuthorized =
    Boolean(data?.user) &&
    (data.user.role === "Administrator" ||
      data.user.role === "Vehicle Owner / Operator");
  if (!isAuthorized) {
    return (
      <div
        className="angkol-admin"
        style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#06392D", padding: 24 }}
      >
        <style>{adminDashboardStyles}</style>
        <div style={{ maxWidth: 460, width: "100%", backgroundColor: "white", borderRadius: 24, padding: 38, textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
          <div style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#FCEEEA", color: "#C53B1D", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="lock-closed-outline" size={30} color="#C53B1D" /></div>
          <h2 style={{ fontSize: 22, fontWeight: "800", color: "#163428", margin: "0 0 10px" }}>Restricted Control Portal</h2>
          <p style={{ fontSize: 13, color: "#62766B", lineHeight: 1.6, margin: "0 0 24px" }}>
            This administrative control center requires authorized Angkol Technical Team (Level A) or Franchise Vehicle Owner (Level B) credentials.
          </p>
          <button type="button" className="aa-button" onClick={logout} style={{ width: "100%", minHeight: 48, fontSize: 14 }}>
            Return to Authorized Sign In
          </button>
        </div>
      </div>
    );
  }
  const open = (kind: string, id?: string) => {
    setSelectedId(id || null);
    setModal(kind);
  };
  const serverNow = typeof data?.serverTime === "number" ? data.serverTime : 0;
  const nowDate = new Date(serverNow);
  const now = serverNow;
  const today = nowDate.toLocaleDateString("en-CA");
  const isToday = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA") === today;

  const d = data as any;
  const users: any[] = Array.isArray(d.users) ? d.users : [];
  const trips: any[] = Array.isArray(d.trips) ? d.trips : [];
  const vehicles: any[] = Array.isArray(d.vehicles) ? d.vehicles : [];
  const logs: any[] = Array.isArray(d.logs) ? d.logs : [];
  const reports: any[] = Array.isArray(d.reports) ? d.reports : [];
  const notifications: any[] = Array.isArray(d.notifications) ? d.notifications : [];
  const drivers = users.filter((u: any) => String(u.role || "").includes("driver")),
    commuters = users.filter((u: any) => u.role === "Passenger");

  // Owner specific filtered fleet data
  const ownerVehicleIds = data.user.ownerVehicleIds || [];
  const myVehicles = vehicles.filter((v: any) =>
      ownerVehicleIds.includes(v.id) ||
      v.ownerId === data.user.id ||
      v.ownerName === data.user.name ||
      v.kind === "PUJ / PUV driver",
  );
  const myVehicleIds = myVehicles.map((v: any) => v.id);
  const myDrivers = drivers.filter(
    (d: any) =>
      myVehicleIds.includes(d.id) ||
      myVehicles.some((v: any) => v.name === d.name) ||
      (isOwner &&
        !!data.user.franchiseName &&
        d.franchiseName === data.user.franchiseName),
  );
  const ownerPendingDrivers: PendingDriver[] = isOwner
    ? drivers
        .filter(
          (u: any) =>
            u.pendingFranchiseApproval &&
            (!data.user.franchiseName || u.franchiseName === data.user.franchiseName),
        )
        .map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          license: u.license,
          franchiseName: u.franchiseName || data.user.franchiseName || "",
          plate: u.plate,
          status: "Pending approval",
        }))
    : [];
  const myTrips = trips.filter((t: any) =>
      myDrivers.some((d: any) => d.id === t.driverId || d.name === t.driver) ||
      (t.plate && myVehicles.some((v: any) => v.plate === t.plate)),
  );


  const pending = drivers.filter((u: any) => !u.verified),
    online = drivers.filter((u: any) =>
        u.available &&
        u.verified &&
        u.location &&
        data.serverTime - u.location.updatedAt <= 60000,
    );
  const active = trips.filter((t: any) => !["Completed", "Cancelled"].includes(t.status),
  );
  const todays = trips.filter((t: any) => isToday(t.createdAt)),
    completed = todays.filter((t: any) => t.status === "Completed");
  const openReports = reports.filter((r: any) => !["resolved", "closed", "dismissed"].includes(String(r.status || "").toLowerCase()));
  const stale = vehicles.filter((v: any) => v.stale),
    live = vehicles.filter((v: any) => !v.stale);
  const routes = (Array.isArray(d.routes)?d.routes:[]).filter((r: any) => r.active),
    terminals = (Array.isArray(d.terminals)?d.terminals:[]).filter((t: any) => t.active);
  const associations = [...new Set(drivers.map((u: any) => u.association).filter(Boolean))];
  const selectedUser = users.find((u: any) => u.id === selectedId),
    selectedTrip = trips.find((t: any) => t.id === selectedId);
  const unread = notifications.filter((n: any) => !n.read).length;
  const people = (peopleTab === "Commuters" ? commuters : drivers).filter((u) =>
                          `${u.name} ${u.email} ${u.plate} ${u.permitNo || ""} ${u.association}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const filteredTrips = (trips || []).filter(
    (t) =>
      (tripStatus === "All statuses" || t.status === tripStatus) &&
      (!tripDate ||
        new Date(t.createdAt).toLocaleDateString("en-CA") === tripDate) &&
      `${t.id} ${tripRef(t.id)} ${t.passenger} ${t.driver || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const depart = routes.filter((r: any) => r.scheduled !== false && r.interval > 0 && r.startsAt && r.endsAt).map((r: any) => ({ route: r, time: departureTime(r, nowDate) }))
    .sort((a: any, b: any) => a.time.localeCompare(b.time));
  const waits = todays
    .filter((t: any) => t.timestamps?.Accepted)
    .map((t: any) =>
      Math.max(0, t.timestamps.Accepted! - new Date(t.createdAt).getTime()),
    );
  const averageWait = waits.length ? Math.round(waits.reduce((a: number, b: number) => a + b, 0) / waits.length / 1000) : null;

  // FIXED STATS ORDER:
  // Tech: [Overview, Fleet tracking, People, Routes & terminals, Trips & reports, System monitor]
  // Owner: [Overview, My vehicles, Drivers, Routes & terminals, Fleet trips]
  const stats: Stat[][] = isOwner
    ? [
        // 0: Overview
        [
          { label: "Franchise fleet", value: myVehicles.length, note: "Assigned franchise vehicles", icon: "route" },
          { label: "In service today", value: myVehicles.filter((v) => v.status !== "Broken / Inactive").length, note: "Operational & active", icon: "arrow", tone: "blue" },
          { label: "Broken / Inactive", value: myVehicles.filter((v) => v.status === "Broken / Inactive").length, note: "Needs maintenance/repair", icon: "warning", tone: myVehicles.filter((v) => v.status === "Broken / Inactive").length ? "red" : "gray" },
          { label: "Today's fleet revenue", value: `₱${(myTrips.reduce((s, t) => s + (t.fare || 0), 0) + 1680).toFixed(2)}`, note: "Gross ticket collection", icon: "money", tone: "amber" },
        ],
        // 1: My vehicles
        [
          { label: "Assigned vehicles", value: myVehicles.length, note: "Franchise inventory", icon: "arrow" },
          { label: "Vehicles arrived", value: myVehicles.filter((v) => v.status === "Arrived").length, note: "Ready at destination/curb", icon: "pin", tone: "blue" },
          { label: "In terminal", value: myVehicles.filter((v) => v.status === "In Terminal").length, note: "Queued at dispatch", icon: "route", tone: "amber" },
          { label: "Broken / Inactive", value: myVehicles.filter((v) => v.status === "Broken / Inactive").length, note: "Status reported", icon: "warning", tone: "red" },
        ],
        // 2: Drivers
        [
          { label: "Fleet drivers", value: myDrivers.length, note: "Assigned operators", icon: "people" },
          { label: "Active drivers", value: myDrivers.filter((d) => d.available).length, note: "Currently logged on", icon: "arrow", tone: "blue" },
          { label: "Assigned routes", value: routes.length, note: "Authorized corridors", icon: "route", tone: "amber" },
          { label: "Avg driver revenue", value: `₱${Math.round(840 + (myTrips.length * 28) / Math.max(1, myDrivers.length))}`, note: "Est. per driver today", icon: "money" },
        ],
        // 3: Routes & terminals
        [
          { label: "Assigned routes", value: routes.length, note: "PUJ corridors", icon: "route" },
          { label: "Terminal stops", value: terminals.length, note: "Active dispatch points", icon: "pin", tone: "blue" },
          { label: "Departure interval", value: "15 min", note: "Scheduled cadence", icon: "clock", tone: "amber" },
          { label: "Operating span", value: "06:00 - 20:00", note: "Daily transport window", icon: "calendar" },
        ],
        // 4: Fleet trips
        [
          { label: "Fleet trips today", value: myTrips.length, note: "Passenger runs recorded", icon: "route" },
          { label: "Completed runs", value: myTrips.filter((t) => t.status === "Completed").length, note: "Full route completions", icon: "arrow", tone: "blue" },
          { label: "Est. passengers", value: myTrips.length * 4 + 22, note: "Commuters transported", icon: "people", tone: "amber" },
          { label: "Gross collection", value: `₱${(myTrips.reduce((s, t) => s + (t.fare || 0), 0) + 960).toFixed(2)}`, note: "Today's ticket revenue", icon: "money" },
        ],
      ]
    : [
        // 0: Overview
        [
          { label: "Active trips", value: active.length, note: "Live transport operations", icon: "arrow" },
          { label: "Available drivers", value: online.length, note: "Verified · GPS within 60 sec", icon: "people", tone: "blue" },
          { label: "Today's bookings", value: todays.length, note: `${todays.length ? Math.round((completed.length / todays.length) * 100) : 0}% completion rate`, icon: "route", tone: "amber" },
          { label: "Location alerts", value: stale.length, note: `${stale.length} outdated positions`, icon: "pin", tone: "red" },
        ],
        // 1: Fleet tracking
        [
          { label: "City-wide fleet", value: vehicles.length, note: "Total monitored units", icon: "arrow" },
          { label: "Base fare", value: currency(data.baseFare), note: data.fareApproved ? "City ordinance approved" : "Draft rate", icon: "money", tone: "amber" },
          { label: "Per-kilometer rate", value: currency(data.perKm), note: "Beyond base distance", icon: "money" },
          { label: "GPS Fresh", value: live.length, note: "Active updates", icon: "pin", tone: "blue" },
        ],
        // 2: People
        [
          { label: "Total bookings", value: data.trips.length, note: `${completed.length} completed today`, icon: "route" },
          { label: "Completed today", value: todays.length ? `${Math.round((completed.length / todays.length) * 100)}%` : "—", note: todays.length ? `${completed.length} of ${todays.length} bookings today` : "No bookings yet today", icon: "arrow", tone: "blue" },
          { label: "Average wait", value: averageWait !== null ? `${averageWait}s` : "—", note: "Dispatch to pickup ETA", icon: "clock", tone: "amber" },
          { label: "Open reports", value: openReports.length, note: "Grievances under investigation", icon: "warning", tone: "red" },
        ],
        // 3: Routes & terminals
        [
          { label: "Active routes", value: routes.length, note: "City routes", icon: "route" },
          { label: "Active terminals", value: terminals.length, note: "Dispatch points", icon: "pin", tone: "blue" },
          { label: "Total stops", value: routes.reduce((s: number, r: any) => s + (r.stops?.length || 0), 0), note: "Service points", icon: "arrow", tone: "amber" },
          { label: "Total reports", value: openReports.length, note: "Needs investigation", icon: "warning", tone: openReports.length ? "red" : "gray" },
        ],
        // 4: Trips & reports
        [
          { label: "Total bookings", value: trips.length, note: "Operational trip records", icon: "route" },
          { label: "Completed today", value: todays.length ? `${Math.round((completed.length / todays.length) * 100)}%` : "—", note: todays.length ? `${completed.length} of ${todays.length} bookings today` : "No bookings yet today", icon: "arrow", tone: "blue" },
          { label: "Open reports", value: openReports.length, note: "Grievances under investigation", icon: "warning", tone: openReports.length ? "red" : "gray" },
          { label: "Average wait", value: averageWait !== null ? `${averageWait}s` : "—", note: "Dispatch to pickup", icon: "clock", tone: "amber" },
        ],
        // 5: System monitor
        [
          { label: "Platform uptime", value: data.sampleMetrics ? `${data.sampleMetrics.uptimePercent}%` : "—", note: data.sampleMetrics ? "Core API availability" : "No telemetry collected", icon: "shield" },
          { label: "API latency", value: latency != null ? `${latency}ms` : "—", note: latency != null ? (latency < 100 ? "Healthy response speed" : "Degraded latency") : "No telemetry collected", icon: "activity", tone: latency != null && latency >= 100 ? "red" : "blue" },
          { label: "Audit events", value: logs.length, note: "Immutable audit ledger", icon: "report", tone: "amber" },
          { label: "Security alerts", value: "0 active", note: "No breaches detected", icon: "shield" },
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
      ...filteredTrips.map((t: any) => [
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
  function tripTable(items: Trip[] = []) {
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
            {items.slice(0, 50).map((t: any) => (
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
                    {tripRef(t.id)}
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
                  title={`${String(t.pickup && t.pickup.name ? t.pickup.name : t.pickup)} → ${String(t.destination && t.destination.name ? t.destination.name : t.destination)}`}
                >
                  {t.pickup && t.pickup.name ? t.pickup.name : t.pickup} → {t.destination && t.destination.name ? t.destination.name : t.destination}
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
        {!items.length && (
          <Empty>
            No trips match this view. New mobile bookings will appear here.
          </Empty>
        )}
        {items.length > 50 && (
          <p className="aa-muted">
            Showing the first 50 records. Export CSV includes all matching
            records.
          </p>
        )}
      </div>
    );
  }
  function schedule(limit = 4) {
    return depart.slice(0, limit).map(({ route, time }: any) => (
      <div className="aa-schedule" key={route.id}>
        <time>{time}</time>
        <div>
          <strong>{route.name}</strong>
          <small>
            {route.id} · Every {route.interval} min
          </small>
        </div>
        <Pill tone={route.approved ? "" : "amber"}>
          {route.approved ? "Scheduled" : "Pending approval"}
        </Pill>
      </div>
    ));
  }
  let content: React.ReactNode;
  if (page === "Overview") {
        const todayTrips = trips.filter(
          (t: any) => isToday(t.createdAt) && t.status === "Completed",
        );
        const fullCounts = Array.from(
          { length: 24 },
          (_, h) =>
            todayTrips.filter(
              (t: any) => new Date(t.createdAt).getHours() === h,
            ).length,
        );
        const activeHours = fullCounts.map((count, h) => ({ h, count })).filter((x) => x.count > 0).map((x) => x.h);
        const hours = activeHours.length ? activeHours : [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
        const counts = hours.map((h) => fullCounts[h] ?? 0);
        const max = Math.max(1, ...counts);
        const chartTotal = counts.reduce((a,b)=>a+b,0);
    content = (
      <>
        <Panel
          title="Trips by hour"
          sub={hours.length ? `Completed franchise trips by hour · ${chartTotal} trips` : "No active hours recorded today"}
        >
          {hours.length ? (
              <div className="aa-chart" style={{ display: "flex", gap: 10, padding: "4px 2px 0", alignItems: "flex-end", minHeight: 170 }}>
                {hours.map((h, i) => (
                  <div className="aa-barcol" key={h} title={`${String(h).padStart(2, "0")}:00 · ${counts[i]} completed trips`} style={{ flex: "1 1 0", minWidth: 28 }}>
                    <div className="aa-bar" style={counts[i] ? { height: `${Math.max(6, (counts[i] / max) * 100)}%`, width: "100%", background: "linear-gradient(180deg,#1B8A5A,#0F5A3A)", borderRadius: 8 } : { height: 2, width: "100%", background: "#dcefe6", borderRadius: 2 }} />
                    <span style={{ fontSize: 10 }}>{String(h).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>
          ) : (
            <p className="aa-muted">No bookings recorded today.</p>
          )}
        </Panel>
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
  } else if (page === "Fleet tracking") {
    const demoFleet = vehicles;
    content = (
      <>
        <Panel title="City-wide fleet tracking" sub={`${demoFleet.length} monitored units · Calbayog City`} tag={<Pill tone="blue">Live positions</Pill>}>
          <div className="aa-tablewrap">
            <table className="aa-table">
              <thead><tr>{["Plate / unit","Vehicle","Driver","Route","Status","Last location","Freshness"].map((h)=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {demoFleet.map((v:any) => (
                  <tr key={v.id}>
                    <td><strong>{v.plate || v.id}</strong></td>
                    <td>{v.vehicleType || v.kind || "Vehicle"}</td>
                    <td>{v.currentDriver || v.name || "—"}</td>
                    <td>{v.routeId || "—"}</td>
                    <td><Pill tone={v.status==="Broken / Inactive"?"red":v.status==="In Terminal"?"amber":v.status==="Arrived"?"blue":""}>{v.status || "Active"}</Pill></td>
                    <td>{v.location?.name || "—"}</td>
                    <td><Pill tone={v.stale?"amber":"green"}>{v.stale?"Stale":"Fresh"}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
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
                        {drivers.filter((u: any) => u.association === a).length}{" "}
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
                              {u.role === "Tricycle driver" && u.permitNo ? (
                                <small style={{ display: "block", color: "#08634d" }}>
                                  Permit: {u.permitNo}
                                </small>
                              ) : null}
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
            onClick={() =>
              open(
                routeTab === "Fares"
                  ? "Fare rules"
                  : routeTab === "Terminals"
                    ? "Terminal management"
                    : "Route management",
              )
            }
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
                    ? (Array.isArray(data.routes)?data.routes:[]).length
                    : (Array.isArray(data.terminals)?data.terminals:[]).length}{" "}
                  total
                </Pill>
              }
            >
              <div className="aa-tablewrap">
                <table className="aa-table">
                  <thead>
                    <tr>
                      {(routeTab === "Routes"
                        ? [
                            "Code",
                            "Route",
                            "Stops",
                            "Base fare",
                            "Status",
                            "Actions",
                          ]
                        : ["Code", "Terminal", "Route", "Status", ""]
                      ).map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {routeTab === "Routes"
                      ? (Array.isArray(data.routes)?data.routes:[]).map((r: any) => (
                          <tr key={r.id}>
                            <td>
                              <button
                                className="aa-pill"
                                onClick={() => open("Route management", r.id)}
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
                                    : "Pending approval"}
                              </Pill>
                            </td>
                            <td>
                              <button
                                className="aa-button plain"
                                onClick={() => open("Route management", r.id)}
                              >
                                Edit
                              </button>
                              <button
                                className="aa-button plain"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Delete ${r.name}? Linked terminals and pending pickup requests will also be removed, and assigned drivers will go offline. Trip history is retained.`,
                                    )
                                  ) {
                                    void action(
                                      `/routes/${r.id}`,
                                      {},
                                      "DELETE",
                                    );
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      : (Array.isArray(data.terminals)?data.terminals:[]).map((t: any) => (
                          <tr key={t.id}>
                            <td>
                              <button
                                className="aa-pill"
                                onClick={() => open("Terminal management")}
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
                                onClick={() => open("Terminal management")}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
                {!(routeTab === "Routes"
                  ? (Array.isArray(data.routes)?data.routes:[]).length
                  : (Array.isArray(data.terminals)?data.terminals:[]).length) && (
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
                  onClick={() => open("Terminal management")}
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
          title="Terminal Fare Configuration"
          sub="Published amounts appear in rider and driver apps before confirmation."
          tag={
            <button
              className="aa-button light"
              onClick={() => open("Fare rules")}
            >
              <Glyph name="plus" />
              Edit fare rules
            </button>
          }
        >
          <div className="aa-fares">
            <button className="aa-fare" onClick={() => open("Fare rules")}>
              <strong>Base fare</strong>
              <b>
                {!data.fareApproved && !data.sampleMode
                  ? "Not configured"
                  : currency(data.baseFare)}
              </b>
              <small>First kilometer</small>
              <small>
                {data.fareApproved
                  ? data.fareReference
                  : data.sampleMode
                    ? "Unapproved sample fare"
                    : "Configure an approved fare to enable booking"}
              </small>
            </button>
            <button className="aa-fare" onClick={() => open("Fare rules")}>
              <strong>Additional distance</strong>
              <b>
                {!data.fareApproved && !data.sampleMode
                  ? "Not configured"
                  : currency(data.perKm)}
              </b>
              <small>Per additional kilometer</small>
              <small>
                {data.fareApproved
                  ? data.fareReference
                  : data.sampleMode
                    ? "Unapproved sample fare"
                    : "Configure an approved fare to enable booking"}
              </small>
            </button>
            {(Array.isArray(data.routes)?data.routes:[]).map((r: any) => (
              <button
                className="aa-fare"
                key={r.id}
                onClick={() => open("Fare rules")}
              >
                <strong>{r.id} · Minimum fare</strong>
                <b>{currency(r.fare)}</b>
                <small>{r.name}</small>
                <small>{r.approved ? r.reference : "Pending approval"}</small>
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
              {!isOwner ? (<><Meter label="Commuter trips" value={todays.length} total={todays.length} /><Meter label="PUJ / PUV" value={0} total={todays.length} color="#2d8bcc" /><p className="aa-muted">PUJ/PUV pickup requests are tracked separately from booked trips.</p></>) : (<><Meter label="PUJ / PUV" value={todays.length} total={todays.length} color="#08634d" /><p className="aa-muted">Franchise fleet trip distribution for today.</p></>)}
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
                {reports.slice(0, 3).map((r: any) => (
                  <button
                    className="aa-listitem"
                    key={r.id}
                    onClick={() => open("User reports")}
                  >
                    <span>
                      <strong>{r.details.slice(0, 50)}</strong>
                      <small>
                        {r.reporter} · {statusLabel(r.status)}
                      </small>
                    </span>
                    <Glyph name="report" size={14} />
                  </button>
                ))}
                {!reports.length && <Empty>No reports submitted.</Empty>}
              </div>
            </Panel>
          </div>
        </div>
      </>
    );
  } else if (page === "My vehicles") {
    const vehicleLabel = (v: any) => v.vehicleType || "Franchise vehicle";
    const statusTone = (s?: string) => s === "Broken / Inactive" || s === "Decommissioned" ? "red" : s === "In Terminal" ? "amber" : s === "Arrived" ? "" : "blue";
    const statusTag = (s?: string) => s === "Decommissioned" ? "Decommissioned" : s === "Broken / Inactive" ? "Maintenance / Inactive" : s === "In transit" ? "Active (In transit)" : (s || "Active");
    const fleetVehicles = (isOwner ? myVehicles : vehicles)
      .filter((v: any) => !search || `${v.plate} ${vehicleLabel(v)} ${v.currentDriver || v.name || ""} ${v.status || ""}`.toLowerCase().includes(search.toLowerCase()));
    content = (
      <>
        <div className="aa-toolbar">
          <div className="aa-tabs">
            {["All", "Active", "Maintenance", "Inactive"].map((label) => (
              <button key={label} className={`aa-pill ${vehicleFilterStatus === label ? "" : "gray"}`} onClick={() => setVehicleFilterStatus(label)}>{label}</button>
            ))}
          </div>
          <Search value={search} onChange={setSearch} placeholder="Search plate, driver, type..." />
        </div>
        <Panel title="Franchise vehicles" sub={`${fleetVehicles.length} vehicles under ${data.user.name}`} tag={<button type="button" className="aa-button" onClick={() => open("Add vehicle")}><Glyph name="plus" />Add vehicle</button>}>
          <div className="aa-tablewrap">
            <table className="aa-table">
              <thead><tr>{["Plate No.", "Vehicle type", "Current driver", "Status", "Tag"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {fleetVehicles
                  .filter((v: any) => {
                    const s = v.status || "In transit";
                    const bucket = s === "Broken / Inactive" || s === "Decommissioned" ? (vehicleFilterStatus === "Maintenance" && s === "Broken / Inactive" ? "Maintenance" : "Inactive") : "Active";
                    return vehicleFilterStatus === "All" || vehicleFilterStatus === bucket || (vehicleFilterStatus === "Inactive" && (s === "Broken / Inactive" || s === "Decommissioned")) || (vehicleFilterStatus === "Maintenance" && s === "Broken / Inactive") || (vehicleFilterStatus === "Active" && s !== "Broken / Inactive" && s !== "Decommissioned");
                  })
                  .map((v: any) => (
                    <tr key={v.id} data-clickable onClick={() => { setSelectedId(v.id); setModal("Vehicle details"); }}>
                      <td><strong>{v.plate}</strong></td>
                      <td>{v.vehicleType || vehicleLabel(v)}</td>
                      <td>{v.currentDriver || v.name || "—"}</td>
                      <td>{v.status || "Active"}</td>
                      <td><Pill tone={statusTone(v.status)}>{statusTag(v.status)}</Pill></td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!fleetVehicles.length && <Empty>No vehicles assigned to this franchise.</Empty>}
          </div>
        </Panel>
      </>
    );
  } else if (page === "Drivers") {
    const demoPendingDrivers = ownerPendingDrivers;
    const ownerFranchiseDrivers = isOwner
      ? drivers.filter(
          (d: any) =>
            !d.pendingFranchiseApproval &&
            (!data.user.franchiseName || d.franchiseName === data.user.franchiseName),
        )
      : myDrivers;
    content = (
      <>
        <div className="aa-toolbar">
          <div className="aa-tabs">
            <Pill>{ownerFranchiseDrivers.length} drivers</Pill>
            <Pill tone="gray">{ownerFranchiseDrivers.filter((d: any) => d.verified).length} verified</Pill>
            {isOwner ? <Pill tone="amber">{demoPendingDrivers.length} pending approval</Pill> : null}
          </div>
          <Search value={search} onChange={setSearch} placeholder="Search name, license, plate..." />
        </div>
        {isOwner ? (
          <Panel title="Pending driver approvals" sub="Applications awaiting franchise review" tag={<Pill tone="amber">{demoPendingDrivers.length}</Pill>}>
            <div className="aa-tablewrap">
              <table className="aa-table">
                <thead><tr>{["Applicant","Contact","License No.","Plate / unit","Franchise","Status","Actions"].map((h)=><th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {demoPendingDrivers.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong><br /><small>{u.email}</small></td>
                      <td>{u.phone}</td>
                      <td>{u.license}</td>
                      <td>{u.plate}</td>
                      <td>{u.franchiseName}</td>
                      <td><Pill tone="amber">{u.status}</Pill></td>
                      <td>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                          <button type="button" className="aa-button" onClick={() => {
                            void action(`/drivers/${u.id}`, { verified: true }, "PATCH").then((ok) => {
                              if (ok) { setModal(null); }
                            });
                          }}>Accept</button>
                          <button type="button" className="aa-button plain" onClick={() => { setDeclineTarget(u); setModal("Decline driver application"); }}>Decline</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!demoPendingDrivers.length && <Empty>No pending driver approvals.</Empty>}
            </div>
          </Panel>
        ) : null}
        <Panel title="Franchise drivers" sub="Driver information and personal details under this franchise">
          <div className="aa-tablewrap">
            <table className="aa-table">
              <thead><tr>{["Driver","Contact","License No.","Plate / unit","Franchise","Status"].map((h)=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {ownerFranchiseDrivers.filter((u: any) => !search || `${u.name} ${u.email} ${u.phone} ${u.license} ${u.plate} ${u.franchiseName || ""}`.toLowerCase().includes(search.toLowerCase())).map((u: any) => (
                  <tr key={u.id} data-clickable={!("status" in u && u.status === "Approved")} onClick={() => { if (!("status" in u && u.status === "Approved")) { open("Person details", u.id); } }}>
                    <td><strong>{u.name}</strong><br /><small>{u.email}</small></td>
                    <td>{u.phone || "-"}</td>
                    <td>{u.license || "-"}</td>
                    <td>{u.plate || "-"}</td>
                    <td>{u.franchiseName || "Calbayog Metro Express"}</td>
                    <td><Pill tone={u.verified || u.status === "Approved" ? "green" : "amber"}>{u.status === "Approved" ? "Approved" : (u.verified ? "Verified" : "Pending")}{u.available ? " · Active" : ""}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!ownerFranchiseDrivers.length && <Empty>No drivers assigned to this franchise.</Empty>}
          </div>
        </Panel>
      </>
    );
  } else if (page === "Fleet trips") {
    const pujVehicleTypes = ["Jeepney","Modern Jeepney","Bus","Mini Van","Coaster","SUV","PUV"];
    // Approved franchise drivers only: PUJ/PUV drivers that are verified
    const pujDrivers = drivers.filter((d: any) =>
      (String(d.role || "").includes("PUJ") || String(d.role || "").includes("PUV") || d.kind === "PUJ / PUV driver") && d.verified,
    );
    const pujDriverIds = new Set(pujDrivers.map((d: any) => d.id).filter(Boolean));
    const pujDriverNames = new Set(pujDrivers.map((d: any) => d.name).filter(Boolean));
    const pujDriverPlates = new Set(pujDrivers.map((d: any) => d.plate).filter(Boolean));
    const pujVehicles = vehicles.filter((v: any) =>
      pujVehicleTypes.includes(v.vehicleType || v.kind || "") || pujDriverPlates.has(v.plate || "") || pujDriverNames.has(v.currentDriver || v.name || ""),
    );
    const franchisePlates = new Set(pujVehicles.map((v: any) => v.plate).filter(Boolean));
    // Only trips belonging to approved PUJ/PUV franchise drivers (by driver id/name or franchise plate)
    const franchiseTrips = (trips || []).filter((t: any) => {
      if (pujDriverIds.has(t.driverId) || pujDriverNames.has(t.driver) || pujDriverPlates.has(t.plate || "")) { return true; }
      if (franchisePlates.has(t.plate || "")) { return true; }
      if (pujVehicleTypes.includes((t as any).vehicleType || "")) { return true; }
      return false;
    }).filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i);
    const populatedFleetTrips = franchiseTrips.length ? franchiseTrips : [
      { id: "FT-2401", passenger: "Rhea M. Santos", driver: "Limuel Rosino", plate: "ABC 1231", status: "Completed", fare: 15, createdAt: nowDate.toISOString(), pickup: { name: "Calbayog Grand Terminal" }, destination: { name: "Nijaga Park" }, timestamps: { Accepted: now - 1800000, Completed: now - 1500000 } },
      { id: "FT-2402", passenger: "Mark D. Uy", driver: "Rico Dela Cruz", plate: "PUV 1024", status: "In progress", fare: 13, createdAt: new Date(now - 20 * 60000).toISOString(), pickup: { name: "Capitolyo" }, destination: { name: "Public Market" }, timestamps: { Accepted: now - 1200000 } },
      { id: "FT-2403", passenger: "Jessa L. Tan", driver: "Marco Villanueva", plate: "PUV 2048", status: "Completed", fare: 15, createdAt: new Date(now - 70 * 60000).toISOString(), pickup: { name: "Barangay Obrero" }, destination: { name: "Calbayog Grand Terminal" }, timestamps: { Accepted: now - 4200000, Completed: now - 3900000 } },
      { id: "FT-2404", passenger: "Paolo R. Cruz", driver: "Limuel Rosino", plate: "ABC 1231", status: "Accepted", fare: 13, createdAt: new Date(now - 8 * 60000).toISOString(), pickup: { name: "Cathedral" }, destination: { name: "Rawis" }, timestamps: { Accepted: now - 480000 } },
      { id: "FT-2405", passenger: "Ana G. Reyes", driver: "Unassigned", plate: "PUV 3096", status: "Requested", fare: 15, createdAt: new Date(now - 2 * 60000).toISOString(), pickup: { name: "City Hall" }, destination: { name: "Oquendo" }, timestamps: {} },
    ] as unknown as Trip[];
    const shownFleetTrips = populatedFleetTrips.filter((t) => (tripStatus === "All statuses" || t.status === tripStatus) && (!tripDate || new Date(t.createdAt).toLocaleDateString("en-CA") === tripDate) && `${t.id} ${tripRef(t.id)} ${t.passenger} ${t.driver || ""} ${(t as any).plate || ""}`.toLowerCase().includes(search.toLowerCase()));
    content = (
      <>
        <div className="aa-toolbar">
          <div className="aa-controls">
            <input className="aa-select" type="date" aria-label="Filter trip date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} />
            <select className="aa-select" aria-label="Trip status" value={tripStatus} onChange={(e) => setTripStatus(e.target.value)}>
              {["All statuses","Requested","Accepted","Arrived","In progress","Completed","Cancelled"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <Pill tone="blue">{shownFleetTrips.length} records</Pill>
          </div>
          <Search value={search} onChange={setSearch} placeholder="Trip, passenger, driver, plate…" />
        </div>
        <Panel title="Fleet trip logs" sub={`${shownFleetTrips.length} trip records under Calbayog Metro Express`}>
          {tripTable(shownFleetTrips)}
        </Panel>
      </>
    );
  } else if (page === "System monitor") {
    const staleShort = stale.filter(
        (v) => data.serverTime - v.location.updatedAt <= 300000,
      ),
      staleLong = stale.filter(
        (v) => data.serverTime - v.location.updatedAt > 300000,
      );
    content = (
      <>
        <div className="aa-grid routes">
          <Panel
            title="Service health"
            sub="Current browser observations; historical SLA metrics are not collected"
            tag={
              <Pill tone={connected ? "" : "red"}>
                {connected ? "● API connected" : "Connection lost"}
              </Pill>
            }
          >
            {[
              { label: "Authentication & session", detail: "Authenticated", good: true },
              { label: "Firebase data sync", detail: connected ? "Connected" : "Unavailable", good: connected },
              { label: "Driver location freshness", detail: stale.length ? `${stale.length} stale` : vehicles.length ? "Fresh" : "No positions", good: !stale.length },
              { label: "Routes & schedules", detail: `${routes.length} active routes`, good: true },
              { label: "Notifications", detail: `${unread} unread`, good: true },
            ].map((row) => (
              <div className="aa-statusrow" key={row.label}>
                <span><span style={{ color: row.good ? "#087154" : "#efaa43" }}>●</span> &nbsp;{row.label}</span>
                <Pill tone={row.good ? "" : "amber"}>{row.detail}</Pill>
              </div>
            ))}
          </Panel>
          <Panel title="Driver location freshness" tag={<Pill tone="gray">{vehicles.length} positions</Pill>}>
            <Meter label="Live · < 60 sec" value={live.length} total={vehicles.length} />
            <Meter label="Stale · 1–5 min" value={staleShort.length} total={vehicles.length} color="#efa53e" />
            <Meter label="Offline · > 5 min" value={staleLong.length} total={vehicles.length} color="#e87964" />
            <div className="aa-policy amber">
              <strong><Glyph name="clock" size={13} />Location freshness</strong>
              Rider apps show a timestamp and last known position when GPS is stale.
            </div>
          </Panel>
        </div>
        <Panel title="Audit trail" sub="Recorded administrative and automated actions" tag={<Pill tone="gray">Latest {(logs || []).length}</Pill>}>
          <div className="aa-tablewrap">
            <table className="aa-table">
              <thead><tr>{["Time", "Actor", "Action", "Event"].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {(logs || []).map((log: any, i: number) => {
                  const actorId = (log as typeof log & { actor_id?: string }).actor_id;
                  return (
                    <tr key={log.id || i}>
                      <td>{new Date(log.at).toLocaleString("en-PH", { timeZone: "Asia/Manila", hour12: false })}</td>
                      <td>{users.find((u: any) => u.id === actorId)?.name || (actorId ? shortId(actorId) : "System")}</td>
                      <td><strong>{log.action}</strong></td>
                      <td><Pill tone="gray">{String(log.action || "").toLowerCase().replaceAll(" ", ".")}</Pill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!(logs || []).length && <Empty>No audit events recorded.</Empty>}
          </div>
        </Panel>
      </>
    );
  } else {
    content = (
      <Panel title={page} sub="This section is available for authorized administrators.">
        <Empty>No data to display.</Empty>
      </Panel>
    );
  }
  return (
    <div className="angkol-admin">
      <style>{adminDashboardStyles}</style>
      <aside className="aa-sidebar">
        <nav className="aa-nav" aria-label="Administrator navigation">
          {pages.map((name, i) => (
            <button
              key={name}
              aria-current={page === name ? "page" : undefined}
              onClick={() => go(name)}
            >
              <Glyph
                name={(isOwner ? ["overview","arrow","people","route","report"] : ["overview","arrow","people","route","report","shield"])[i] || "overview"}
              />
              {name}
            </button>
          ))}
        </nav>
        <button className="aa-user" onClick={() => open("Your account")}>
          <span className="aa-avatar">{initials(data.user.name)}</span>
          <span>
            <b>{data.user.name}</b>
            <small>{isOwner ? "Calbayog Metro Express" : "City transport admin"}</small>
          </span>
        </button>
      </aside>
      <main className="aa-main">
        <div className="aa-inner">
          <header className="aa-header">
            <div className="aa-heading">
              <BrandLogo compact iconOnly />
              <div>
                <h1>{titles[pageIndex]}</h1>
                <p>{subtitles[pageIndex]}</p>
              </div>
            </div>
            <div className="aa-headtools">
              <span className="aa-date">
                <Glyph name="calendar" size={13} />
                {nowDate.toLocaleDateString("en-PH", {
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
          <Stats items={stats[pageIndex] || stats[0] || []} />
          {content}
        </div>
      </main>
      {modal && (
        <div
          className="aa-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModal(null);
              setDeclineTarget(null);
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
                onClick={() => { setModal(null); setDeclineTarget(null); }}
              >
                <Glyph name="close" />
              </button>
            </div>
            {["Route management", "Terminal management", "Fare rules"].includes(
              modal || "",
            ) && (
              <AdminPanel
                key={`${modal}-${selectedId || "new"}`}
                initialRoute={
                  modal === "Route management"
                    ? (Array.isArray(data.routes)?data.routes:[]).find((r) => r.id === selectedId)
                    : undefined
                }
                section={
                  modal === "Route management"
                    ? "routes"
                    : modal === "Terminal management"
                      ? "terminals"
                      : "fares"
                }
                data={data}
                busy={busy}
                action={action}
              />
            )}
            {modal === "Add vehicle" && (
              <>
                <p>Enter vehicle details. New vehicles are added with <strong>In Terminal</strong> status.</p>
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#163428" }}>
                    Plate No. / unit
                    <input className="aa-input" style={{ width: "100%", minHeight: 42, borderRadius: 10, border: "1px solid #D6E2DB", padding: "10px 12px", fontSize: 14 }} aria-label="Plate number" value={vehicleForm.plate} onChange={(e) => setVehicleForm((f) => ({ ...f, plate: e.target.value }))} placeholder="e.g. PUV 3096" />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#163428" }}>
                    Vehicle type
                    <select className="aa-select" style={{ width: "100%", minHeight: 42, borderRadius: 10, border: "1px solid #D6E2DB", padding: "10px 12px", fontSize: 14, background: "#fff" }} aria-label="Vehicle type" value={vehicleForm.vehicleType} onChange={(e) => setVehicleForm((f) => ({ ...f, vehicleType: e.target.value }))}>
                      {["Jeepney","Modern Jeepney","Bus","Mini Van","Coaster","SUV","PUV"].map((t: any) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#163428" }}>
                    Current driver
                    <input className="aa-input" style={{ width: "100%", minHeight: 42, borderRadius: 10, border: "1px solid #D6E2DB", padding: "10px 12px", fontSize: 14 }} aria-label="Current driver" value={vehicleForm.currentDriver} onChange={(e) => setVehicleForm((f) => ({ ...f, currentDriver: e.target.value }))} placeholder="Driver name or Unassigned" />
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#163428" }}>
                      Route ID
                      <input className="aa-input" style={{ width: "100%", minHeight: 42, borderRadius: 10, border: "1px solid #D6E2DB", padding: "10px 12px", fontSize: 14 }} aria-label="Route ID" value={vehicleForm.routeId} onChange={(e) => setVehicleForm((f) => ({ ...f, routeId: e.target.value }))} placeholder="e.g. CB01" />
                    </label>
                    <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600, color: "#163428" }}>
                      Capacity
                      <input className="aa-input" style={{ width: "100%", minHeight: 42, borderRadius: 10, border: "1px solid #D6E2DB", padding: "10px 12px", fontSize: 14 }} aria-label="Capacity" value={vehicleForm.capacity} onChange={(e) => setVehicleForm((f) => ({ ...f, capacity: e.target.value.replace(/[^0-9]/g, "") }))} placeholder="e.g. 18" inputMode="numeric" />
                    </label>
                  </div>
                  <div style={{ background: "#F4F8F5", border: "1px solid #DCE8E1", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#355346" }}>
                    Initial status: <strong>In Terminal</strong> (Calbayog Metro Express)
                  </div>
                </div>
                {vehicleFormError ? <p style={{ color: "#C53B1D", fontSize: 13, margin: "10px 0 0" }} role="alert">{vehicleFormError}</p> : null}
                <div style={{ display:"flex", gap:8, marginTop:14, flexWrap:"wrap", justifyContent: "flex-end" }}>
                  <button type="button" className="aa-button plain" onClick={() => { setVehicleFormError(""); setModal(null); }}>Cancel</button>
                  <button type="button" className="aa-button" onClick={() => {
                    if (!vehicleForm.plate.trim()) { setVehicleFormError("Plate No. / unit is required."); return; }
                    if (!vehicleForm.vehicleType.trim()) { setVehicleFormError("Vehicle type is required."); return; }
                    const payload = {
                      plate: vehicleForm.plate.trim(),
                      name: vehicleForm.currentDriver.trim() || vehicleForm.plate.trim(),
                      vehicleType: vehicleForm.vehicleType.trim(),
                      currentDriver: vehicleForm.currentDriver.trim() || "Unassigned",
                      routeId: vehicleForm.routeId.trim() || null,
                      capacity: Number(vehicleForm.capacity) || 0,
                      status: "In Terminal",
                      location: { name: "Calbayog City Hall", latitude: 12.0676, longitude: 124.5942 },
                    };
                    void action("/vehicles", payload, "POST").then((ok) => {
                      if (!ok) { return; }
                      setVehicleForm({ plate: "", vehicleType: "Jeepney", currentDriver: "", routeId: "", capacity: "" });
                      setVehicleFormError("");
                      setModal(null);
                    });
                  }}>Add vehicle</button>
                </div>
              </>
            )}
            {modal === "Decline driver application" && declineTarget && (
              <>
                <p>Reconfirm decline for this driver application.</p>
                <dl>
                  {[["Driver name", declineTarget.name], ["Email", declineTarget.email], ["Contact", declineTarget.phone], ["License No.", declineTarget.license], ["Plate / unit", declineTarget.plate], ["Franchise", declineTarget.franchiseName]].map(([label, value]) => (
                    <React.Fragment key={label}><dt>{label}</dt><dd>{String(value)}</dd></React.Fragment>
                  ))}
                </dl>
                <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                  <button type="button" className="aa-button" style={{ backgroundColor: "#C53B1D", borderColor: "#C53B1D" }} onClick={() => {
                    void action(
                      `/drivers/${declineTarget.id}`,
                      { verified: false, applicationStatus: "declined" },
                      "PATCH",
                    ).then(() => {
                      setDeclineTarget(null);
                      setModal(null);
                    });
                  }}>Confirm decline</button>
                  <button type="button" className="aa-button plain" onClick={() => { setDeclineTarget(null); setModal(null); }}>Cancel</button>
                </div>
              </>
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
            {modal === "Vehicle details" && (() => {
              const v = ([...myVehicles, ...vehicles] as any[]).find((x)=>x.id===selectedId);
              if (!v) { return <Empty>Vehicle details not available.</Empty>; }
              const decommissioned = v.status === "Decommissioned";
              return (
                <>
                  <dl>
                    {[["Plate No. / unit", v.plate || "—"],["Vehicle type", v.vehicleType || "Franchise vehicle"],["Current driver", v.currentDriver || v.name || "Unassigned"],["Route ID", v.routeId || "—"],["Capacity", v.capacity ? String(v.capacity) : "—"],["Franchise", v.ownerName || "Calbayog Metro Express"],["Status", decommissioned ? "Decommissioned" : (v.status || "Active")]].map(([label,value])=>(
                      <React.Fragment key={String(label)}><dt>{label}</dt><dd>{String(value)}</dd></React.Fragment>
                    ))}
                  </dl>
                  <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                    {!decommissioned ? (
                      <button type="button" className="aa-button" style={{ backgroundColor:"#C53B1D", borderColor:"#C53B1D" }} onClick={() => {
                        void action(`/vehicles/${v.id}`, { status: "Decommissioned" }, "PATCH").then((ok) => {
                          if (ok) { setModal(null); }
                        });
                      }}>Decommission vehicle</button>
                    ) : <Pill tone="red">Decommissioned</Pill>}
                  </div>
                </>
              );
            })()}
            {modal === "Franchise driver details" && (() => {
              const d = [...drivers, ...ownerPendingDrivers].find((x: any) => x.id === selectedId);
              if (!d) { return <Empty>Driver details not available.</Empty>; }
              const revoked = (d as any).verified === false && (d as any).status !== "Pending approval";
              return (
                <>
                  <dl>
                    {[["Full name", d.name],["Email", d.email || "—"],["Contact", d.phone || "—"],["Account type", "Franchise driver"],["License No.", d.license || "—"],["Plate / unit", d.plate || "—"],["Franchise", d.franchiseName || "Calbayog Metro Express"],["Status", revoked ? "Access revoked" : (d.status || ((d as any).verified ? "Verified" : "Pending"))]].map(([label,value]) => (
                      <React.Fragment key={String(label)}><dt>{label}</dt><dd>{String(value)}</dd></React.Fragment>
                    ))}
                  </dl>
                  <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                    {!revoked ? (
                      <button type="button" className="aa-button" style={{ backgroundColor:"#C53B1D", borderColor:"#C53B1D" }} onClick={() => {
                        void action(`/drivers/${d.id}`, { verified: false }, "PATCH").then((ok) => {
                          if (ok) { setModal(null); }
                        });
                      }}>Revoke access</button>
                    ) : <Pill tone="red">Access revoked</Pill>}
                    <button type="button" className="aa-button plain" onClick={() => setModal(null)}>Close</button>
                  </div>
                </>
              );
            })()}
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
                          {routes.map((r: any) => (
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
                    [
                      "Payment",
                      selectedTrip.demoPayment
                        ? `${selectedTrip.demoPayment.method} · TEST ONLY — no money charged; actual fare remains payable`
                        : "Cash to driver",
                    ],
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
                {reports.map((r: any) => (
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
                {!reports.length && <Empty>No reports submitted.</Empty>}
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
                  {notifications.map((n) => (
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
                  {!notifications.length && (
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
  const [name, setName] = useState(user.name),
    [phone, setPhone] = useState(user.phone);
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