import React, { useEffect, useRef, useState } from "react";
import { greeting, nextDeparture, waitLabel } from "../domain/schedule";
import { statusLabel, isPhMobile, normalizePhMobile } from "../domain/format";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { confirmAccountDeletion } from "../common/confirmAccountDeletion";
import type { Snapshot, DriverRun } from "../types/types";
import { api } from "../services/api";
import { Icon, money } from "../common/ui";
import CalbayogMap from "../map/CalbayogMap";
import { RouteBoard } from "../common/RouteBoard";
import { BodyNumber } from "../common/BodyNumber";
import { Glyph, type GlyphName } from "../common/Glyph";
import Avatar from "../common/Avatar";
import { distanceKm } from "../services/mapbox";
import { ps, passengerColors as c } from "../passenger/passengerStyles";
import { pickDriverPhoto, Share, Linking } from "../services/previewActions";
import { isFinished } from "../domain/roles";
import { haptic } from "../common/haptics";
import { useNow } from "../common/useNow";

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

/** Straight-line distance in km; good enough to rank nearby ride offers. */
function awayKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
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
      style={({ pressed }) => [
        ps.button,
        light && ps.buttonLight,
        disabled && { opacity: 0.45 },
        pressed && ps.pressed,
      ]}
    >
      {icon && <Icon name={icon} color={light ? c.brand : c.onBrand} size={19} />}
      <Text style={[ps.buttonText, light && { color: c.brand }]}>{title}</Text>
    </Pressable>
  );
}
function Tag({ text, amber }: { text: string; amber?: boolean }) {
  return (
    <View style={ps.pill}>
      <View style={[ps.square, { width: 9, height: 9 }, amber && { backgroundColor: c.amber }]} />
      <Text style={[ps.pillText, amber && { color: c.amber }]}>{text}</Text>
    </View>
  );
}
function Hint({
  text,
  info,
  warning,
  icon = "information-circle-outline",
}: {
  text: string;
  info?: boolean;
  warning?: boolean;
  icon?: IconName;
}) {
  return (
    <View style={[ps.hint, (info || !warning) && ps.info]}>
      <Icon
        name={icon || (warning ? "warning-outline" : "shield-checkmark-outline")}
        color={warning ? c.amber : c.muted}
        size={16}
      />
      <Text style={[ps.hintText, (info || !warning) && { color: c.muted }]}>
        {text}
      </Text>
    </View>
  );
}
function Locations({ pickup, destination }: { pickup: string; destination: string }) {
  return <RouteBoard from={pickup} to={destination} compact />;
}
function Row({ title, detail, onPress, danger, last }: { title: string; detail?: string; onPress?: () => void; danger?: boolean; last?: boolean }) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        ps.between,
        { minHeight: 54, paddingVertical: 12 },
        !last && { borderBottomWidth: 1, borderBottomColor: "#D6D7D1" },
        pressed && ps.pressed,
      ]}
    >
      <Text style={[ps.label, { fontWeight: "500" }, danger && { color: c.red }]}>{title}</Text>
      <View style={[ps.row, { gap: 6, flexShrink: 1 }]}>
        {detail ? <Text style={[ps.small, { textAlign: "right", flexShrink: 1 }]} numberOfLines={1}>{detail}</Text> : null}
        {onPress && !danger ? <Icon name="chevron-forward" size={18} color={c.muted} /> : null}
      </View>
    </Pressable>
  );
}
function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 4, gap: 2, minWidth: 0 }}>
      <Text
        style={[ps.section, { fontSize: 20, lineHeight: 26, flexShrink: 1, fontVariant: ["tabular-nums"] }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={ps.tiny}>{label}</Text>
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
const dayKey = (at: string | number) =>
  new Date(at).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const date = (at: string | number) =>
  new Date(at).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const shortDate = (at: string | number) =>
  new Date(at).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "short",
  });
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
  const insets = useSafeAreaInsets();
  const navLift = insets.bottom > 0 ? Math.max(insets.bottom - 20, 0) : 0;
  const params = useLocalSearchParams<{
    screen?: string;
    run?: string;
    trip?: string;
  }>();
  const puj = data.user.role === "PUJ / PUV driver";
  const online = data.user.available && sharing;
  const unread = data.notifications.filter((n) => !n.read).length;
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
      aliases[params.screen || ""] || params.screen || "Dashboard",
    page = allowed.includes(requested) ? requested : "Dashboard";
  const [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [boarded, setBoarded] = useState("0"),
    [alighted, setAlighted] = useState("0"),
    [query, setQuery] = useState(""),
    [name, setName] = useState(data.user.name),
    [phone, setPhone] = useState(data.user.phone),
    [report, setReport] = useState("");
  const lock = useRef(false),
    scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const locked = busy || working;
  const now = useNow(15_000);
  const runs = data.runs || [],
    activeRun = runs.find((r) => r.status === "In progress"),
    run = runs.find((r) => r.id === params.run) || activeRun || runs[0];
  const trips = data.trips.filter((t) => t.driverId === data.user.id),
    requests = data.trips
      .filter(
        (t) =>
          t.status === "Requested" &&
          data.user.available &&
          (!t.expires || t.expires > now),
      )
      .sort((a, b) =>
        data.user.location
          ? awayKm(data.user.location, a.pickupPoint) -
            awayKm(data.user.location, b.pickupPoint)
          : 0,
      ),
    activeTrip = trips.find((t) => !isFinished(t)),
    trip = trips.find((t) => t.id === params.trip) || activeTrip || trips[0];
  const assigned = data.routes.find((r) => r.id === data.user.routeId),
    stops = activeRun?.stops || assigned?.stops || [];
  const corridorStops = stops.length ? stops : run?.stops || [];
  const waiting = data.stopRequests.filter(
    (request) => request.routeId === (activeRun?.routeId || assigned?.id),
  );
  const corridor =
    puj && corridorStops.length > 1
      ? {
          type: "LineString" as const,
          coordinates: corridorStops.map((p) => [p.longitude, p.latitude]),
        }
      : null;
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
        .filter((t) => t.status === "Completed" && !t.demoPayment)
        .map((t) => ({
          id: t.id,
          name: `${t.pickup} → ${t.destination}`,
          at: new Date(t.timestamps.Completed || t.createdAt).toISOString(),
          fare: t.fare,
        }));
  const today = completed.filter((r) => dayKey(r.at) === dayKey(data.serverTime)),
    todayCash = today.reduce((s, r) => s + r.fare, 0),
    week = Array.from({ length: 7 }, (_, i) => {
      const at = data.serverTime - (6 - i) * 86400000;
      return {
        at,
        day: new Date(at).toLocaleDateString("en-PH", {
          timeZone: "Asia/Manila",
          weekday: "short",
        }),
        fare: completed
          .filter((r) => dayKey(r.at) === dayKey(at))
          .reduce((s, r) => s + r.fare, 0),
      };
    }),
    weekCash = week.reduce((s, d) => s + d.fare, 0);
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
      "Complete this trip?",
      "Confirm that all remaining passengers have safely alighted at the final stop.",
      [
        { text: "Keep trip open", style: "cancel" },
        {
          text: "Complete trip",
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
      await Share.share({
        title: "Angkol cash fare records",
        message: `Angkol · ${data.user.name}\nCash fare records, not a payout or wallet balance\n${completed.map((r) => `${date(r.at)} · ${r.name} · ${money(r.fare)}`).join("\n") || "No completed records."}`,
      });
    });
  const routeCard = () =>
    assigned || run ? (
      <Pressable
        accessibilityRole="button"
        onPress={() => go(activeRun ? "Route" : "Terminal", activeRun?.id)}
        style={ps.card}
      >
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
              {stops.length || run?.stops.length} stops
            </Text>
          </View>
          <Icon name="chevron-forward" size={17} color={c.muted} />
        </View>
      </Pressable>
    ) : (
      <Hint
        warning
        text="No route assigned yet. Ask the transport office."
      />
    );
  const map = (height = 260, forTrip = false) => (
    <CalbayogMap
      height={height}
      pickup={
        forTrip
          ? ["Accepted", "Arrived"].includes(trip?.status || "")
            ? data.user.location
            : trip?.pickupPoint
          : stops[0] || run?.stops[0]
      }
      pickupLabel={
        forTrip && ["Accepted", "Arrived"].includes(trip?.status || "")
          ? "You"
          : undefined
      }
      destinationLabel={
        forTrip && ["Accepted", "Arrived"].includes(trip?.status || "")
          ? `Pickup · ${trip?.pickup ?? ""}`
          : undefined
      }
      destination={
        forTrip
          ? ["Accepted", "Arrived"].includes(trip?.status || "")
            ? trip?.pickupPoint
            : trip?.destinationPoint
          : stops[stops.length - 1] || run?.stops[(run?.stops.length || 1) - 1]
      }
      geometry={
        forTrip
          ? !["Accepted", "Arrived"].includes(trip?.status || "")
            ? trip?.geometry
            : null
          : corridor
      }
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
            accessibilityLabel={`${r.routeName}, ${date(r.startedAt)}, ${money(r.cashFares)}, ${r.status}`}
            onPress={() =>
              go(r.status === "Completed" ? "Run complete" : "Route", r.id)
            }
            style={({ pressed }) => [ps.card, pressed && ps.pressed]}
          >
            <View style={ps.row}>
              <View style={{ flex: 1 }}>
                <Text style={ps.label} numberOfLines={2}>{r.routeName}</Text>
                <Text style={ps.small}>
                  {date(r.startedAt)} · {time(r.startedAt)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", flexShrink: 0, maxWidth: "38%" }}>
                <Text style={ps.price} numberOfLines={1} adjustsFontSizeToFit>
                  {money(r.cashFares)}
                </Text>
                {r.status !== "Completed" && <Tag text="In progress" />}
              </View>
            </View>
            <Text style={ps.tiny} numberOfLines={2}>
              {r.totalBoarded} boarded · {r.stops.length} stops
            </Text>
          </Pressable>
        ))}
        {!runs.length && (
          <Hint text="Your saved trip records appear here after your first departure." />
        )}
      </>
    ) : (
      <>
        {trips.map((t) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t.pickup} to ${t.destination}, ${date(t.createdAt)}, ${money(t.fare)}, ${t.status}`}
            key={t.id}
            onPress={() => go("Trip", t.id)}
            style={({ pressed }) => [ps.card, pressed && ps.pressed]}
          >
            <View style={ps.row}>
              <View style={{ flex: 1 }}>
                <Text style={ps.label}>
                  {t.pickup} → {t.destination}
                </Text>
                <Text style={ps.small}>
                  {date(t.createdAt)} · {time(t.createdAt)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={ps.price}>
                  {money(t.fare)}
                </Text>
                {t.status !== "Completed" && <Tag text={t.status} />}
              </View>
            </View>
            <Text style={ps.tiny}>
              {t.distance} km · {t.minutes} min
            </Text>
          </Pressable>
        ))}
        {!trips.length && (
          <Hint text="Your accepted and completed trips appear here." />
        )}
      </>
    );
  let title = "Dashboard",
    subtitle = "",
    content: React.ReactNode,
    footer: React.ReactNode = null,
    back: string | null = null;
  if (page === "Dashboard") {
    title = "Today";
    subtitle = `${greeting(data.serverTime)}, ${data.user.name.split(" ")[0]}`;
    content = (
      <>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Driver availability"
          accessibilityState={{ checked: online, disabled: locked || !data.user.verified || !sharing }}
          disabled={locked || !data.user.verified || !sharing}
          onPress={() => {
            haptic.warning();
            void action("/availability", { available: !online });
          }}
          style={({ pressed }) => [
            {
              borderRadius: 12,
              padding: 18,
              gap: 6,
              backgroundColor: online ? c.brand : "#34413B",
              minHeight: 132,
              justifyContent: "space-between",
            },
            pressed && ps.pressed,
          ]}
        >
          <View style={ps.between}>
            <Text style={[ps.bannerTitle, { fontSize: 30, lineHeight: 34, color: "#FFFFFF", flex: 1 }]}>
              {!data.user.verified
                ? "Awaiting approval"
                : online
                  ? "You’re online"
                  : data.user.available
                    ? "Reconnecting GPS…"
                    : "You’re offline"}
            </Text>
            <Switch
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              value={online}
              disabled={locked || !data.user.verified || !sharing}
              onValueChange={(available) => {
                haptic.warning();
                void action("/availability", { available });
              }}
              trackColor={{ false: "#5E6B64", true: c.leaf }}
              thumbColor="#FFFFFF"
              {...({ activeThumbColor: "#FFFFFF", activeTrackColor: c.leaf } as object)}
            />
          </View>
          <View style={ps.between}>
            <Text style={[ps.small, { color: "#D5EADF", flex: 1 }]}>
              {online ? "Riders nearby can book you. Tap to go offline." : "Tap to go online and take rides."}
            </Text>
            <BodyNumber value={data.user.plate} size="sm" />
          </View>
        </Pressable>
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
                  ? "Back to your trip"
                  : requests.length === 1
                    ? "See 1 ride request"
                    : requests.length
                      ? `See ${requests.length} ride requests`
                      : "No ride requests yet"
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
            <Text style={[ps.bannerTitle, { fontSize: 44, lineHeight: 48 }]}>
              {activeRun ? "On the road" : nextDeparture(assigned, data.serverTime)}
            </Text>
            <Text style={ps.bannerSub}>
              {activeRun ? "" : `${waitLabel(assigned, data.serverTime)} · `}
              {data.terminals.find((t) => t.routeId === assigned.id)?.name ||
                assigned.stops[0]?.name}
            </Text>
          </View>
        )}
        <Text style={[ps.small, { color: c.ink }]}>
          {today.length} {today.length === 1 ? "trip" : "trips"} today · {money(todayCash)} cash
          {puj ? ` · ${activeRun?.onboard || 0} of ${data.user.capacity} on board` : ""}
        </Text>
      </>
    );
    footer = puj ? (
      <Button
        title={activeRun ? "Continue trip" : "Go to terminal"}
        icon="bus-outline"
        disabled={!assigned && !activeRun}
        onPress={() => go(activeRun ? "Route" : "Terminal", activeRun?.id)}
      />
    ) : null;
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
              <Text style={[ps.fare, { flexShrink: 1, fontSize: 22, lineHeight: 28 }]} numberOfLines={1} adjustsFontSizeToFit>
                {nextDeparture(assigned, data.serverTime)}
              </Text>
              <Text style={ps.body}>
                {data.terminals.find((t) => t.routeId === assigned.id)?.name ||
                  assigned.stops[0]?.name}{" "}
                ·{" "}
                {assigned.approved ? "Configured schedule" : "Pending approval schedule"}
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
                    <Tag text={nextDeparture(r, data.serverTime)} />
                  </View>
                  <Text style={ps.small}>
                    {r.scheduled === false
                      ? "Use live driver location for updates"
                      : `${r.startsAt}–${r.endsAt} · Every ${r.interval} minutes`}
                  </Text>
                </View>
              ))}
          </>
        )}
      </>
    );
    footer = (
      <Button
        title={
          working
            ? "Starting trip…"
            : activeRun
              ? "Resume active trip"
              : "Depart terminal"
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
        ? "Passengers"
        : activeRun
          ? activeRun.routeName
          : "Your route";
    back = page === "Pickup" ? "Route" : "Dashboard";
    if (!activeRun) {
      content = (
        <>
          {routeCard()}
          {map()}
          {stops.length > 0 && (
            <View style={ps.card}>
              {stops.map((point, i) => (
                <View style={ps.stopRow} key={`${point.name}-${i}`}>
                  <View style={ps.stopLine} />
                  <View
                    style={[
                      ps.dot,
                      i === stops.length - 1 && { backgroundColor: c.amber, borderRadius: 2 },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={ps.label}>{point.name}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          {waiting.length > 0 && (
            <View style={ps.card}>
              <View style={ps.between}>
                <Text style={ps.section}>Waiting for pickup</Text>
                <Tag text={`${waiting.length} ${waiting.length === 1 ? "request" : "requests"}`} amber />
              </View>
              {waiting.map((request) => (
                <View key={request.id} style={ps.row}>
                  <Icon name="person-outline" size={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={ps.label}>{request.point.name}</Text>
                    <Text style={ps.tiny}>
                      {request.passenger} · {time(request.createdAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
          <Button
            title="All routes"
            light
            onPress={() => go("Routes")}
          />
        </>
      );
      footer = (
        <Button
          title="Go to terminal"
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
          <View style={{ gap: 10 }}>
            <View style={[ps.between, { alignItems: "flex-end" }]}>
              <Text style={[ps.bannerTitle, { fontVariant: ["tabular-nums"] }]}>
                {activeRun.onboard}
                <Text style={[ps.bannerSub, { fontSize: 18 }]}> / {activeRun.capacity} aboard</Text>
              </Text>
              <Text style={[ps.label, { color: c.ink }]}>
                {activeRun.capacity - activeRun.onboard} free
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 3 }} accessibilityElementsHidden>
              {Array.from({ length: activeRun.capacity }, (_, i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: i < activeRun.onboard ? c.ink : c.line,
                  }}
                />
              ))}
            </View>
          </View>
          {(!sharing || !fresh || !connected) && (
            <>
              <Hint
                warning
                text={`GPS signal lost${data.user.location ? ` at ${time(data.user.location.updatedAt)}` : ""}. Passengers see your last position.`}
              />
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
            </>
          )}

          {/* ROUTE PAGE — drive to next stop, then confirm arrival */}
          {page === "Route" && next && (
            <>
              <View style={ps.banner}>
                <Text style={ps.bannerSub}>Next stop</Text>
                <Text style={ps.bannerTitle}>{next.name}</Text>
              </View>
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
                      <Text
                        style={[
                          ps.label,
                          i < activeRun.stopIndex && { color: c.muted, fontWeight: "500" },
                        ]}
                      >
                        {point.name}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* PICKUP PAGE — explicitly indicate arrival & pickup basis */}
          {page === "Pickup" && next && (
            <>
              <View style={ps.banner}>
                <Text style={ps.bannerSub}>At the stop</Text>
                <Text style={ps.bannerTitle}>{next.name}</Text>
              </View>
              <View style={ps.row}>
                <Count
                  label="Boarding"
                  value={boarded}
                  onChange={setBoarded}
                />
                <Count
                  label="Getting off"
                  value={alighted}
                  onChange={setAlighted}
                />
              </View>
              <View style={[ps.card, ps.row, { paddingVertical: 14, gap: 0 }]}>
                <Stat
                  value={`${activeRun.onboard} / ${activeRun.capacity}`}
                  label="on board now"
                />
                <Stat
                  value={activeRun.onboard - Number(alighted) + Number(boarded)}
                  label="after this stop"
                />
              </View>
              <Text style={ps.small}>
                {money(activeRun.fare)} per passenger
                {activeRun.sampleFare ? " · sample fare" : ""}
              </Text>
              {data.stopRequests.length > 0 && (
                <>
                  <Text style={ps.section}>Waiting at this stop</Text>
                  {data.stopRequests.map((request) => (
                    <View style={ps.card} key={request.id}>
                      <Text style={ps.label}>{request.passenger}</Text>
                      <Text style={ps.body}>{request.point.name}</Text>
                      <Button
                        title="Picked up"
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
                                  void action(
                                    `/stops/${request.id}`,
                                    {},
                                    "DELETE",
                                  );
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
          )}
        </>
      );
      footer = next ? (
        page === "Pickup" ? (
          <Button
            title="Save and drive on"
            icon="checkmark-outline"
            disabled={locked}
            onPress={() => {
              void confirmStop();
            }}
          />
        ) : (
          <Button
            title="I’m at this stop"
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
          title="Complete trip"
          icon="checkmark-circle-outline"
          disabled={locked}
          onPress={finish}
        />
      );
    }
  } else if (page === "Run complete") {
    title = "Trip complete";
    back = "Records";
    content = run ? (
      <>
        <View style={ps.banner}>
          <Text style={ps.total}>{money(run.cashFares)}</Text>
          <Text style={ps.bannerSub}>
            {run.totalBoarded} passengers × {money(run.fare)}
            {run.sampleFare ? " (sample fare)" : ""}
          </Text>
        </View>
        <View style={ps.card}>
          <View style={ps.row}>
            <View style={ps.routeCode}>
              <Text style={ps.routeCodeText}>{run.routeId}</Text>
            </View>
            <Text style={[ps.label, { flex: 1 }]} numberOfLines={2}>
              {run.routeName}
            </Text>
          </View>
          <Text style={ps.small}>
            {date(run.startedAt)} · {time(run.startedAt)}
            {run.endedAt ? `–${time(run.endedAt)}` : ""} · {run.plate}
          </Text>
        </View>
        <Text style={ps.section}>Trip log</Text>
        <View style={ps.card}>
          {(run.events || []).map((event, i) => (
            <View style={ps.between} key={i}>
              <Text style={ps.small}>{time(event.at)}</Text>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={ps.label} numberOfLines={2}>{event.stop}</Text>
                <Text style={ps.tiny}>
                  {event.type} · {event.boarded} boarded · {event.alighted}{" "}
                  alighted
                </Text>
              </View>
            </View>
          ))}
        </View>
      </>
    ) : (
      <Hint text="No trip record is available yet." />
    );
    footer = (
      <Button
        title="Done"
        onPress={() => go("Dashboard")}
      />
    );
  } else if (page === "Requests") {
    title = "Riders nearby";
    subtitle = "Nearest driver gets asked first";
    back = "Dashboard";
    content = (
      <>
        {requests.map((t) => (
          <View style={[ps.card, { gap: 14 }]} key={t.id}>
            <View style={{ gap: 2 }}>
              <Text style={ps.locationCaption}>Pick up</Text>
              <Text style={ps.heading}>{t.pickup}</Text>
              <Text style={ps.small}>
                {data.user.location
                  ? `${distanceKm(data.user.location, t.pickupPoint).toFixed(1)} km from you · `
                  : ""}
                {t.passenger}
                {t.pickupNote ? ` · “${t.pickupNote}”` : ""}
              </Text>
            </View>
            <View style={[ps.between, { alignItems: "flex-end" }]}>
              <View style={{ flex: 1 }}>
                <Text style={ps.locationCaption}>Drop off · {t.distance} km</Text>
                <Text style={ps.label}>{t.destination}</Text>
              </View>
              <Text style={ps.total}>{money(t.fare)}</Text>
            </View>
            {t.expires ? (
              <Text style={[ps.small, { fontWeight: "700" }, t.expires - now < 120_000 && { color: c.amber }]}>
                {t.expires - now < 60_000
                  ? "Offer closes in under a minute"
                  : `Offer closes in ${Math.ceil((t.expires - now) / 60_000)} min`}
              </Text>
            ) : null}
            <View style={[ps.row, { gap: 10 }]}>
              <Pressable
                accessibilityRole="button"
                disabled={locked}
                onPress={() => {
                  haptic.tap();
                  void action(`/trips/${t.id}/decline`, {});
                }}
                style={({ pressed }) => [ps.secondaryButton, { flex: 1, minHeight: 58, backgroundColor: "#FFFFFF" }, pressed && ps.pressed]}
              >
                <Text style={ps.secondaryText}>Pass</Text>
              </Pressable>
              <View style={{ flex: 2 }}>
                <Button
                  title="Accept"
                  disabled={locked || !data.user.available || !sharing || !!activeTrip}
                  onPress={() => {
                    void perform(async () => {
                      if (await action(`/trips/${t.id}`, { status: "Accepted" })) {
                        haptic.success();
                        go("Trip", t.id);
                      }
                    });
                  }}
                />
              </View>
            </View>
          </View>
        ))}
        {requests.length > 0 && (!data.user.available || !sharing) && (
          <Hint text="Go online and share your location to accept these rides." />
        )}
        {requests.length > 0 && !!activeTrip && (
          <Hint text="Finish your current ride before accepting another." />
        )}
        {!requests.length && (
          <Hint info text="No riders near you right now." />
        )}
      </>
    );
  } else if (page === "Trip") {
    title =
      trip?.status === "In progress"
        ? `Drop off at ${trip.destination}`
        : trip?.status === "Arrived"
          ? `Waiting for ${trip.passenger?.split(" ")[0] || "your rider"}`
          : trip?.status === "Accepted"
            ? `Pick up at ${trip.pickup}`
            : "Trip";
    subtitle =
      trip && trip.status === "Accepted"
        ? [
            data.user.location ? `${distanceKm(data.user.location, trip.pickupPoint).toFixed(1)} km away` : "",
            trip.pickupNote ? `“${trip.pickupNote}”` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : "";
    back = "Records";
    content = trip ? (
      <>
        {map(280, true)}
        {["Accepted", "Arrived"].includes(trip.status) && (
          <Button
            title="Directions to passenger"
            icon="navigate-outline"
            disabled={locked || !data.user.location}
            onPress={() => {
              void perform(async () => {
                const from = data.user.location!;
                await Linking.openURL(
                  `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from.latitude}%2C${from.longitude}%3B${trip.pickupPoint.latitude}%2C${trip.pickupPoint.longitude}`,
                );
              });
            }}
          />
        )}
        <View style={ps.card}>
          <View style={ps.between}>
            <Text style={ps.section}>{trip.passenger}</Text>
            <Text style={ps.fare} numberOfLines={1} adjustsFontSizeToFit>{money(trip.fare)}</Text>
          </View>
          <Locations pickup={trip.pickup} destination={trip.destination} />
          {Boolean(trip.pickupNote) && (
            <Text style={ps.small}>“{trip.pickupNote}”</Text>
          )}
          <Text style={ps.small}>
            {trip.distance} km · {trip.minutes} min · cash
            {trip.demoPayment ? ` · ${trip.demoPayment.method} test only` : ""}
          </Text>
        </View>
        <Button
          title="Report a problem"
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
        Accepted: "I’m at the pickup",
        Arrived: "Start ride",
        "In progress": trip.demoPayment
          ? "Complete trip"
          : `Got ${money(trip.fare)} cash · finish`,
      };
      footer = (
        <Button
          title={labels[trip.status as keyof typeof next]}
          icon="checkmark-outline"
          disabled={locked}
          onPress={() => {
            const status = next[trip.status as keyof typeof next];
            void action(`/trips/${trip.id}`, { status }).then((saved) => {
              if (saved) {
                if (status === "Completed") {
                  haptic.success();
                } else {
                  haptic.tap();
                }
              }
            });
          }}
        />
      );
    } else if (trip?.status === "Completed") {
      footer = (
        <Button
          title="Done"
          icon="checkmark-circle-outline"
          onPress={() => go("Records")}
        />
      );
    }
  } else if (page === "Routes") {
    title = "Routes & terminals";
    subtitle = "";
    back = "Route";
    content = (
      <>
        <View style={ps.search}>
          <Icon name="search-outline" />
          <TextInput
            accessibilityLabel="Find PUJ/PUV routes"
            style={ps.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search route or destination"
            placeholderTextColor={c.muted}
          />
        </View>
        {data.routes
          .filter(
            (r) =>
              r.active &&
              `${r.name} ${r.stops.map((p) => p.name).join(" ")}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          )
          .map((r) => (
            <View
              key={r.id}
              style={[ps.card, r.id === data.user.routeId && ps.selected]}
            >
              <View style={ps.row}>
                <View style={ps.routeCode}>
                  <Text style={ps.routeCodeText}>{r.id}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ps.label}>{r.name}</Text>
                  {r.destination ? (
                    <Text style={ps.tiny}>Destination: {r.destination}</Text>
                  ) : null}
                  <Text style={ps.small}>
                    {r.stops.map((p) => p.name).join(" · ")}
                  </Text>
                </View>
              </View>
              <View style={ps.between}>
                <Tag
                  text={
                    r.scheduled === false
                      ? "Live driver location"
                      : `Departs ${nextDeparture(r, data.serverTime)}`
                  }
                />
                <Tag
                  text={
                    r.id === data.user.routeId
                      ? "Assigned route"
                      : "Not assigned"
                  }
                  amber={r.id !== data.user.routeId}
                />
              </View>
            </View>
          ))}
        <Text style={ps.section}>Nearby terminals</Text>
        {data.terminals
          .filter((t) => t.active)
          .map((t) => (
            <View key={t.id} style={ps.card}>
              <View style={ps.row}>
                <Icon name="business-outline" />
                <View style={{ flex: 1 }}>
                  <Text style={ps.label}>{t.name}</Text>
                  <Text style={ps.small}>{t.routeId}</Text>
                </View>
              </View>
            </View>
          ))}
        <Hint info text="Times shift with loading. The transport office assigns routes." />
      </>
    );
  } else if (page === "Records") {
    title = puj ? "Your trip records" : "Your trips";
    subtitle = "";
    content = <>{recordList()}</>;
  } else if (page === "Earnings") {
    title = "Earnings";
    subtitle = `${shortDate(week[0].at)} – ${shortDate(data.serverTime)}`;
    const max = Math.max(1, ...week.map((d) => d.fare));
    const weekTrips = completed.filter((r) => week.some((d) => dayKey(d.at) === dayKey(r.at))).length;
    const dayLabel = (d: Date) => ["Su","M","Tu","W","Th","F","Sa"][d.getDay()];
    content = (
      <>
        <View style={ps.banner}>
          <Text style={[ps.total, { fontSize: 52, lineHeight: 58 }]} numberOfLines={1} adjustsFontSizeToFit>
            {money(weekCash)}
          </Text>
          <Text style={ps.bannerSub}>
            {weekTrips} {weekTrips === 1 ? "trip" : "trips"} this week · {money(todayCash)} today · cash fares, no commission
          </Text>
        </View>
        <View style={{ paddingVertical: 4 }}>
          <View
            style={{
              height: 150,
              flexDirection: "row",
              gap: 10,
              alignItems: "flex-end",
            }}
          >
            {week.map((day, index) => {
              const d = new Date(day.at);
              const label = dayLabel(d);
              const isToday = index === week.length - 1;
              return (
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
                      borderRadius: 3,
                      backgroundColor: isToday ? c.brand : day.fare ? "#AFC6B9" : c.line,
                    }}
                  />
                  <Text style={[ps.tiny, isToday && { color: c.brand, fontWeight: "800" }]}>{label}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <View style={ps.between}>
          <Text style={ps.section}>Recent</Text>
          <Pressable accessibilityRole="button" onPress={() => go("Records")}>
            <Text style={ps.textLink}>See all</Text>
          </Pressable>
        </View>
        {completed.length > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: c.line }}>
            {completed.slice(0, 8).map((record, index) => (
              <View
                key={record.id}
                style={[
                  ps.row,
                  { paddingVertical: 12 },
                  index > 0 && { borderTopWidth: 1, borderTopColor: c.line },
                ]}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={ps.label} numberOfLines={2}>{record.name}</Text>
                  <Text style={ps.tiny}>
                    {date(record.at)} · {time(record.at)}
                  </Text>
                </View>
                <Text style={[ps.price, { flexShrink: 0 }]}>{money(record.fare)}</Text>
              </View>
            ))}
          </View>
        )}
        {!completed.length && (
          <Hint info text="Finish a trip and its fare shows up here." />
        )}
      </>
    );
    footer = (
      <Button
        title="Share records"
        icon="download-outline"
        light
        disabled={locked}
        onPress={() => {
          void shareRecords();
        }}
      />
    );
  } else if (page === "Profile" || page === "Documents") {
    title = page === "Documents" ? "Records" : "Profile";
    back = page === "Documents" ? "Profile" : null;
    content = (
      <>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                data.user.photo ? "Change your profile photo" : "Add a profile photo"
              }
              disabled={locked}
              onPress={() => {
                void perform(async () => {
                  const photo = await pickDriverPhoto();
                  if (photo) {
                    await action("/profile/photo", { photo }, "PATCH");
                  }
                });
              }}
              style={({ pressed }) => [{ width: 64, height: 64 }, pressed && ps.pressed]}
            >
              <Avatar photo={data.user.photo} name={data.user.name} size={64} />
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: -2,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: c.ink,
                  borderWidth: 3,
                  borderColor: c.background,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Icon name="camera" size={14} color="white" />
              </View>
            </Pressable>
            <BodyNumber
              value={data.user.plate}
              toda={puj ? null : data.user.association}
              size="sm"
              align="center"
            />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={2} style={ps.heading}>{data.user.name}</Text>
            <Text numberOfLines={2} style={ps.small}>
              {puj ? "Jeepney driver" : "Tricycle driver"}
              {data.user.verified ? " · approved" : " · awaiting approval"}
            </Text>
          </View>
        </View>
        <View style={[ps.card, { paddingVertical: 2, gap: 0 }]}>
          <Row title="License" detail={data.user.license || "None"} />
          <Row title={puj ? "Franchise" : "TODA"} detail={(puj ? data.user.franchiseName : data.user.association) || "None"} />
          <Row title={puj ? "Plate" : "Body number"} detail={data.user.plate || "—"} />
          <Row title="Seats" detail={`${data.user.capacity}`} last />
        </View>
        {puj && routeCard()}
        <View style={[ps.card, { paddingVertical: 2, gap: 0 }]}>
          <Row title="Account and security" onPress={() => go("Account")} />
          <Row title="Report a change to your vehicle" onPress={() => go("Support")} />
          {Boolean(data.user.photo) && (
            <Row
              title="Remove your photo"
              onPress={() => {
                void perform(async () => {
                  await action("/profile/photo", { photo: null }, "PATCH");
                });
              }}
            />
          )}
          <Row title="Log out" danger last onPress={() => void perform(logout)} />
        </View>
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
        {!!phone.trim() && !isPhMobile(phone) && (
          <Text accessibilityRole="alert" style={[ps.small, { color: "#B3411F" }]}>
            Use a Philippine mobile number, like 0917 123 4567.
          </Text>
        )}
        <Text style={ps.body}>{data.user.email}</Text>
        <Button
          title="Save account details"
          disabled={locked || !name.trim() || (!!phone.trim() && !isPhMobile(phone))}
          onPress={() => {
            void action("/profile", { name: name.trim(), phone: normalizePhMobile(phone) }, "PATCH");
          }}
        />
        <Pressable
          accessibilityRole="button"
          disabled={locked}
          onPress={() =>
            confirmAccountDeletion(() => {
              void perform(async () => {
                if (await action("/account/delete", {})) {
                  await logout();
                }
              });
            })
          }
          style={({ pressed }) => [ps.secondaryButton, pressed && ps.pressed]}
        >
          <Text style={[ps.secondaryText, { color: c.red }]}>Delete account</Text>
        </Pressable>
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
    title = "Updates";
    back = "Dashboard";
    content = (
      <>
        {unread > 0 && (
          <Pressable
            accessibilityRole="button"
            disabled={locked}
            onPress={() => {
              void action("/notifications/read", {});
            }}
            style={{ alignSelf: "flex-end", minHeight: 32, justifyContent: "center" }}
          >
            <Text style={ps.textLink}>Mark all read</Text>
          </Pressable>
        )}
        {data.notifications.map((n) => {
          const about = n.tripId ? data.trips.find((t) => t.id === n.tripId) : undefined;
          return (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            disabled={!about}
            onPress={() => about && go("Trip", about.id)}
            style={({ pressed }) => [
              ps.card,
              { flexDirection: "row", gap: 12, alignItems: "flex-start" },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityLabel={`${n.read ? "" : "Unread. "}${n.message}${about ? ". Opens the trip" : ""}`}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 7,
                backgroundColor: n.read ? "transparent" : c.amber,
              }}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[ps.label, n.read && { fontWeight: "500" }]}>{n.message}</Text>
              <Text style={ps.small}>
                {date(n.createdAt)} · {time(n.createdAt)}
                {about ? ` · ${about.pickup} → ${about.destination}` : ""}
              </Text>
            </View>
            {about ? <Icon name="chevron-forward" size={17} color={c.muted} /> : null}
          </Pressable>
          );
        })}
        {!data.notifications.length && <Hint info text="Nothing new." />}
      </>
    );
  } else {
    title = "Driver support";
    back = "Profile";
    content = (
      <>

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
                  details: report.trim(),
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
            <Tag text={statusLabel(r.status)} />
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
        { label: "Dashboard", text: "Home", icon: "home" },
        { label: "Records", text: "Runs", icon: "records" },
        { label: "Earnings", text: "Earnings", icon: "cash" },
        { label: "Profile", text: "Account", icon: "account" },
      ]
    : [
        { label: "Dashboard", text: "Home", icon: "home" },
        { label: "Records", text: "Trips", icon: "ticket" },
        { label: "Earnings", text: "Earnings", icon: "cash" },
        { label: "Profile", text: "Account", icon: "account" },
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
            <Icon name="arrow-back" size={22} color={c.ink} />
          </Pressable>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text accessibilityRole="header" style={ps.heading} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={ps.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {!back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              page === "Earnings"
                ? "Share cash records"
                : unread
                  ? `Notifications, ${unread} unread`
                  : "Notifications"
            }
            style={ps.iconButton}
            onPress={() =>
              page === "Earnings" ? void shareRecords() : go("Notifications")
            }
          >
            {page === "Earnings" ? (
              <Icon name="share-outline" size={21} color={c.ink} />
            ) : (
              <Glyph name="bell" size={22} />
            )}
            {page !== "Earnings" && unread > 0 && <View style={ps.unreadDot} />}
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
        </View>
      )}
      {!back && (
        <View style={[ps.nav, { marginBottom: navLift }]}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.label}
              accessibilityRole="tab"
              accessibilityLabel={tab.text}
              accessibilityState={{ selected: page === tab.label }}
              onPress={() => go(tab.label)}
              style={({ pressed }) => [
                ps.navItem,
                page === tab.label && ps.navSelected,
                pressed && ps.pressed,
              ]}
            >
              <Glyph name={tab.icon as GlyphName} size={24} color={page === tab.label ? c.brand : c.muted} />
              <Text style={[ps.navLabel, page === tab.label && { color: c.brand }]}>
                {tab.text}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}