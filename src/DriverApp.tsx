import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  Alert,
  BackHandler,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { Snapshot, DriverRun } from "./types";
import { api } from "./api";
import { Icon, money } from "./ui";
import CalbayogMap from "./CalbayogMap";
import { ps, passengerColors as c } from "./passengerStyles";

type Props = {
  data: Snapshot;
  busy: boolean;
  connected: boolean;
  notice: string;
  sharing: boolean;
  dismissNotice: () => void;
  toggleSharing: () => Promise<void>;
  refresh: () => Promise<boolean>;
  action: (
    endpoint: string,
    input: unknown,
    method?: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
};
type IconName = React.ComponentProps<typeof Icon>["name"];
function Button({
  title,
  onPress,
  light,
  icon,
  disabled,
}: {
  title: string;
  onPress: () => void;
  light?: boolean;
  icon?: IconName;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        ps.button,
        light && ps.buttonLight,
        disabled && { opacity: 0.45 },
      ]}
    >
      {icon && <Icon name={icon} color={light ? c.green : "white"} size={19} />}
      <Text style={[ps.buttonText, light && { color: c.green }]}>{title}</Text>
    </Pressable>
  );
}
function Tag({ text, amber }: { text: string; amber?: boolean }) {
  return (
    <View style={[ps.pill, amber && { backgroundColor: "#FFF0D6" }]}>
      <Text style={[ps.pillText, amber && { color: "#B37A2A" }]}>{text}</Text>
    </View>
  );
}
function Hint({ text, warning = false }: { text: string; warning?: boolean }) {
  return (
    <View style={[ps.hint, !warning && ps.info]}>
      <Icon
        name={warning ? "warning-outline" : "shield-checkmark-outline"}
        color={warning ? "#B37A2A" : c.green}
        size={19}
      />
      <Text style={[ps.hintText, !warning && { color: c.green }]}>{text}</Text>
    </View>
  );
}
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View
      style={[ps.card, { flex: 1, padding: 12, alignItems: "center", gap: 3 }]}
    >
      <Text style={[ps.section, { fontSize: 21 }]}>{value}</Text>
      <Text style={[ps.tiny, { textAlign: "center" }]}>{label}</Text>
    </View>
  );
}
function Count({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text style={ps.small}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        value={value}
        onChangeText={onChange}
        style={ps.input}
      />
    </View>
  );
}
const time = (at: string | number) =>
  new Date(at).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
const date = (at: string | number) =>
  new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
function departure(route: Snapshot["routes"][number], now: number) {
  const minute = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const current = minute(
    new Date(now).toLocaleTimeString("en-GB", {
      timeZone: "Asia/Manila",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
  const start = minute(route.startsAt);
  const end = minute(route.endsAt);
  const next = Math.max(
    start,
    start +
      Math.ceil((current - start) / Math.max(1, route.interval)) *
        Math.max(1, route.interval),
  );
  return next > end
    ? `Tomorrow ${route.startsAt}`
    : `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
}
function departureCount(route: Snapshot["routes"][number]) {
  const minute = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };
  return (
    Math.floor(
      (minute(route.endsAt) - minute(route.startsAt)) /
        Math.max(1, route.interval),
    ) + 1
  );
}
export default function DriverApp({
  data,
  busy,
  connected,
  notice,
  sharing,
  dismissNotice,
  toggleSharing,
  refresh,
  action,
  logout,
}: Props) {
  const params = useLocalSearchParams<{
    screen?: string;
    run?: string;
    trip?: string;
  }>();
  const puj = data.user.role === "PUJ / PUV driver";
  const aliases: Record<string, string> = {
    Home: "Dashboard",
    "My trips": "Records",
    Trips: "Records",
    Requests: "Requests",
    Routes: "Routes",
    Reports: "Support",
    Route: "Route",
  };
  const allowed = [
    "Dashboard",
    "Route",
    "Routes",
    "Terminal",
    "Pickup",
    "Run complete",
    "Requests",
    "Trip",
    "Records",
    "Earnings",
    "Profile",
    "Account",
    "Documents",
    "Support",
    "Notifications",
  ];
  const requested =
    aliases[params.screen || ""] || params.screen || "Dashboard";
  const page = allowed.includes(requested) ? requested : "Dashboard";
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [boarded, setBoarded] = useState("0");
  const [alighted, setAlighted] = useState("0");
  const initialRoute =
    data.routes.find((route) => route.id === data.user.routeId) ||
    data.routes[0];
  const [routeFrom, setRouteFrom] = useState(
    initialRoute?.stops[0]?.name || "",
  );
  const [routeTo, setRouteTo] = useState(
    initialRoute?.stops[initialRoute.stops.length - 1]?.name || "",
  );
  const [routeSearchActive, setRouteSearchActive] = useState(false);
  const [assignedRoutesOnly, setAssignedRoutesOnly] = useState(false);
  const [showAllTerminals, setShowAllTerminals] = useState(false);
  const [name, setName] = useState(data.user.name);
  const [phone, setPhone] = useState(data.user.phone);
  const [report, setReport] = useState("");
  const lock = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const locked = busy || working;
  const runs = data.runs || [];
  const activeRun = runs.find((r) => r.status === "In progress");
  const run = runs.find((r) => r.id === params.run) || activeRun || runs[0];
  const trips = data.trips.filter((t) => t.driverId === data.user.id);
  const requests = data.trips.filter((t) => t.status === "Requested");
  const activeTrip = trips.find(
    (t) => !["Completed", "Cancelled"].includes(t.status),
  );
  const trip =
    trips.find((t) => t.id === params.trip) || activeTrip || trips[0];
  const assigned = data.routes.find((r) => r.id === data.user.routeId);
  const stops = activeRun?.stops || assigned?.stops || [];
  const fresh =
    !!data.user.location &&
    data.serverTime - data.user.location.updatedAt <= 60000;
  const ownVehicle = data.user.location
    ? [
        {
          id: data.user.id,
          name: data.user.name,
          kind: data.user.role,
          plate: data.user.plate,
          routeId: data.user.routeId,
          capacity: data.user.capacity,
          location: data.user.location,
          stale: !fresh || !sharing,
        },
      ]
    : [];
  const completed = puj
    ? runs
        .filter((r) => r.status === "Completed")
        .map((r) => ({
          id: r.id,
          name: r.routeName,
          at: r.endedAt || r.startedAt,
          fare: r.cashFares,
        }))
    : trips
        .filter((t) => t.status === "Completed")
        .map((t) => ({
          id: t.id,
          name: `${t.pickup} → ${t.destination}`,
          at: new Date(t.timestamps.Completed || t.createdAt).toISOString(),
          fare: t.fare,
        }));
  const today = completed.filter((r) => date(r.at) === date(data.serverTime));
  const todayCash = today.reduce((s, r) => s + r.fare, 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const at = data.serverTime - (6 - i) * 86400000;
    return {
      at,
      day: new Date(at).toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        weekday: "short",
      }),
      fare: completed
        .filter((r) => date(r.at) === date(at))
        .reduce((s, r) => s + r.fare, 0),
    };
  });
  const weekCash = week.reduce((s, d) => s + d.fare, 0);
  const go = (screen: string, id?: string) => {
    setError("");
    router.setParams({
      screen,
      run: puj ? id || "" : "",
      trip: !puj ? id || "" : "",
    });
  };
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [page]);
  useEffect(() => {
    if (error) {
      scroll.current?.scrollTo({ y: 0, animated: true });
    }
  }, [error]);
  const perform = async (task: () => Promise<void>) => {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setWorking(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
      lock.current = false;
    }
  };
  const start = () =>
    perform(async () => {
      const value = await api<DriverRun>("/runs", { boarded: Number(boarded) });
      await refresh();
      setBoarded("0");
      go("Route", value.id);
    });
  const confirmStop = () =>
    perform(async () => {
      if (!run) {
        return;
      }
      if (
        await action(`/runs/${run.id}`, {
          action: "stop",
          revision: run.revision,
          boarded: Number(boarded),
          alighted: Number(alighted),
        })
      ) {
        setBoarded("0");
        setAlighted("0");
        go("Route", run.id);
      }
    });
  const finish = () => {
    if (!run) {
      return;
    }
    Alert.alert(
      "Complete this route run?",
      "Confirm that all remaining passengers have safely alighted at the final stop.",
      [
        { text: "Keep run open", style: "cancel" },
        {
          text: "Complete run",
          onPress: () => {
            void perform(async () => {
              if (
                await action(`/runs/${run.id}`, {
                  action: "complete",
                  revision: run.revision,
                })
              ) {
                go("Run complete", run.id);
              }
            });
          },
        },
      ],
    );
  };
  const shareRecords = () =>
    perform(async () => {
      Alert.alert("UI prototype", "Trip sharing preview. Nothing was shared.");
    });
  const routeCard = () =>
    assigned || run ? (
      <Pressable
        accessibilityRole="button"
        onPress={() => go(activeRun ? "Route" : "Terminal", activeRun?.id)}
        style={ps.card}
      >
        <Text style={ps.locationCaption}>Your assigned route</Text>
        <View style={ps.row}>
          <View style={ps.routeCode}>
            <Text style={ps.routeCodeText}>
              {activeRun?.routeId || assigned?.id || run?.routeId}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={ps.label}>
              {activeRun?.routeName || assigned?.name || run?.routeName}
            </Text>
            <Text style={ps.small}>
              Designated route · {stops.length || run?.stops.length} stops
            </Text>
          </View>
          <Icon name="chevron-forward" size={17} />
        </View>
      </Pressable>
    ) : (
      <Hint
        warning
        text="The administrator has not assigned a route yet. Contact support before starting route service."
      />
    );
  const map = (height = 260, forTrip = false) => (
    <CalbayogMap
      height={height}
      pickup={forTrip ? trip?.pickupPoint : stops[0] || run?.stops[0]}
      destination={
        forTrip
          ? trip?.destinationPoint
          : stops[stops.length - 1] || run?.stops[(run?.stops.length || 1) - 1]
      }
      geometry={forTrip ? trip?.geometry : null}
      vehicles={ownVehicle}
      stops={puj ? data.stopRequests : []}
      landmarks={[]}
    />
  );
  const recordList = () =>
    puj ? (
      <>
        {runs.map((r) => (
          <Pressable
            key={r.id}
            accessibilityRole="button"
            onPress={() =>
              go(r.status === "Completed" ? "Run complete" : "Route", r.id)
            }
            style={ps.card}
          >
            <View style={ps.row}>
              <Icon name="bus-outline" size={26} />
              <View style={{ flex: 1 }}>
                <Text style={ps.label}>{r.routeName}</Text>
                <Text style={ps.small}>
                  {date(r.startedAt)} · {time(r.startedAt)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[ps.label, { color: c.green }]}>
                  {money(r.cashFares)}
                </Text>
                <Tag text={r.status} />
              </View>
            </View>
            <Text style={ps.tiny}>
              {r.id.slice(0, 20)} · {r.totalBoarded} passenger boardings ·{" "}
              {r.stops.length} stops
            </Text>
            <Button
              title="View run record"
              light
              onPress={() =>
                go(r.status === "Completed" ? "Run complete" : "Route", r.id)
              }
            />
          </Pressable>
        ))}
        {!runs.length && (
          <Hint text="Your saved route runs appear here after your first departure." />
        )}
      </>
    ) : (
      <>
        {trips.map((t) => (
          <Pressable
            accessibilityRole="button"
            key={t.id}
            onPress={() => go("Trip", t.id)}
            style={ps.card}
          >
            <View style={ps.row}>
              <Icon name="bicycle-outline" size={26} />
              <View style={{ flex: 1 }}>
                <Text style={ps.label}>
                  {t.pickup} → {t.destination}
                </Text>
                <Text style={ps.small}>
                  {date(t.createdAt)} · {time(t.createdAt)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[ps.label, { color: c.green }]}>
                  {money(t.fare)}
                </Text>
                <Tag text={t.status} />
              </View>
            </View>
            <Text style={ps.tiny}>
              {t.id.slice(0, 20)} · {t.distance} km · {t.minutes} min
            </Text>
            <Button
              title="View trip record"
              light
              onPress={() => go("Trip", t.id)}
            />
          </Pressable>
        ))}
        {!trips.length && (
          <Hint text="Your accepted and completed trips appear here." />
        )}
      </>
    );
  let title = "Driver dashboard";
  let subtitle = `${puj ? "PUJ / PUV" : "TRICYCLE"} DRIVER${data.user.plate ? ` · ${data.user.plate}` : ""}`;
  let content: React.ReactNode;
  let footer: React.ReactNode = null;
  let back: string | null = null;
  if (page === "Dashboard") {
    const hour = Number(
      new Date(data.serverTime).toLocaleTimeString("en-GB", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        hourCycle: "h23",
      }),
    );
    title = `${hour >= 5 && hour < 12 ? "Maupay nga aga" : hour < 18 && hour >= 12 ? "Maupay nga kulop" : "Maupay nga gab-i"}, ${data.user.name.split(" ")[0]}`;
    content = (
      <>
        <View style={ps.banner}>
          <Text style={ps.bannerSub}>
            {data.user.plate || "Vehicle plate not provided"} ·{" "}
            {puj ? "PUJ / PUV" : "Tricycle"} · {data.user.capacity} passenger
            capacity
          </Text>
          <View style={[ps.card, { padding: 14 }]}>
            <View style={ps.between}>
              <View style={{ flex: 1 }}>
                <Text style={[ps.section, { color: c.green }]}>
                  {!data.user.verified
                    ? "Awaiting approval"
                    : data.user.available
                      ? "You’re available"
                      : "You’re offline"}
                </Text>
                <Text style={ps.small}>
                  {data.user.verified
                    ? puj
                      ? "Ready for assigned route service"
                      : "Ready for nearby ride requests"
                    : "Administrator review is required"}
                </Text>
              </View>
              <Switch
                accessibilityLabel="Driver availability"
                value={data.user.available}
                disabled={locked || !data.user.verified || !sharing}
                onValueChange={(available) => {
                  void action("/availability", { available });
                }}
                trackColor={{ false: "#D9E6DE", true: c.green }}
                thumbColor="white"
              />
            </View>
          </View>
        </View>
        {!sharing && (
          <Button
            title="Enable GPS to go online"
            icon="navigate-outline"
            light
            disabled={locked || !data.user.verified}
            onPress={() => {
              void toggleSharing();
            }}
          />
        )}
        {puj ? (
          routeCard()
        ) : (
          <>
            {map(210, true)}
            <Button
              title={
                activeTrip
                  ? "Continue your active trip"
                  : `${requests.length} nearby ride requests`
              }
              icon="bicycle-outline"
              onPress={() =>
                go(activeTrip ? "Trip" : "Requests", activeTrip?.id)
              }
            />
          </>
        )}
        {puj && assigned && (
          <View style={ps.banner}>
            <View style={ps.between}>
              <Text style={ps.bannerSub}>NEXT DEPARTURE</Text>
              <Tag
                text={
                  activeRun
                    ? "Run active"
                    : assigned.approved
                      ? "Scheduled"
                      : "Sample schedule"
                }
                amber
              />
            </View>
            <Text
              style={[ps.bannerTitle, { fontSize: 34, lineHeight: 44 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {activeRun ? "In progress" : departure(assigned, data.serverTime)}
            </Text>
            <Text style={ps.bannerSub}>
              {data.terminals.find((t) => t.routeId === assigned.id)?.name ||
                assigned.stops[0]?.name}
            </Text>
          </View>
        )}
        <Text style={ps.section}>
          {puj ? "Today’s run records" : "Today’s trip records"}
        </Text>
        <View style={ps.row}>
          <Stat
            value={today.length}
            label={puj ? "Completed runs" : "Completed trips"}
          />
          <Stat value={money(todayCash)} label="Cash fares logged" />
          <Stat
            value={
              puj
                ? `${activeRun?.onboard || 0} / ${data.user.capacity}`
                : requests.length
            }
            label={puj ? "On board" : "New requests"}
          />
        </View>
        <Hint
          warning={!fresh || !sharing}
          text={
            sharing && fresh
              ? `GPS live · updated ${time(data.user.location!.updatedAt)}. Availability off means unavailable for new service.`
              : "GPS is not live. Enable sharing while the app is active before going online."
          }
        />
      </>
    );
    footer = puj ? (
      <Button
        title={activeRun ? "Continue route run" : "View departure details"}
        icon="bus-outline"
        disabled={!assigned && !activeRun}
        onPress={() => go(activeRun ? "Route" : "Terminal", activeRun?.id)}
      />
    ) : (
      <Button
        title={activeTrip ? "Continue trip" : "View ride requests"}
        icon="navigate-outline"
        onPress={() => go(activeTrip ? "Trip" : "Requests", activeTrip?.id)}
      />
    );
  } else if (page === "Terminal") {
    title = "Ready at the terminal";
    back = "Dashboard";
    content = (
      <>
        {routeCard()}
        {assigned && (
          <>
            <View style={ps.card}>
              <Text style={ps.locationCaption}>Scheduled departure</Text>
              <Text style={ps.fare}>
                {departure(assigned, data.serverTime)}
              </Text>
              <Text style={ps.body}>
                {data.terminals.find((t) => t.routeId === assigned.id)?.name ||
                  assigned.stops[0]?.name}{" "}
                ·{" "}
                {assigned.approved ? "Configured schedule" : "Sample schedule"}
              </Text>
            </View>
            <View style={ps.card}>
              <Count
                label="Passengers on board at departure"
                value={boarded}
                onChange={setBoarded}
              />
              <Text style={ps.body}>
                {data.user.capacity} seats · Never exceed registered capacity
              </Text>
            </View>
            <Text style={ps.section}>Terminal schedule</Text>
            {data.routes
              .filter((r) => r.active && r.id === assigned.id)
              .map((r) => (
                <View key={r.id} style={ps.card}>
                  <View style={ps.between}>
                    <Text style={ps.label}>{r.name}</Text>
                    <Tag text={departure(r, data.serverTime)} />
                  </View>
                  <Text style={ps.small}>
                    {r.startsAt}–{r.endsAt} · Every {r.interval} minutes
                  </Text>
                </View>
              ))}
          </>
        )}
        <Hint text="Check that passengers are seated and doors are secure. Start only while safely stopped. Cash entries use the configured per-passenger fare." />
      </>
    );
    footer = (
      <Button
        title={
          working
            ? "Starting run…"
            : activeRun
              ? "Resume active run"
              : "Depart terminal · start run"
        }
        icon="play-outline"
        disabled={
          locked ||
          !data.user.verified ||
          !data.user.available ||
          !sharing ||
          !assigned ||
          !Number.isInteger(Number(boarded)) ||
          Number(boarded) < 0 ||
          Number(boarded) > data.user.capacity
        }
        onPress={() => (activeRun ? go("Route", activeRun.id) : void start())}
      />
    );
  } else if (page === "Route" || page === "Pickup") {
    title =
      page === "Pickup"
        ? "Passengers at the next stop"
        : activeRun
          ? `Following route ${activeRun.routeId}`
          : "Your assigned route";
    back = page === "Pickup" ? "Route" : "Dashboard";
    if (!activeRun) {
      content = (
        <>
          {routeCard()}
          {map()}
          <Button
            title="Browse routes & terminals"
            light
            onPress={() => go("Routes")}
          />
        </>
      );
      footer = (
        <Button
          title="View departure details"
          disabled={!assigned}
          onPress={() => go("Terminal")}
        />
      );
    } else {
      const next = activeRun.stops[activeRun.stopIndex + 1];
      content = (
        <>
          {routeCard()}
          {map(page === "Pickup" ? 220 : 280)}
          <View style={ps.between}>
            <Text style={ps.section}>
              {activeRun.onboard} / {activeRun.capacity} on board
            </Text>
            <Tag
              text={`${activeRun.capacity - activeRun.onboard} seats free`}
            />
          </View>
          {(!sharing || !fresh || !connected) && (
            <Hint
              warning
              text={`GPS stale or connection unavailable${data.user.location ? ` · last update ${time(data.user.location.updatedAt)}` : ""}. Showing your last known position. No live arrival time is promised.`}
            />
          )}
          <Button
            title="Retry GPS & connection"
            icon="refresh-outline"
            light
            disabled={locked}
            onPress={() => {
              void perform(async () => {
                if (!sharing) {
                  await toggleSharing();
                }
                await refresh();
              });
            }}
          />
          {page === "Pickup" && next ? (
            <>
              <View style={ps.card}>
                <Text style={ps.locationCaption}>
                  Next configured meeting point
                </Text>
                <Text style={ps.section}>{next.name}</Text>
                <Text style={ps.small}>
                  Board only when safely stopped at the configured stop.
                </Text>
              </View>
              <View style={ps.row}>
                <Count
                  label="Passengers boarding"
                  value={boarded}
                  onChange={setBoarded}
                />
                <Count
                  label="Passengers alighting"
                  value={alighted}
                  onChange={setAlighted}
                />
              </View>
              <View style={ps.row}>
                <Stat
                  value={`${activeRun.onboard} / ${activeRun.capacity}`}
                  label="On board now"
                />
                <Stat
                  value={activeRun.onboard - Number(alighted) + Number(boarded)}
                  label="After boarding"
                />
              </View>
              <Hint
                warning
                text={`Recorded flat fare: ${money(activeRun.fare)} per passenger${activeRun.sampleFare ? " · sample, not an official tariff" : ""}. Confirm actual counts before saving.`}
              />
            </>
          ) : (
            <View style={ps.card}>
              {activeRun.stops.map((point, i) => (
                <View style={ps.stopRow} key={`${point.name}-${i}`}>
                  <View style={ps.stopLine} />
                  <View
                    style={[
                      ps.dot,
                      i > activeRun.stopIndex && { backgroundColor: c.amber },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={ps.label}>{point.name}</Text>
                    <Text style={ps.tiny}>
                      {i < activeRun.stopIndex
                        ? "Stop confirmed"
                        : i === activeRun.stopIndex
                          ? "Current confirmed stop"
                          : "Upcoming stop · no live ETA"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          {data.stopRequests.length > 0 && (
            <>
              <Text style={ps.section}>Passenger pickup requests</Text>
              {data.stopRequests.map((request) => (
                <View style={ps.card} key={request.id}>
                  <Text style={ps.label}>{request.passenger}</Text>
                  <Text style={ps.body}>{request.point.name}</Text>
                  <Button
                    title="Mark request picked up"
                    light
                    disabled={locked}
                    onPress={() => {
                      Alert.alert(
                        "Confirm pickup",
                        "This clears the request only. Record the passenger in the boarding count separately.",
                        [
                          { text: "Not yet", style: "cancel" },
                          {
                            text: "Picked up",
                            onPress: () => {
                              void action(`/stops/${request.id}`, {}, "DELETE");
                            },
                          },
                        ],
                      );
                    }}
                  />
                </View>
              ))}
            </>
          )}
        </>
      );
      footer = next ? (
        page === "Pickup" ? (
          <Button
            title="Confirm stop & passenger counts"
            icon="checkmark-outline"
            disabled={locked}
            onPress={() => {
              void confirmStop();
            }}
          />
        ) : (
          <Button
            title="View upcoming pickup"
            icon="people-outline"
            onPress={() => {
              setBoarded("0");
              setAlighted("0");
              go("Pickup", activeRun.id);
            }}
          />
        )
      ) : (
        <Button
          title="Complete route run"
          icon="checkmark-circle-outline"
          disabled={locked}
          onPress={finish}
        />
      );
    }
  } else if (page === "Run complete") {
    title = "Route run complete";
    back = "Records";
    content = run ? (
      <>
        <View style={ps.banner}>
          <View style={ps.row}>
            <Icon name="checkmark-circle-outline" size={33} color="white" />
            <View style={{ flex: 1 }}>
              <Text style={ps.bannerTitle}>
                {run.status === "Completed"
                  ? "Arrived at the final stop"
                  : "Route run record"}
              </Text>
              <Text style={ps.bannerSub}>
                {run.routeId} · {run.routeName}
              </Text>
              <Text style={ps.bannerSub}>
                {date(run.startedAt)} · {time(run.startedAt)}
                {run.endedAt ? `–${time(run.endedAt)}` : ""}
              </Text>
            </View>
          </View>
        </View>
        <View style={ps.card}>
          <View style={ps.between}>
            <Text style={ps.section}>Cash fares recorded</Text>
            <Text style={ps.fare}>{money(run.cashFares)}</Text>
          </View>
          <Text style={ps.small}>
            {run.totalBoarded} passenger boardings × {money(run.fare)} ·{" "}
            {run.sampleFare
              ? "sample fare, not an official tariff"
              : run.reference}
          </Text>
          <View style={ps.divider} />
          <Text style={ps.body}>
            {run.driver} · {run.plate} · {run.capacity} registered seats
          </Text>
        </View>
        <Text style={ps.section}>Run log</Text>
        <View style={ps.card}>
          {run.events.map((event, i) => (
            <View style={ps.between} key={i}>
              <Text style={ps.small}>{time(event.at)}</Text>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={ps.label}>{event.stop}</Text>
                <Text style={ps.tiny}>
                  {event.type} · {event.boarded} boarded · {event.alighted}{" "}
                  alighted
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Hint text="This is a cash fare record, not a wallet or payout balance." />
      </>
    ) : (
      <Hint text="No run record is available yet." />
    );
    footer = (
      <Button
        title="Back to dashboard"
        icon="speedometer-outline"
        onPress={() => go("Dashboard")}
      />
    );
  } else if (page === "Requests") {
    title = "Nearby ride requests";
    subtitle = "Nearest-driver matching · fixed cash fares";
    back = "Dashboard";
    content = (
      <>
        {requests.map((t) => (
          <View style={ps.card} key={t.id}>
            <View style={ps.between}>
              <Tag text="New request" />
              <Text style={ps.fare}>{money(t.fare)}</Text>
            </View>
            <Text style={ps.section}>
              {t.pickup} → {t.destination}
            </Text>
            <Text style={ps.body}>
              {t.passenger} · {t.distance} km · about {t.minutes} min
            </Text>
            {Boolean(t.pickupNote) && (
              <Text style={ps.body}>Pickup note: {t.pickupNote}</Text>
            )}
            <Button
              title="Accept ride request"
              disabled={
                locked || !data.user.available || !sharing || !!activeTrip
              }
              onPress={() => {
                void perform(async () => {
                  if (await action(`/trips/${t.id}`, { status: "Accepted" })) {
                    go("Trip", t.id);
                  }
                });
              }}
            />
            <Button
              title="Decline · offer to next driver"
              light
              disabled={locked}
              onPress={() => {
                void action(`/trips/${t.id}/decline`, {});
              }}
            />
          </View>
        ))}
        {!requests.length && (
          <Hint text="No rides are offered to you right now. Approved, available drivers with recent GPS receive nearby offers." />
        )}
      </>
    );
  } else if (page === "Trip") {
    title =
      trip?.status === "In progress"
        ? "Trip in progress"
        : "Your tricycle trip";
    back = "Records";
    content = trip ? (
      <>
        {map(280, true)}
        <View style={ps.card}>
          <View style={ps.between}>
            <Tag text={trip.status} />
            <Text style={ps.fare}>{money(trip.fare)}</Text>
          </View>
          <Text style={ps.section}>{trip.passenger}</Text>
          <Text style={ps.label}>Pickup · {trip.pickup}</Text>
          <Text style={ps.label}>Destination · {trip.destination}</Text>
          {Boolean(trip.pickupNote) && (
            <Text style={ps.body}>Pickup note: {trip.pickupNote}</Text>
          )}
          <Text style={ps.small}>
            {trip.distance} km · about {trip.minutes} min ·{" "}
            {trip.sampleFare ? "Sample fixed fare" : "Configured fixed fare"}
          </Text>
        </View>
        <Hint text="Use trip controls only while safely stopped. Confirm each stage with your passenger." />
        <Button
          title="Report a trip issue"
          light
          onPress={() => go("Support", trip.id)}
        />
      </>
    ) : (
      <Hint text="No trip selected. Open a trip from your records." />
    );
    if (trip && ["Accepted", "Arrived", "In progress"].includes(trip.status)) {
      const next = {
        Accepted: "Arrived",
        Arrived: "In progress",
        "In progress": "Completed",
      } as const;
      const labels = {
        Accepted: "Mark arrived at pickup",
        Arrived: "Start passenger trip",
        "In progress": "Complete trip · cash fare recorded",
      };
      footer = (
        <Button
          title={labels[trip.status as keyof typeof next]}
          icon="checkmark-outline"
          disabled={locked}
          onPress={() => {
            void action(`/trips/${trip.id}`, {
              status: next[trip.status as keyof typeof next],
            });
          }}
        />
      );
    }
  } else if (page === "Routes") {
    title = "Routes & terminals";
    subtitle = "Live local departure information";
    back = "Route";
    const from = routeFrom.trim().toLowerCase();
    const to = routeTo.trim().toLowerCase();
    const routeMatches = data.routes.filter((route) => {
      if (
        !route.active ||
        (assignedRoutesOnly && route.id !== data.user.routeId)
      ) {
        return false;
      }
      if (!routeSearchActive) {
        return true;
      }
      const stopNames = route.stops.map((stop) => stop.name.toLowerCase());
      const fromIndex = stopNames.findIndex((stop) => stop.includes(from));
      const toIndex = stopNames.findIndex((stop) => stop.includes(to));
      return fromIndex >= 0 && toIndex >= fromIndex;
    });
    const nearbyTerminals = data.terminals.filter(
      (terminal) => terminal.active,
    );
    const visibleTerminals = showAllTerminals
      ? nearbyTerminals
      : nearbyTerminals.slice(0, 1);
    content = (
      <>
        <View style={[ps.card, { padding: 14, gap: 9 }]}>
          <View style={ps.location}>
            <View style={ps.dot} />
            <View style={{ flex: 1 }}>
              <Text style={ps.locationCaption}>From</Text>
              <TextInput
                accessibilityLabel="From"
                style={[ps.label, { padding: 0 }]}
                value={routeFrom}
                onChangeText={(value) => {
                  setRouteFrom(value);
                  setRouteSearchActive(false);
                }}
                placeholder="Choose departure point"
                placeholderTextColor={c.muted}
              />
            </View>
            <Icon name="chevron-forward" size={18} color={c.muted} />
          </View>
          <View style={ps.location}>
            <View style={[ps.dot, ps.square, { backgroundColor: c.amber }]} />
            <View style={{ flex: 1 }}>
              <Text style={ps.locationCaption}>To</Text>
              <TextInput
                accessibilityLabel="To"
                style={[ps.label, { padding: 0 }]}
                value={routeTo}
                onChangeText={(value) => {
                  setRouteTo(value);
                  setRouteSearchActive(false);
                }}
                placeholder="Choose destination"
                placeholderTextColor={c.muted}
              />
            </View>
            <Icon name="chevron-forward" size={18} color={c.muted} />
          </View>
          <Button
            title="Find PUJ/PUV routes"
            icon="search-outline"
            onPress={() => setRouteSearchActive(true)}
          />
        </View>
        <View style={ps.between}>
          <Text style={ps.section}>Best matches</Text>
          <Pressable accessibilityRole="button" onPress={() => go("Route")}>
            <Text style={ps.textLink}>View map</Text>
          </Pressable>
        </View>
        {routeMatches.map((route) => (
          <Pressable
            key={route.id}
            accessibilityRole="button"
            accessibilityLabel={`${route.id}, ${route.name}, departs ${departure(route, data.serverTime)}`}
            onPress={() => {
              setRouteFrom(route.stops[0]?.name || "");
              setRouteTo(route.stops[route.stops.length - 1]?.name || "");
              setRouteSearchActive(true);
            }}
            style={[
              ps.card,
              { padding: 13, gap: 10 },
              route.id === data.user.routeId && ps.selected,
            ]}
          >
            <View style={ps.row}>
              <View style={ps.routeCode}>
                <Text style={ps.routeCodeText}>{route.id}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ps.label}>{route.name}</Text>
                <Text style={ps.small} numberOfLines={1}>
                  {route.stops.map((stop) => stop.name).join(" · ")}
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={c.muted} />
            </View>
            <View style={ps.between}>
              <View style={ps.pill}>
                <Icon name="time-outline" size={14} color={c.green} />
                <Text style={ps.pillText}>
                  Departs {departure(route, data.serverTime)}
                </Text>
              </View>
              <View style={[ps.pill, { backgroundColor: "#E8F2FA" }]}>
                <Icon name="people" size={14} color="#3479B8" />
                <Text style={[ps.pillText, { color: "#3479B8" }]}>
                  {data.user.capacity} seats
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
        {!routeMatches.length && (
          <Hint text="No routes match those stops. Try another departure and destination." />
        )}
        <View style={ps.between}>
          <Text style={ps.section}>Nearby terminals</Text>
          {nearbyTerminals.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllTerminals((showAll) => !showAll)}
            >
              <Text style={ps.textLink}>
                {showAllTerminals ? "Show less" : "See all"}
              </Text>
            </Pressable>
          )}
        </View>
        {visibleTerminals.map((terminal) => {
          const terminalRoute = data.routes.find(
            (route) => route.id === terminal.routeId,
          );
          const departures = terminalRoute ? departureCount(terminalRoute) : 0;
          return (
            <View key={terminal.id} style={[ps.banner, { padding: 13 }]}>
              <View style={ps.row}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    backgroundColor: "#155847",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="business-outline" color="white" size={22} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[ps.bannerSub, { color: "white" }]}
                    numberOfLines={1}
                  >
                    {terminal.name}
                  </Text>
                  <Text style={ps.tiny}>
                    {terminal.routeId} · Local terminal
                  </Text>
                </View>
                <View style={[ps.pill, { backgroundColor: "#FFF2D9" }]}>
                  <Text style={[ps.pillText, { color: "#A85D10" }]}>
                    {departures} departures
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
        {!visibleTerminals.length && (
          <Hint text="No active terminals are listed for the available routes." />
        )}
        <View style={[ps.row, { alignItems: "flex-start", gap: 7 }]}>
          <Icon name="information-circle" size={16} color={c.muted} />
          <Text style={[ps.small, { flex: 1 }]}>
            Schedules are terminal-managed and may shift with loading time.
          </Text>
        </View>
      </>
    );
  } else if (page === "Records") {
    title = puj ? "Your run records" : "Your trips";
    subtitle = "Cash records, routes, and driver details";
    content = <>{recordList()}</>;
  } else if (page === "Earnings") {
    title = "Earnings";
    subtitle = "Transparent trip and cash fare records";
    const max = Math.max(1, ...week.map((d) => d.fare));
    content = (
      <>
        <View style={ps.banner}>
          <View style={ps.between}>
            <Text style={ps.bannerSub}>LAST 7 DAYS</Text>
            <Tag
              text={`${date(week[0].at).slice(5)}–${date(data.serverTime).slice(5)}`}
            />
          </View>
          <Text
            style={[ps.bannerTitle, { fontSize: 35, lineHeight: 44 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {money(weekCash)}
          </Text>
          <Text style={ps.bannerSub}>
            {
              completed.filter((r) =>
                week.some((d) => date(d.at) === date(r.at)),
              ).length
            }{" "}
            completed {puj ? "runs" : "trips"} · recorded cash fares
          </Text>
        </View>
        <View style={ps.card}>
          <View style={ps.between}>
            <Text style={ps.section}>Daily earnings</Text>
            <Text style={ps.tiny}>Avg {money(weekCash / 7)}/day</Text>
          </View>
          <View
            style={{
              height: 150,
              flexDirection: "row",
              gap: 12,
              alignItems: "flex-end",
            }}
          >
            {week.map((day, i) => (
              <View
                key={day.at}
                style={{
                  flex: 1,
                  height: "100%",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: "100%",
                    height: Math.max(2, (day.fare / max) * 110),
                    borderRadius: 6,
                    backgroundColor: i === 5 ? c.amber : c.green,
                  }}
                />
                <Text style={ps.tiny}>{day.day.slice(0, 1)}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={ps.row}>
          <Stat value={money(todayCash)} label="Today" />
          <Stat value="₱0" label="Platform fees" />
          <Stat value={money(weekCash)} label="Recorded cash" />
        </View>
        <View style={ps.between}>
          <Text style={ps.section}>Recent earnings</Text>
          <Pressable accessibilityRole="button" onPress={() => go("Records")}>
            <Text style={ps.textLink}>See all</Text>
          </Pressable>
        </View>
        {completed.slice(0, 8).map((record) => (
          <View key={record.id} style={ps.location}>
            <Icon name={puj ? "bus-outline" : "bicycle-outline"} />
            <View style={{ flex: 1 }}>
              <Text style={ps.label}>{record.name}</Text>
              <Text style={ps.tiny}>
                {date(record.at)} · {time(record.at)}
              </Text>
            </View>
            <Text style={[ps.label, { color: c.green }]}>
              {money(record.fare)}
            </Text>
          </View>
        ))}
        {!completed.length && (
          <Hint text="Earnings appear when you complete actual trips or route runs. No simulated amounts are added." />
        )}
        <Hint text="Cash is collected directly from passengers. These records are not a wallet balance or an in-app payout." />
      </>
    );
    footer = (
      <Button
        title="Export / share cash records"
        icon="download-outline"
        light
        disabled={locked}
        onPress={() => {
          void shareRecords();
        }}
      />
    );
  } else if (page === "Profile" || page === "Documents") {
    title = page === "Documents" ? "Driver account records" : "Driver profile";
    back = page === "Documents" ? "Profile" : null;
    content = (
      <>
        <View style={ps.banner}>
          <View style={ps.row}>
            <View style={[ps.avatar, { backgroundColor: "#DCEFE4" }]}>
              <Text style={[ps.avatarText, { color: c.green }]}>
                {initials(data.user.name)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ps.section, { color: "white" }]}>
                {data.user.name}
              </Text>
              <Text style={ps.bannerSub}>{data.user.role}</Text>
              <Text style={ps.bannerSub}>
                {data.user.verified
                  ? "Approved driver"
                  : "Awaiting administrator approval"}
              </Text>
            </View>
          </View>
        </View>
        <View style={ps.card}>
          <Text style={ps.section}>Professional license & cooperative</Text>
          <View style={ps.between}>
            <Text style={ps.body}>License</Text>
            <Text style={ps.label}>{data.user.license || "Not supplied"}</Text>
          </View>
          <Text style={ps.small}>
            Expiry date not recorded · approval is managed by the administrator
          </Text>
          <View style={ps.divider} />
          <Text style={ps.label}>
            {data.user.association || "No association provided"}
          </Text>
        </View>
        <View style={ps.card}>
          <View style={ps.between}>
            <Text style={ps.section}>
              {puj ? "Registered PUJ / PUV" : "Registered tricycle"}
            </Text>
            <Tag
              text={data.user.verified ? "Approved" : "Pending"}
              amber={!data.user.verified}
            />
          </View>
          <View style={ps.between}>
            <Text style={ps.body}>Plate / body</Text>
            <Text style={ps.label}>{data.user.plate || "—"}</Text>
          </View>
          <View style={ps.between}>
            <Text style={ps.body}>Capacity</Text>
            <Text style={ps.label}>{data.user.capacity} passengers</Text>
          </View>
        </View>
        {puj && routeCard()}
        <View style={ps.banner}>
          <View style={ps.between}>
            <Text style={ps.bannerSub}>
              TODAY · {today.length} COMPLETED {puj ? "RUNS" : "TRIPS"}
            </Text>
            <Text style={[ps.fare, { color: "white" }]}>
              {money(todayCash)}
            </Text>
          </View>
          <Text style={ps.bannerSub}>
            Cash fare records only · not a wallet or payout balance
          </Text>
        </View>
        <View style={ps.tabRow}>
          <Pressable accessibilityRole="button" onPress={() => go("Documents")}>
            <Text style={ps.textLink}>View records</Text>
          </Pressable>
          <Text style={ps.small}>·</Text>
          <Pressable accessibilityRole="button" onPress={() => go("Account")}>
            <Text style={ps.textLink}>Account & security</Text>
          </Pressable>
        </View>
        <Button
          title="Request account or vehicle changes"
          light
          onPress={() => go("Support")}
        />
        <Button
          title="Sign out"
          light
          disabled={locked}
          onPress={() => {
            void logout();
          }}
        />
      </>
    );
  } else if (page === "Account") {
    title = "Account & security";
    back = "Profile";
    content = (
      <>
        <Text style={ps.label}>Display name</Text>
        <TextInput
          accessibilityLabel="Display name"
          style={ps.input}
          value={name}
          onChangeText={setName}
        />
        <Text style={ps.label}>Contact number</Text>
        <TextInput
          accessibilityLabel="Contact number"
          style={ps.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Text style={ps.body}>{data.user.email}</Text>
        <Button
          title="Save account details"
          disabled={locked || !name.trim()}
          onPress={() => {
            void action("/profile", { name, phone }, "PATCH");
          }}
        />
        <Button
          title="Sign out"
          light
          disabled={locked}
          onPress={() => {
            void logout();
          }}
        />
        <Hint text="Email/password sign-in is protected by Firebase. License, association, vehicle details, and route assignment require administrator review." />
        {sharing && (
          <Button
            title="Stop GPS sharing & go offline"
            light
            disabled={locked}
            onPress={() => {
              void toggleSharing();
            }}
          />
        )}
      </>
    );
  } else if (page === "Notifications") {
    title = "Your notifications";
    back = "Dashboard";
    content = (
      <>
        <Button
          title="Mark all as read"
          light
          onPress={() => {
            void action("/notifications/read", {});
          }}
        />
        {data.notifications.map((n) => (
          <View key={n.id} style={ps.card}>
            <Text style={ps.label}>{n.message}</Text>
            <Text style={ps.small}>
              {date(n.createdAt)} · {time(n.createdAt)}
            </Text>
          </View>
        ))}
        {!data.notifications.length && <Hint text="You’re all caught up." />}
      </>
    );
  } else {
    title = "Driver support";
    back = "Profile";
    content = (
      <>
        <Hint text="Report account, route, passenger, or vehicle issues to the transport administrator." />
        <TextInput
          accessibilityLabel="Driver support details"
          value={report}
          onChangeText={setReport}
          placeholder="Describe your issue…"
          placeholderTextColor={c.muted}
          multiline
          maxLength={2000}
          style={[ps.input, { minHeight: 130, textAlignVertical: "top" }]}
        />
        <Button
          title="Send report"
          disabled={locked || report.trim().length < 5}
          onPress={() => {
            void perform(async () => {
              if (
                await action("/report", {
                  details: report,
                  tripId: params.trip || null,
                })
              ) {
                setReport("");
              }
            });
          }}
        />
        {data.reports.map((r) => (
          <View key={r.id} style={ps.card}>
            <Tag text={r.status} />
            <Text style={ps.body}>{r.details}</Text>
          </View>
        ))}
      </>
    );
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!back) {
          return false;
        }
        router.setParams({ screen: back });
        return true;
      },
    );
    return () => subscription.remove();
  }, [back]);
  const tabs = puj
    ? [
        { label: "Dashboard", icon: "speedometer-outline" },
        { label: "Route", icon: "git-network-outline" },
        { label: "Records", icon: "time-outline" },
        { label: "Earnings", icon: "wallet-outline" },
        { label: "Profile", icon: "person-outline" },
      ]
    : [
        { label: "Dashboard", icon: "speedometer-outline" },
        { label: "Records", icon: "map-outline" },
        { label: "Earnings", icon: "wallet-outline" },
        { label: "Profile", icon: "person-outline" },
      ];
  return (
    <View style={ps.app}>
      <View style={ps.header}>
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={ps.iconButton}
            onPress={() => go(back!)}
          >
            <Icon name="arrow-back" size={25} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[ps.tiny, { color: c.green, fontWeight: "700" }]}>
            {subtitle}
          </Text>
          <Text
            accessibilityRole="header"
            style={[ps.heading, { fontSize: 22 }]}
          >
            {title}
          </Text>
        </View>
        {(page === "Dashboard" ||
          page === "Earnings" ||
          (puj && page === "Routes")) && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={
              page === "Routes" ? { selected: assignedRoutesOnly } : undefined
            }
            accessibilityLabel={
              page === "Earnings"
                ? "Share cash records"
                : page === "Routes"
                  ? assignedRoutesOnly
                    ? "Show all routes"
                    : "Show assigned route only"
                  : "Notifications"
            }
            style={ps.iconButton}
            onPress={() =>
              page === "Earnings"
                ? void shareRecords()
                : page === "Routes"
                  ? setAssignedRoutesOnly((assignedOnly) => !assignedOnly)
                  : go("Notifications")
            }
          >
            <Icon
              name={
                page === "Earnings"
                  ? "download-outline"
                  : page === "Routes"
                    ? "options-outline"
                    : "notifications-outline"
              }
              size={22}
            />
          </Pressable>
        )}
      </View>
      <ScrollView
        ref={scroll}
        style={ps.scroll}
        contentContainerStyle={ps.content}
        keyboardShouldPersistTaps="handled"
      >
        {!connected && (
          <Hint warning text="Connection lost. Showing last saved records." />
        )}
        {Boolean(error) && <Hint warning text={error} />}
        {Boolean(notice) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
            onPress={dismissNotice}
          >
            <Hint text={`${notice}  ×`} />
          </Pressable>
        )}
        {content}
      </ScrollView>
      {footer && (
        <View style={ps.footer}>
          {footer}
          <Text style={ps.disclaimer}>
            Configured route, fare & schedule data · sample values are not
            official tariffs
          </Text>
        </View>
      )}
      {!back && (
        <View style={ps.nav}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: page === tab.label }}
              onPress={() => go(tab.label)}
              style={ps.navItem}
            >
              <Icon
                name={tab.icon as IconName}
                size={23}
                color={page === tab.label ? c.green : "#93A79B"}
              />
              <Text
                style={[
                  ps.navLabel,
                  page === tab.label && { color: c.green, fontWeight: "600" },
                ]}
              >
                {tab.label === "Records" && !puj ? "Trips" : tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
