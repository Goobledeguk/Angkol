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
import { ps, passengerColors as c } from "./passengerStyles";

type IconName = React.ComponentProps<typeof Icon>["name"];
function Tile({ icon, dark = false }: { icon: IconName; dark?: boolean }) {
  return (
    <View style={[v.tile, dark && { backgroundColor: "#FFFFFF18" }]}>
      <Icon name={icon} size={23} color={dark ? "white" : c.green} />
    </View>
  );
}
function Pill({ label, quiet = false }: { label: string; quiet?: boolean }) {
  return (
    <View style={[v.pill, quiet && { backgroundColor: "#F1F3F2" }]}>
      <Text
        style={[
          v.caption,
          { color: quiet ? c.muted : c.green, fontWeight: "700" },
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
      <Text style={[v.buttonLabel, secondary && { color: c.green }]}>
        {title}
      </Text>
      <Icon
        name="arrow-forward"
        size={19}
        color={secondary ? c.green : "white"}
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
const isPast = (trip: Trip) => ["Completed", "Cancelled"].includes(trip.status);

export function PassengerHomeScreen({
  data,
  active,
  onBook,
  onRoutes,
  onTerminals,
  onDestination,
  onTrack,
}: {
  data: Snapshot;
  active?: Trip;
  onBook: () => void;
  onRoutes: () => void;
  onTerminals: () => void;
  onDestination: (point: Point) => void;
  onTrack: () => void;
}) {
  const places = [
    ...new Map(
      data.trips.map((trip) => [trip.destinationPoint.name, trip.destinationPoint]),
    ).values(),
  ].slice(0, 3);
  return (
    <View style={v.stack}>
      <View style={v.hero}>
        <Text style={v.heroTitle}>Where to?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onBook}
          style={({ pressed }) => [v.destination, pressed && ps.pressed]}
        >
          <Icon name="search-outline" size={23} />
          <Text
            style={[v.label, { flex: 1, color: c.muted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Enter your destination
          </Text>
          <View style={v.searchArrow}>
            <Icon name="arrow-forward" size={18} color="white" />
          </View>
        </Pressable>
      </View>
      {active && (
        <Pressable
          accessibilityRole="button"
          onPress={onTrack}
          style={({ pressed }) => [v.activeRide, pressed && ps.pressed]}
        >
          <Tile icon="bicycle-outline" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={v.label}>
              {active.status === "In progress"
                ? "Enjoy your journey"
                : "Your ride is on the way"}
            </Text>
            <Text numberOfLines={1} style={v.small}>
              {active.driver || "Your driver"}
              {active.plate ? `, ${active.plate}` : ""}
            </Text>
          </View>
          <Icon name="chevron-forward" size={19} />
        </Pressable>
      )}
      <Section
        title="Ride options"
      />
      <View style={[ps.row, { alignItems: "stretch", gap: 12 }]}>
        {[
          {
            title: "Tricycle",
            sub: "Door-to-door comfort",
            icon: "bicycle" as const,
            press: onBook,
            dark: true,
          },
          {
            title: "PUJ / PUV",
            sub: "Your local routes",
            icon: "bus" as const,
            press: onRoutes,
            dark: false,
          },
        ].map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            onPress={item.press}
            style={({ pressed }) => [
              v.service,
              item.dark && { backgroundColor: c.dark, borderColor: c.dark },
              pressed && ps.pressed,
            ]}
          >
            <Tile icon={item.icon} dark={item.dark} />
            <View style={{ gap: 5 }}>
              <Text style={[v.section, item.dark && { color: "white" }]}>
                {item.title}
              </Text>
              <Text style={[v.small, item.dark && { color: "#C7DCD0" }]}>
                {item.sub}
              </Text>
            </View>
            <Text style={[v.link, item.dark && { color: "#DDECE3" }]}>
              {item.dark ? "Book a tricycle" : "See routes"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Section
        title="Around you"
        action="View terminals"
        onPress={onTerminals}
      />
      <View style={{ borderRadius: 22, overflow: "hidden" }}>
        <CalbayogMap height={180} vehicles={data.vehicles} />
        <View style={v.mapNote}>
          <View style={ps.dot} />
          <Text style={v.caption}>Calbayog City</Text>
        </View>
      </View>
      <Section
        title="Recent places"
      />
      <View style={[v.card, { gap: 0, paddingVertical: 0 }]}>
        {(places.length ? places : data.landmarks.slice(0, 2)).map(
          (point, index) => (
            <Pressable
              key={point.name}
              accessibilityRole="button"
              onPress={() => onDestination(point)}
              style={({ pressed }) => [
                v.listRow,
                index > 0 && v.rowDivider,
                pressed && ps.pressed,
              ]}
            >
              <Tile icon="time-outline" />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={v.label}>{point.name}</Text>
                <Text style={v.small}>Calbayog City, Samar</Text>
              </View>
              <Icon name="arrow-forward" size={18} color={c.muted} />
            </Pressable>
          ),
        )}
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
              filter === label && { backgroundColor: c.dark },
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
      <View style={{ borderRadius: 22, overflow: "hidden" }}>
        <CalbayogMap
          height={210}
          pickup={selected?.stops[0]}
          destination={selected?.stops.at(-1)}
          vehicles={data.vehicles}
          terminals={data.terminals}
        />
        <View style={v.mapNote}>
          <Icon name="bus-outline" size={16} />
          <Text style={v.caption}>
            {routes.length} local routes
          </Text>
        </View>
      </View>
      <Section
        title="Find your connection"
        detail="Routes, fares, and stops in one place"
      />
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
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={v.label}>{route.name}</Text>
                <Text style={v.small}>
                  {route.stops.length} stops ·{" "}
                  {route.transportType || "PUJ / PUV"}
                </Text>
              </View>
              <Icon
                name={opened ? "chevron-up" : "chevron-down"}
                size={18}
                color={c.muted}
              />
            </Pressable>
            <View style={v.metrics}>
              {[
                { label: "FARE", value: money(route.fare) },
                { label: "INTERVAL", value: `${route.interval} min` },
                {
                  label: "SERVICE",
                  value: `${route.startsAt}–${route.endsAt}`,
                },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, gap: 5 }}>
                  <Text style={v.caption}>{item.label}</Text>
                  <Text style={[v.label, { fontSize: 12 }]}>{item.value}</Text>
                </View>
              ))}
            </View>
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
                        <Text style={v.label}>{stop.name}</Text>
                        <Text style={v.small}>
                          {index === 0
                            ? "Board here"
                            : index === route.stops.length - 1
                              ? "Final stop"
                              : "Along the route"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Button
                  title="Request terminal pickup"
                  onPress={() => onPickup(route)}
                  disabled={busy || (!route.approved && !data.sampleMode)}
                />
                <Text style={v.caption}>
                  {route.approved
                    ? route.reference
                    : "Route pending approval"}
                </Text>
              </>
            )}
          </View>
        );
      })}
      {!routes.length && (
        <Empty
          title="No routes found"
          detail="Try another destination or search for a nearby stop."
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
  const visible =
    mode === "PUJ / PUV"
      ? []
      : trips
          .filter((trip) => (tab === "Active" ? !isPast(trip) : isPast(trip)))
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
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
                backgroundColor: "white",
                boxShadow: "0px 2px 8px rgba(6, 40, 28, .06)",
              },
              pressed && ps.pressed,
            ]}
          >
            <Text
              style={[v.label, { color: tab === label ? c.green : c.muted }]}
            >
              {label}
              {label === "Active" ? ` (${active.length})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>
      <Section
        title={tab === "Past" ? "Recent journeys" : "Your current ride"}
        action={mode === "All rides" ? "All rides ▾" : "PUJ / PUV ▾"}
        onPress={() =>
          setMode(mode === "All rides" ? "PUJ / PUV" : "All rides")
        }
      />
      {visible.map((trip) => (
        <Pressable
          key={trip.id}
          accessibilityRole="button"
          onPress={() => onOpen(trip)}
          style={({ pressed }) => [v.card, v.journeyCard, pressed && ps.pressed]}
        >
          <View style={ps.between}>
            <View style={ps.row}><Icon name="calendar-outline" size={16} color={c.green} /><Text style={v.small}>{date(trip.createdAt)}</Text></View>
            <Pill label={trip.status} quiet={trip.status === "Cancelled"} />
          </View>
          <View style={v.journeyPath}>
            <View style={{ flex: 1, gap: 12 }}>
              <View style={ps.row}><View style={v.journeyDot} /><Text style={[v.label, { flex: 1 }]}>{trip.pickup}</Text></View>
              <View style={ps.row}><View style={[v.journeyDot, { backgroundColor: c.amber }]} /><Text style={[v.label, { flex: 1 }]}>{trip.destination}</Text></View>
            </View>
            <Tile icon="bicycle-outline" />
          </View>
          <Text style={v.small}>
            Tricycle · {trip.driver || "No driver assigned"}
          </Text>
          <View
            style={[
              ps.between,
              { borderTopWidth: 1, borderTopColor: c.line, paddingTop: 14 },
            ]}
          >
            <View style={{ gap: 4 }}>
              <Text style={v.link}>
                {isPast(trip) ? "View receipt" : "Track your ride"}
              </Text>
              <Text style={v.caption}>
                {trip.distance} km · {trip.minutes} min
              </Text>
            </View>
            <Text style={[v.price, { fontSize: 13, lineHeight: 18 }]}>
              {money(trip.status === "Cancelled" ? 0 : trip.fare)}
            </Text>
          </View>
        </Pressable>
      ))}
      {!visible.length && (
        <>
          <Empty
            title={
              tab === "Active"
                ? "Your next journey awaits"
                : "No journeys in this view"
            }
            detail={
              mode === "PUJ / PUV"
                ? "Terminal pickup requests are shown on Routes."
                : "Book a local ride and keep all your journeys in one place."
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
  const initials = data.user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");
  return (
    <View style={v.stack}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit your personal details"
        onPress={onEdit}
        style={({ pressed }) => [v.identity, pressed && ps.pressed]}
      >
        <View style={v.avatarRing}>
          <View style={v.avatar}>
            <Text style={v.initials}>{initials}</Text>
          </View>
          <View style={v.editBadge}>
            <Icon name="pencil" size={13} color="white" />
          </View>
        </View>
        <View style={{ alignItems: "center", gap: 7 }}>
          <Text style={v.profileName}>{data.user.name}</Text>
          <Pill label="Passenger" />
          <Text style={[v.small, { color: "#D0E4D7" }]}>{data.user.email}</Text>
        </View>
      </Pressable>
      <View style={v.profileStats}>
        <View style={{ flex: 1, gap: 5 }}>
          <Icon name="bicycle-outline" size={21} color={c.green} />
          <Text style={v.statValue}>
            {data.trips.filter((trip) => trip.status === "Completed").length}
          </Text>
          <Text style={v.small}>Completed rides</Text>
        </View>
        <View style={{ width: 1, backgroundColor: c.line }} />
        <View style={{ flex: 1, gap: 5 }}>
          <Icon name="wallet-outline" size={21} color={c.green} />
          <Text style={v.statValue}>
            {money(
              data.trips
                .filter((trip) => trip.status === "Completed")
                .reduce((sum, trip) => sum + trip.fare, 0),
            )}
          </Text>
          <Text style={v.small}>Spent on rides</Text>
        </View>
      </View>
      <Section title="Settings" />
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
            title: "Your journeys",
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
            <Tile icon={item.icon} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={v.label}>{item.title}</Text>
              <Text style={v.small}>{item.sub}</Text>
            </View>
            <Icon name="chevron-forward" size={17} color={c.muted} />
          </Pressable>
        ))}
      </View>
      <Section title="Preferences & support" />
      <View style={[v.card, { gap: 0, paddingVertical: 0 }]}>
        <View style={v.listRow}>
          <Tile icon="chatbubble-ellipses-outline" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={v.label}>Trip alerts</Text>
            <Text style={v.small}>Local preview preference</Text>
          </View>
          <Switch
            accessibilityLabel="Trip alerts"
            value={alerts}
            onValueChange={setAlerts}
            trackColor={{ false: c.line, true: c.green }}
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
          <Tile icon="shield-checkmark-outline" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={v.label}>Help & safety</Text>
            <Text style={v.small}>Support when you need it</Text>
          </View>
          <Icon name="chevron-forward" size={17} color={c.muted} />
        </Pressable>
      </View>
      <Button title="Sign out" secondary onPress={onSignOut} disabled={busy} />
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={onDeleteAccount}
        hitSlop={8}
        style={({ pressed }) => [{ alignSelf: "center", paddingVertical: 8 }, pressed && ps.pressed]}
      >
        <Text style={[v.small, { color: "#C53B1D", fontWeight: "700" }]}>Delete account</Text>
      </Pressable>
    </View>
  );
}

const v = StyleSheet.create({
  stack: { gap: 22 },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 16,
    padding: 18,
    gap: 16,
    boxShadow: "0px 4px 18px rgba(7, 44, 31, .04)",
  },
  section: {
    fontFamily: "Manrope",
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "800",
    color: c.ink,
    letterSpacing: -0.4,
  },
  label: {
    fontFamily: "Manrope",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: c.ink,
  },
  body: { fontFamily: "Manrope", fontSize: 14, lineHeight: 22, color: c.ink },
  small: {
    fontFamily: "Manrope",
    fontSize: 13,
    lineHeight: 18,
    color: c.muted,
  },
  caption: {
    fontFamily: "Manrope",
    fontSize: 12,
    lineHeight: 16,
    color: c.muted,
  },
  link: {
    fontFamily: "Manrope",
    fontSize: 12,
    lineHeight: 20,
    fontWeight: "700",
    color: c.green,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#F0F5F2",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  pill: {
    backgroundColor: "#EAF3ED",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  hero: {
    padding: 20,
    gap: 16,
    backgroundColor: "#0D654B",
    borderRadius: 20,
  },
  heroTitle: {
    fontFamily: "Manrope",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.7,
    fontWeight: "800",
    color: "white",
  },
  destination: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "white",
    borderRadius: 14,
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
    backgroundColor: "#F0F6F2",
    borderRadius: 16,
    padding: 16,
  },
  service: {
    flex: 1,
    gap: 18,
    borderWidth: 1,
    borderColor: "#D9E9DE",
    backgroundColor: "#E4F2E8",
    borderRadius: 16,
    padding: 19,
    minHeight: 160,
    justifyContent: "space-between",
  },
  mapNote: {
    position: "absolute",
    left: 12,
    bottom: 12,
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 17,
    minHeight: 76,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: "#EBF0ED" },
  search: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#F2F6F3",
    borderRadius: 14,
  },
  filter: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: "#F2F6F3",
    borderRadius: 20,
  },
  routeCard: { borderColor: "#DCEAE0", padding: 20 },
  routeCardOpen: { backgroundColor: "#F3F9F4", borderColor: "#8DC7A2", boxShadow: "0px 8px 24px rgba(7, 68, 44, 0.09)" },
  routeCode: {
    minWidth: 50,
    maxWidth: 72,
    height: 50,
    borderRadius: 17,
    backgroundColor: c.dark,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  routeCodeText: {
    fontFamily: "Manrope",
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
  stopDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.green },
  stopLine: { width: 1, flex: 1, backgroundColor: "#D0DDD4", marginTop: 4 },
  button: {
    minHeight: 54,
    backgroundColor: c.green,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  secondary: {
    backgroundColor: "#F0F5F2",
    borderWidth: 1,
    borderColor: c.line,
  },
  buttonLabel: {
    fontFamily: "Manrope",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    color: "white",
    flexShrink: 1,
  },
  journeyCard: { borderColor: "#DCEAE0", boxShadow: "0px 6px 20px rgba(7, 68, 44, 0.07)" },
  journeyPath: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F0F7F1", borderRadius: 16, padding: 15 },
  journeyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.green },
  segments: {
    flexDirection: "row",
    gap: 4,
    padding: 5,
    backgroundColor: "#EFF3F0",
    borderRadius: 18,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 14,
  },
  price: {
    fontFamily: "Manrope",
    fontSize: 16,
    lineHeight: 22,
    color: c.green,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  identity: {
    overflow: "hidden",
    alignItems: "center",
    gap: 18,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "#0B5942",
    borderWidth: 1,
    borderColor: "#217558",
  },
  avatarRing: {
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 1,
    borderColor: "#9ECBB0",
    padding: 7,
  },
  avatar: {
    flex: 1,
    borderRadius: 44,
    backgroundColor: c.dark,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: "Manrope",
    fontSize: 27,
    lineHeight: 36,
    fontWeight: "700",
    color: "white",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: c.green,
    borderWidth: 3,
    borderColor: "#0B5942",
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: {
    fontFamily: "Manrope",
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontWeight: "800",
    color: "white",
    textAlign: "center",
  },
  profileStats: {
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 22,
    paddingVertical: 18,
    backgroundColor: "#E5F1E7",
    borderWidth: 1,
    borderColor: "#D1E7D7",
    borderRadius: 16,
    alignItems: "center",
  },
  statValue: {
    fontFamily: "Manrope",
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "800",
    color: c.green,
  },
});
