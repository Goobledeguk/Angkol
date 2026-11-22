import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Point, Route, Snapshot, Trip } from "../types/types";
import CalbayogMap from "../map/CalbayogMap";
import { Icon, money } from "../common/ui";
import { Glyph } from "../common/Glyph";
import { ps, passengerColors as c } from "./passengerStyles";
import { isFinished } from "../domain/roles";

type IconName = React.ComponentProps<typeof Icon>["name"];
function Tile({ icon, dark = false }: { icon: IconName; dark?: boolean }) {
  return (
    <View style={v.tile}>
      <Icon name={icon} size={22} color={dark ? "white" : c.ink} />
    </View>
  );
}
function Pill({ label, quiet = false }: { label: string; quiet?: boolean }) {
  return (
    <View style={v.pill}>
      <Text
        style={[
          v.caption,
          { color: quiet ? c.muted : c.ink, fontWeight: "700" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}
function Section({
  title,
  detail,
  action,
  onPress,
}: {
  title: string;
  detail?: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={ps.between}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={v.section}>{title}</Text>
        {!!detail && <Text style={v.small}>{detail}</Text>}
      </View>
      {!!action && (
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8}>
          <Text style={v.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        v.button,
        secondary && v.secondary,
        disabled && { opacity: 0.4 },
        pressed && ps.pressed,
      ]}
    >
      <Text style={[v.buttonLabel, secondary && { color: c.ink }]}>
        {title}
      </Text>
      <Icon
        name="arrow-forward"
        size={19}
        color={secondary ? c.ink : c.onBrand}
      />
    </Pressable>
  );
}
function Empty({
  title,
  detail,
  icon = "trail-sign-outline",
}: {
  title: string;
  detail: string;
  icon?: IconName;
}) {
  return (
    <View style={[v.card, { alignItems: "center", paddingVertical: 30 }]}>
      <Tile icon={icon} />
      <Text style={v.section}>{title}</Text>
      <Text style={[v.small, { textAlign: "center" }]}>{detail}</Text>
    </View>
  );
}
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const isPast = (trip: Trip) => isFinished(trip);

export function PassengerHomeScreen({
  data,
  active,
  onBook,
  onRoutes,
  onTerminals,
  onDestination,
  onTrack,
  onRideAgain,
}: {
  data: Snapshot;
  active?: Trip;
  onBook: () => void;
  onRoutes: () => void;
  onTerminals: () => void;
  onDestination: (point: Point) => void;
  onTrack: () => void;
  onRideAgain?: (trip: Trip) => void;
}) {
  const lastRide = active
    ? undefined
    : data.trips.find(
        (trip) => trip.status === "Completed" && trip.serviceType !== "PUJ/PUV",
      );
  const puv = active?.serviceType === "PUJ/PUV";
  const activeTitle = !active
    ? ""
    : active.status === "Requested"
      ? "Finding your driver"
      : active.status === "In progress"
        ? "Enjoy your journey"
        : active.status === "Arrived"
          ? puv
            ? "Your seat is reserved"
            : "Your driver is at the pickup"
          : "Your ride is on the way";
  const places = [
    ...new Map(
      data.trips.map((trip) => [trip.destinationPoint.name, trip.destinationPoint]),
    ).values(),
  ].slice(0, 3);
  const onRoad = data.vehicles.filter((x) => x.status !== "Broken / Inactive").length;
  const jeepneyRoutes = data.routes.filter((r) => r.active && r.transportType !== "Tricycle").length;
  const recent = places.length ? places : data.landmarks.slice(0, 2);
  return (
    <View style={v.stack}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Where to? Book a tricycle"
        onPress={onBook}
        style={({ pressed }) => [v.destination, pressed && ps.pressed]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[v.heroTitle, { color: c.onBrand }]} numberOfLines={1}>
            Where to?
          </Text>
          <Text style={[v.small, { color: "#D5EADF" }]}>Tricycle, regular or special</Text>
        </View>
        <Icon name="arrow-forward" size={28} color={c.onBrand} />
      </Pressable>
      {active && (
        <Pressable
          accessibilityRole="button"
          onPress={onTrack}
          style={({ pressed }) => [v.activeRide, pressed && ps.pressed]}
        >
          <Glyph name={puv ? "jeepney" : "tricycle"} size={26} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={v.label}>{activeTitle}</Text>
            <Text numberOfLines={1} style={v.small}>
              {active.status === "Requested"
                ? `${active.pickup} to ${active.destination}`
                : `${active.driver || "Your driver"}${active.plate ? `, ${active.plate}` : ""}`}
            </Text>
          </View>
          <Icon name="chevron-forward" size={19} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onRoutes}
        style={({ pressed }) => [v.listRow, v.ruled, pressed && ps.pressed]}
      >
        <Glyph name="jeepney" size={26} />
        <View style={{ flex: 1 }}>
          <Text style={v.label}>Jeepney routes</Text>
          <Text style={v.small}>
            {jeepneyRoutes} {jeepneyRoutes === 1 ? "route" : "routes"}, stops and next departures
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color={c.muted} />
      </Pressable>
      <View style={{ gap: 10 }}>
        <Section
          title="Around you"
          detail={`${onRoad} ${onRoad === 1 ? "unit" : "units"} on the road`}
          action="Terminals"
          onPress={onTerminals}
        />
        <CalbayogMap
          height={200}
          vehicles={data.vehicles}
          terminals={data.terminals}
          landmarks={data.landmarks}
        />
      </View>
      <View>
        <Section title="Recent" />
        {lastRide && onRideAgain && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ride again from ${lastRide.pickup} to ${lastRide.destination}`}
            onPress={() => onRideAgain(lastRide)}
            style={({ pressed }) => [v.listRow, pressed && ps.pressed]}
          >
            <Icon name="repeat" size={20} color={c.muted} />
            <View style={{ flex: 1 }}>
              <Text style={v.label} numberOfLines={2}>
                {lastRide.pickup} to {lastRide.destination}
              </Text>
              <Text style={v.small}>Book the same ride again</Text>
            </View>
          </Pressable>
        )}
        {recent.map((point) => (
          <Pressable
            key={point.name}
            accessibilityRole="button"
            onPress={() => onDestination(point)}
            style={({ pressed }) => [v.listRow, v.rowDivider, pressed && ps.pressed]}
          >
            <Icon name="time-outline" size={20} color={c.muted} />
            <Text style={[v.label, { flex: 1 }]} numberOfLines={2}>
              {point.name}
            </Text>
            <Icon name="chevron-forward" size={18} color={c.muted} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function PassengerRoutesScreen({
  data,
  selectedId,
  onSelect,
  onPickup,
  onCancel,
  onTerminals,
  busy,
}: {
  data: Snapshot;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onPickup: (route: Route) => void;
  onCancel: (id: string) => void;
  onTerminals: () => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All routes");
  const routes = data.routes.filter(
    (route) =>
      route.active &&
      (filter !== "PUJ / PUV" ||
        (route.transportType || "PUJ / PUV") === filter) &&
      `${route.name} ${route.stops.map((stop) => stop.name).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const selected = routes.find((route) => route.id === selectedId) || routes[0];
  return (
    <View style={v.stack}>
      <View style={v.search}>
        <Icon name="search-outline" size={22} />
        <TextInput
          style={[v.body, { flex: 1, paddingVertical: 15 }]}
          accessibilityLabel="Search local routes"
          placeholder="Where does your route go?"
          placeholderTextColor={c.muted}
          value={query}
          onChangeText={setQuery}
        />
        {!!query && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => setQuery("")}
            hitSlop={8}
          >
            <Icon name="close" size={19} />
          </Pressable>
        )}
      </View>
      <View style={ps.row}>
        {["All routes", "PUJ / PUV", "Terminals"].map((label) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === label }}
            onPress={() =>
              label === "Terminals" ? onTerminals() : setFilter(label)
            }
            style={({ pressed }) => [
              v.filter,
              filter === label && { backgroundColor: c.ink, borderColor: c.ink },
              pressed && ps.pressed,
            ]}
          >
            <Text
              style={[
                v.small,
                {
                  fontWeight: "700",
                  color: filter === label ? "white" : c.muted,
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: c.line }}>
        <CalbayogMap
          height={210}
          pickup={selected?.stops[0]}
          destination={selected?.stops.at(-1)}
          vehicles={data.vehicles}
          terminals={data.terminals}
        />
      </View>
      {routes.map((route) => {
        const opened = route.id === selected?.id;
        return (
          <View
            key={route.id}
            style={[v.card, v.routeCard, opened && v.routeCardOpen]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: opened }}
              onPress={() => onSelect(route.id)}
              style={({ pressed }) => [ps.row, pressed && ps.pressed]}
            >
              <View style={v.routeCode}>
                <Text numberOfLines={1} style={v.routeCodeText}>
                  {route.id}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={v.label}>{route.name}</Text>
                <Text style={v.small}>
                  Every {route.interval} min · {route.startsAt}–{route.endsAt}
                </Text>
              </View>
              <Text style={v.price}>{money(route.fare)}</Text>
            </Pressable>
            {opened && (
              <>
                <View style={v.timeline}>
                  {route.stops.map((stop, index) => (
                    <View key={`${index}-${stop.name}`} style={v.stop}>
                      <View style={v.stopRail}>
                        <View
                          style={[
                            v.stopDot,
                            index === route.stops.length - 1 && {
                              borderRadius: 2,
                            },
                          ]}
                        />
                        {index < route.stops.length - 1 && (
                          <View style={v.stopLine} />
                        )}
                      </View>
                      <View
                        style={{
                          flex: 1,
                          paddingBottom:
                            index < route.stops.length - 1 ? 18 : 0,
                          gap: 3,
                        }}
                      >
                        <Text
                          style={[
                            v.label,
                            index > 0 &&
                              index < route.stops.length - 1 && {
                                fontWeight: "500",
                              },
                          ]}
                        >
                          {stop.name}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Button
                  title="Hold a seat"
                  onPress={() => onPickup(route)}
                  disabled={busy || (!route.approved && !data.sampleMode)}
                />
                {!route.approved && (
                  <Text style={v.caption}>Route pending approval</Text>
                )}
              </>
            )}
          </View>
        );
      })}
      {!routes.length && (
        <Empty
          title="No routes found"
          detail="Try a street or a stop name."
        />
      )}
      {data.stopRequests.map((request) => (
        <View key={request.id} style={v.card}>
          <Pill label="Pickup requested" />
          <Text style={v.label}>{request.point.name}</Text>
          <Text style={v.small}>Waiting for a driver on {request.routeId}</Text>
          <Button
            title="Cancel pickup request"
            secondary
            onPress={() => onCancel(request.id)}
            disabled={busy}
          />
        </View>
      ))}
    </View>
  );
}

export function PassengerTripsScreen({
  trips,
  onOpen,
  onBook,
}: {
  trips: Trip[];
  onOpen: (trip: Trip) => void;
  onBook: () => void;
}) {
  const [tab, setTab] = useState("Past");
  const [mode, setMode] = useState("All rides");
  const active = trips.filter((trip) => !isPast(trip));
  const isPuj = (trip: Trip) => trip.serviceType === "PUJ/PUV";
  const visible = trips
    .filter((trip) => (tab === "Active" ? !isPast(trip) : isPast(trip)))
    .filter((trip) =>
      mode === "All rides" ? true : mode === "PUJ / PUV" ? isPuj(trip) : !isPuj(trip),
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const modes = ["All rides", "Tricycle", "PUJ / PUV"];
  return (
    <View style={v.stack}>
      <View style={v.segments}>
        {["Active", "Past"].map((label) => (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === label }}
            onPress={() => setTab(label)}
            style={({ pressed }) => [
              v.segment,
              tab === label && {
                backgroundColor: "#FFFFFF",
                borderWidth: 2,
                borderColor: c.ink,
              },
              pressed && ps.pressed,
            ]}
          >
            <Text
              style={[v.label, { color: tab === label ? c.ink : c.muted }]}
            >
              {label}
              {label === "Active" ? ` (${active.length})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>
      <Section
        title={tab === "Past" ? "Past rides" : "Now"}
        action={mode}
        onPress={() => setMode(modes[(modes.indexOf(mode) + 1) % modes.length])}
      />
      {visible.length > 0 && (
        <View style={[v.card, { paddingVertical: 0, gap: 0 }]}>
          {visible.map((trip, index) => {
            const voided = trip.status === "Cancelled" || trip.status === "Expired";
            return (
              <Pressable
                key={trip.id}
                accessibilityRole="button"
                onPress={() => onOpen(trip)}
                style={({ pressed }) => [
                  v.ledgerRow,
                  index > 0 && v.rowDivider,
                  pressed && ps.pressed,
                ]}
              >
                <Glyph
                  name={isPuj(trip) ? "jeepney" : "tricycle"}
                  size={24}
                  color={voided ? c.muted : c.ink}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={v.ledgerPlace} numberOfLines={1}>
                    {trip.destination}
                  </Text>
                  <Text style={v.small} numberOfLines={1}>
                    {date(trip.createdAt)} · from {trip.pickup}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Text
                    style={[
                      v.price,
                      { fontSize: 15, lineHeight: 20 },
                      voided && { color: c.muted, textDecorationLine: "line-through" },
                    ]}
                  >
                    {money(trip.fare)}
                  </Text>
                  {trip.status !== "Completed" && (
                    <Text style={[v.caption, !voided && { color: c.ink, fontWeight: "700" }]}>
                      {trip.status === "Expired" ? "No driver" : trip.status}
                    </Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {!visible.length && (
        <>
          <Empty
            title={
              tab === "Active"
                ? "No ride right now"
                : "Nothing here yet"
            }
            detail={
              mode === "PUJ / PUV"
                ? "Jeepney seats you book show up here."
                : "Rides you take show up here, with receipts."
            }
            icon="time-outline"
          />
          <Button title="Book a ride" onPress={onBook} />
        </>
      )}
    </View>
  );
}

export function PassengerProfileScreen({
  data,
  onEdit,
  onTrips,
  onNotifications,
  onSupport,
  onSignOut,
  onDeleteAccount,
  busy,
}: {
  data: Snapshot;
  onEdit: () => void;
  onTrips: () => void;
  onNotifications: () => void;
  onSupport: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => void;
  busy: boolean;
}) {
  const [alerts, setAlerts] = useState(true);
  return (
    <View style={v.stack}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit your personal details"
        onPress={onEdit}
        style={({ pressed }) => [ps.between, { minHeight: 56 }, pressed && ps.pressed]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={v.profileName}>{data.user.name}</Text>
          <Text style={v.small}>{data.user.phone || data.user.email}</Text>
        </View>
        <Text style={v.link}>Edit</Text>
      </Pressable>
      <View style={v.profileStats}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={v.statValue}>
            {data.trips.filter((trip) => trip.status === "Completed").length}
          </Text>
          <Text style={v.small}>rides</Text>
        </View>
        <View style={{ width: 1, alignSelf: "stretch", backgroundColor: c.line }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={v.statValue}>
            {money(
              data.trips
                .filter((trip) => trip.status === "Completed")
                .reduce((sum, trip) => sum + trip.fare, 0),
            )}
          </Text>
          <Text style={v.small}>paid in fares</Text>
        </View>
      </View>
      <View style={[v.card, { gap: 0, paddingVertical: 0 }]}>
        {[
          {
            icon: "person-outline" as const,
            title: "Personal information",
            sub: "Name and contact details",
            press: onEdit,
          },
          {
            icon: "time-outline" as const,
            title: "Ride history",
            sub: "Trip history and receipts",
            press: onTrips,
          },
          {
            icon: "notifications-outline" as const,
            title: "Notifications",
            sub: "Your local booking updates",
            press: onNotifications,
          },
        ].map((item, index) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            onPress={item.press}
            style={({ pressed }) => [
              v.listRow,
              index > 0 && v.rowDivider,
              pressed && ps.pressed,
            ]}
          >
            <Icon name={item.icon} size={20} color={c.ink} />
            <Text style={[v.label, { flex: 1, fontWeight: "600" }]}>{item.title}</Text>
            <Icon name="chevron-forward" size={17} color={c.muted} />
          </Pressable>
        ))}
      </View>
      <View style={[v.card, { gap: 0, paddingVertical: 0 }]}>
        <View style={v.listRow}>
          <Icon name="chatbubble-ellipses-outline" size={20} color={c.ink} />
          <Text style={[v.label, { flex: 1, fontWeight: "600" }]}>Trip alerts</Text>
          <Switch
            accessibilityLabel="Trip alerts"
            value={alerts}
            onValueChange={setAlerts}
            trackColor={{ false: "#C9CBC5", true: c.ink }}
            thumbColor="white"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onSupport}
          style={({ pressed }) => [
            v.listRow,
            v.rowDivider,
            pressed && ps.pressed,
          ]}
        >
          <Icon name="shield-checkmark-outline" size={20} color={c.ink} />
          <Text style={[v.label, { flex: 1, fontWeight: "600" }]}>Help & safety</Text>
          <Icon name="chevron-forward" size={17} color={c.muted} />
        </Pressable>
      </View>
      <View style={[v.card, { gap: 0, paddingVertical: 0 }]}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onSignOut}
          style={({ pressed }) => [v.listRow, pressed && ps.pressed]}
        >
          <Text style={[v.label, { flex: 1, color: c.red }]}>Sign out</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onDeleteAccount}
          style={({ pressed }) => [v.listRow, v.rowDivider, pressed && ps.pressed]}
        >
          <Text style={[v.small, { flex: 1 }]}>Delete account and ride history</Text>
        </Pressable>
      </View>
    </View>
  );
}

const v = StyleSheet.create({
  stack: { gap: 22 },
  card: {
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 10,
    padding: 16,
    gap: 14,
  },
  section: {
    fontFamily: "Archivo",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: c.ink,
  },
  serviceTitle: {
    fontFamily: "Archivo",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: c.ink,
  },
  ledgerPlace: {
    fontFamily: "Archivo",
    fontWeight: "600",
    fontSize: 16,
    lineHeight: 21,
    color: c.ink,
  },
  label: {
    fontFamily: "Archivo",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: c.ink,
  },
  body: { fontFamily: "Archivo", fontSize: 14, lineHeight: 22, color: c.ink },
  small: {
    fontFamily: "Archivo",
    fontSize: 14,
    lineHeight: 20,
    color: c.muted,
  },
  caption: {
    fontFamily: "Archivo",
    fontSize: 12,
    lineHeight: 16,
    color: c.muted,
  },
  link: {
    fontFamily: "Archivo",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: c.ink,
  },
  tile: {
    width: 28,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pill: {
    alignSelf: "flex-start",
  },
  hero: { gap: 16 },
  heroTitle: {
    flex: 1,
    fontFamily: "Archivo",
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: c.ink,
  },
  destination: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    minHeight: 96,
    paddingHorizontal: 20,
    backgroundColor: c.brand,
    borderRadius: 12,
  },
  searchArrow: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: c.green,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  activeRide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  service: {
    flex: 1,
    gap: 22,
    backgroundColor: c.surface,
    borderRadius: 10,
    padding: 16,
    minHeight: 120,
    justifyContent: "space-between",
  },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    minHeight: 66,
  },
  mapNote: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: "#D6D7D1" },
  ruled: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#D6D7D1" },
  search: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: c.ink,
    borderRadius: 8,
  },
  filter: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
    backgroundColor: c.surface,
    borderRadius: 6,
  },
  routeCard: { padding: 16 },
  routeCardOpen: { borderColor: c.ink, borderWidth: 2, backgroundColor: "#FFFFFF" },
  routeCode: {
    minWidth: 46,
    maxWidth: 72,
    height: 30,
    borderRadius: 4,
    backgroundColor: c.ink,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  routeCodeText: {
    fontFamily: "Archivo",
    fontSize: 12,
    fontWeight: "800",
    color: "white",
  },
  metrics: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 16,
    backgroundColor: "#E3F1E6",
    padding: 16,
  },
  timeline: { paddingHorizontal: 4, paddingTop: 4 },
  stop: { flexDirection: "row", gap: 12 },
  stopRail: { width: 14, alignItems: "center", paddingTop: 5 },
  stopDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#FFFFFF", borderWidth: 3, borderColor: c.ink },
  stopLine: { width: 3, flex: 1, backgroundColor: c.ink, marginTop: -1, marginBottom: -6 },
  button: {
    minHeight: 54,
    backgroundColor: c.brand,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  secondary: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  buttonLabel: {
    fontFamily: "Archivo",
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    color: c.onBrand,
    flexShrink: 1,
  },
  journeyCard: { borderColor: "#DCEAE0", boxShadow: "0px 6px 20px rgba(7, 68, 44, 0.07)" },
  journeyPath: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F0F7F1", borderRadius: 16, padding: 15 },
  journeyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.green },
  segments: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    backgroundColor: c.surface,
    borderRadius: 8,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 9,
  },
  price: {
    fontFamily: "ArchivoBoard",
    fontSize: 20,
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
    color: c.ink,
  },
  identity: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  avatarRing: {
    width: 84,
    height: 84,
  },
  avatar: {
    flex: 1,
    borderRadius: 42,
    backgroundColor: c.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: "ArchivoBoard",
    fontSize: 36,
    lineHeight: 40,
    color: c.brand,
  },
  editBadge: {
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
  },
  profileName: {
    fontFamily: "Archivo",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    color: c.ink,
    textAlign: "center",
  },
  profileStats: {
    flexDirection: "row",
    gap: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: c.surface,
    borderRadius: 10,
    alignItems: "center",
  },
  statValue: {
    fontFamily: "ArchivoBoard",
    fontSize: 34,
    lineHeight: 36,
    color: c.ink,
    fontVariant: ["tabular-nums"],
  },
});
