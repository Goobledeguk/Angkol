import {
  PassengerHomeScreen,
  PassengerRoutesScreen,
  PassengerTripsScreen,
  PassengerProfileScreen,
} from "./passengerScreens";
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { confirmAccountDeletion } from "../common/confirmAccountDeletion";
import { Share, Linking } from "../services/previewActions";
import { api } from "../services/api";
import { currentPoint } from "../services/location";
import { distanceKm } from "../services/mapbox";
import { isStale, lastSeen, tripRef, vehicleForDriver } from "../domain/vehicles";
import { statusLabel, isPhMobile, normalizePhMobile } from "../domain/format";
import { greeting as greetingFor, minutesUntil, nextDeparture, waitLabel } from "../domain/schedule";
import type { Point, Quote, Route, Snapshot, Trip } from "../types/types";
import CalbayogMap from "../map/CalbayogMap";
import { Icon, money } from "../common/ui";
import { RouteBoard } from "../common/RouteBoard";
import { BodyNumber } from "../common/BodyNumber";
import { Glyph, type GlyphName } from "../common/Glyph";
import * as Speech from "expo-speech";
import { ps, passengerColors as c } from "./passengerStyles";
import { isFinished } from "../domain/roles";
import { haptic } from "../common/haptics";
import { SearchCountdown } from "./SearchCountdown";
import { RateTrip } from "./RateTrip";
import { Ticket } from "./Ticket";

type Props = {
  data: Snapshot;
  connected: boolean;
  notice: string;
  busy: boolean;
  dismissNotice: () => void;
  refresh: () => Promise<boolean>;
  action: (
    endpoint: string,
    input: unknown,
    method?: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
};
type IconName = React.ComponentProps<typeof Icon>["name"];
function Action({
  title,
  onPress,
  icon,
  light,
  disabled,
}: {
  title: string;
  onPress: () => void;
  icon?: IconName;
  light?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        ps.button,
        light && ps.buttonLight,
        disabled && { opacity: 0.45 },
        pressed && ps.pressed,
      ]}
    >
      {icon && <Icon name={icon} size={19} color={c.ink} />}
      <Text style={ps.buttonText}>{title}</Text>
    </Pressable>
  );
}
function Tag({ text, icon }: { text: string; icon?: IconName }) {
  return (
    <View style={ps.pill}>
      {icon ? <Icon name={icon} size={14} color={c.ink} /> : <View style={[ps.square, { width: 9, height: 9 }]} />}
      <Text style={ps.pillText}>{text}</Text>
    </View>
  );
}
function Secondary({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [ps.secondaryButton, disabled && { opacity: 0.45 }, pressed && ps.pressed]}
    >
      <Text style={ps.secondaryText} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
    </Pressable>
  );
}
function DriverLine({ trip, small }: { trip: Trip; small?: boolean }) {
  return (
    <View style={[ps.row, { gap: 14 }]}>
      <BodyNumber value={trip.plate} toda={trip.driverAssociation} size={small ? "sm" : "sm"} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={ps.label}>{trip.driver}</Text>
        <Text style={ps.small}>{trip.driverAssociation || "Tricycle"}{trip.plate ? ` · body no. ${trip.plate}` : ""}</Text>
      </View>
    </View>
  );
}
function ParaButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Para. Ask the driver to stop here"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [
        ps.button,
        { minHeight: 84, flexDirection: "column", gap: 0 },
        disabled && { opacity: 0.45 },
        pressed && ps.pressed,
      ]}
    >
      <Text style={{ fontFamily: "ArchivoBoard", fontSize: 40, lineHeight: 44, letterSpacing: 1, color: c.ink }}>
        PARA!
      </Text>
      <Text style={[ps.small, { color: c.ink, fontWeight: "600" }]}>Ask the driver to stop here</Text>
    </Pressable>
  );
}
function Hint({
  text,
  info,
  icon = "information-circle-outline",
}: {
  text: string;
  info?: boolean;
  icon?: IconName;
}) {
  return (
    <View style={[ps.hint, info && ps.info]}>
      <Icon name={icon} size={16} color={info ? c.muted : c.amber} />
      <Text style={[ps.hintText, info && { color: c.muted }]}>{text}</Text>
    </View>
  );
}
function Locations({
  pickup,
  destination,
  onPickup,
  onDestination,
  card,
}: {
  pickup?: string;
  destination?: string;
  onPickup?: () => void;
  onDestination?: () => void;
  card?: boolean;
}) {
  if (!onPickup && !onDestination) {
    return <RouteBoard from={pickup} to={destination} />;
  }
  return (
    <View style={card ? ps.card : { gap: 7 }}>
      {[
        {
          label: "Pickup",
          value: pickup || "Choose your pickup",
          onPress: onPickup,
          orange: false,
        },
        {
          label: "Destination",
          value: destination || "Where are you going?",
          onPress: onDestination,
          orange: true,
        },
      ].map((item) => (
        <Pressable
          key={item.label}
          disabled={!item.onPress}
          accessibilityRole={item.onPress ? "button" : undefined}
          onPress={item.onPress}
          style={card || !item.onPress ? [ps.row, { paddingVertical: 4 }] : ps.location}
        >
          <View style={[ps.dot, item.orange && ps.square]} />
          <View style={{ flex: 1 }}>
            <Text style={ps.locationCaption}>{item.label}</Text>
            <Text style={ps.label}>{item.value}</Text>
          </View>
          {item.onPress && (
            <Icon name="chevron-forward" size={18} color={c.muted} />
          )}
        </Pressable>
      ))}
    </View>
  );
}
function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={ps.between}>
      <Text style={ps.body}>{label}</Text>
      <Text
        style={[
          ps.small,
          { color: c.ink, flexShrink: 1, textAlign: "right" },
          strong && { fontWeight: "600" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}
const stamp = (at: number | string) =>
  new Date(at).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
  });
const fullDate = (at: number | string) =>
  new Date(at).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
function tripText(trip: Trip) {
  return `Angkol trip ${tripRef(trip.id)}\n${trip.status}\n${trip.pickup} → ${trip.destination}\nDriver: ${trip.driver || "Awaiting assignment"}${trip.plate ? ` · ${trip.plate}` : ""}\n${trip.demoPayment ? `${trip.demoPayment.method} TEST ONLY — no money charged; actual fare remains payable. Demo reference: ${trip.demoPayment.reference}\nFare` : "Fixed cash fare"}: ${money(trip.fare)}${trip.sampleFare ? " (sample fare)" : ""}\n${fullDate(trip.createdAt)} · ${stamp(trip.createdAt)}`;
}

export default function PassengerApp({
  data,
  connected,
  notice,
  busy,
  dismissNotice,
  refresh,
  action,
  logout,
}: Props) {
  const insets = useSafeAreaInsets();
  const navLift = insets.bottom > 0 ? Math.max(insets.bottom - 30, 0) : 0;
  const params = useLocalSearchParams<{ screen?: string; trip?: string }>();
  const aliases: Record<string, string> = {
    "My trips": "Trips",
    Reports: "Support",
  };
  const validPages = [
    "Home",
    "Journey",
    "Location search",
    "Choose ride",
    "Review ride",
    "Ride accepted",
    "Track ride",
    "Arrived",
    "Drop off",
    "Pay cash",
    "Receipt",
    "Routes",
    "Terminals",
    "Trips",
    "Profile",
    "Edit profile",
    "Support",
    "Notifications",
    "PUJ review",
    "PUJ arrived",
    "PUJ complete",
  ];
  const requested = aliases[params.screen || ""] || params.screen || "Home";
  const page = validPages.includes(requested) ? requested : "Home";
  const [pickup, setPickup] = useState<Point | null>(data.landmarks[0] || null),
    [destination, setDestination] = useState<Point | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null),
    [pickupNote, setPickupNote] = useState("");
  const [heroHeight, setHeroHeight] = useState(300);
  const [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [, setGpsAt] = useState<number | null>(null);
  const [editing, setEditing] = useState<"pickup" | "destination">(
      "destination",
    ),
    [search, setSearch] = useState(""),
    [results, setResults] = useState<Point[]>([]);
  const [routeId, setRouteId] = useState<string | null>(null),
    [terminalId, setTerminalId] = useState<string | null>(null);
  const [pujRoute, setPujRoute] = useState<Route | null>(null);
  const [name, setName] = useState(data.user.name),
    [phone, setPhone] = useState(data.user.phone),
    [report, setReport] = useState("");
  const [paymentMethod] = useState("Cash");
  const [rideType, setRideType] = useState<"regular" | "special">("regular");
  const submitting = useRef(false),
    scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    previousStatuses = useRef(new Map(data.trips.map((t) => [t.id, t.status])));
  const active = data.trips.find((t) => !isFinished(t));
  const trip =
    data.trips.find((t) => t.id === params.trip) || active || data.trips[0];
  const vehicle = vehicleForDriver(data.vehicles, trip?.driverId, trip?.plate);
  const routes = data.routes.filter((r) => r.active),
    terminals = data.terminals.filter((t) => t.active);
  const selectedRoute =
    routes.find((route) => route.id === routeId) || routes[0];
  const terminal = terminals.find((t) => t.id === terminalId) || terminals[0];
  const locked = working || busy;
  const unread = data.notifications.filter((n) => !n.read).length;
  const go = (next: string, id?: string) => {
    setError("");
    router.setParams({ screen: next, trip: id || "" });
  };
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [page]);
  useEffect(() => {
    if (error) {
      scroll.current?.scrollTo({ y: 0, animated: true });
    }
  }, [error]);
  useEffect(() => {
    for (const value of data.trips) {
      const previous = previousStatuses.current.get(value.id);
      if (
        (page === "Track ride" || page === "Ride accepted") &&
        previous &&
        previous !== value.status
      ) {
        if (value.status === "Completed") {
          haptic.success();
          router.setParams({ screen: "Receipt", trip: value.id });
        } else if (value.status === "Arrived") {
          haptic.tap();
          router.setParams({ screen: "Arrived", trip: value.id });
        } else if (value.status === "In progress") {
          router.setParams({ screen: "Track ride", trip: value.id });
        } else if (value.status === "Accepted") {
          haptic.success();
        } else if (value.status === "Expired") {
          haptic.warning();
        }
      }
      previousStatuses.current.set(value.id, value.status);
    }
  }, [data.trips, page]);
  async function perform(task: () => Promise<void>) {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setWorking(true);
    setError("");
    try {
      await task();
    } catch (e) {
      setError((e as Error).message || "Something went wrong. Try again.");
    } finally {
      submitting.current = false;
      setWorking(false);
    }
  }
  function choosePoint(point: Point) {
    if (editing === "pickup") {
      setPickup(point);
      setGpsAt(null);
    } else {
      setDestination(point);
    }
    setQuote(null);
    go("Journey");
  }
  function pick(kind: "pickup" | "destination") {
    setEditing(kind);
    setSearch("");
    setResults([]);
    go("Location search");
  }
  const gps = () =>
    perform(async () => {
      const here = await currentPoint();
      setPickup(here);
      setGpsAt(Date.now());
      setQuote(null);
    });
  const searchPlaces = () =>
    perform(async () => {
      setResults(
        await api<Point[]>(`/search?q=${encodeURIComponent(search.trim())}`),
      );
    });
  const getQuote = () =>
    perform(async () => {
      if (!pickup || !destination) {
        throw new Error("Choose both your pickup and destination.");
      }
      if (active) {
        go("Track ride", active.id);
        return;
      }
      const next = await api<Quote>("/quote", { pickup, destination });
      setQuote(next);
      go("Choose ride");
    });
  const rideAgain = (from: Trip) =>
    perform(async () => {
      if (active) {
        go("Track ride", active.id);
        return;
      }
      setPickup(from.pickupPoint);
      setDestination(from.destinationPoint);
      setGpsAt(null);
      const next = await api<Quote>("/quote", {
        pickup: from.pickupPoint,
        destination: from.destinationPoint,
      });
      setQuote(next);
      go("Choose ride");
    });
  const confirm = () =>
    perform(async () => {
      if (!quote || quote.expires <= Date.now()) {
        setQuote(null);
        throw new Error(
          "This fare quote expired. Go back and confirm your locations for a fresh quote.",
        );
      }
      const created = await api<Trip>("/book", {
        quoteId: quote.id,
        pickupNote,
        rideType,
        ...(paymentMethod !== "Cash" ? { demoMethod: paymentMethod } : {}),
      });
      setQuote(null);
      await refresh();
      go("Ride accepted", created.id);
    });
  const cancel = () => {
    if (!trip || !["Requested", "Accepted", "Arrived"].includes(trip.status)) {
      return;
    }
    Alert.alert(
      "Cancel this request?",
      "The driver will be notified. You can book again after cancellation.",
      [
        { text: "Keep ride", style: "cancel" },
        {
          text: "Cancel request",
          style: "destructive",
          onPress: () => {
            void perform(async () => {
              if (await action(`/trips/${trip.id}`, { status: "Cancelled" })) {
                go("Trips");
              }
            });
          },
        },
      ],
    );
  };
  const advance = (status: string, next: string) =>
    perform(async () => {
      if (!trip) {
        return;
      }
      if (await action(`/trips/${trip.id}`, { status })) {
        await refresh();
        go(next, trip.id);
      }
    });
  const share = (receipt = false) =>
    perform(async () => {
      if (!trip) {
        return;
      }
      await Share.share({
        title: receipt ? "Angkol trip receipt" : "My Angkol trip status",
        message:
          tripText(trip) +
          (receipt
            ? `\nBooking fee: ${money(0)}\nPaid directly to driver · Cash`
            : vehicle
              ? `\nDriver location last updated ${stamp(vehicle.location.updatedAt)}. This is a status snapshot, not a live tracking link.`
              : "\nLive driver location is not currently available."),
      });
    });
  function map(
    height: number,
    journey?: "quote" | "trip" | "route" | "terminal" | "select",
  ) {
    const selectedTrip = journey === "trip" ? trip : null;
    const approaching =
      selectedTrip && ["Accepted", "Arrived"].includes(selectedTrip.status);
    return (
      <CalbayogMap
        height={height}
        pickupLabel={
          journey === "route"
            ? selectedRoute?.name
            : approaching
              ? "Meet here"
              : undefined
        }
        landmarks={data.landmarks}
        pickup={
          selectedTrip?.pickupPoint ||
          (journey === "route"
            ? selectedRoute?.stops[0]
            : journey === "terminal"
              ? terminal?.point
              : pickup)
        }
        destination={
          (approaching ? null : selectedTrip?.destinationPoint) ||
          (journey === "route"
            ? selectedRoute && selectedRoute.stops.length > 1
              ? selectedRoute.stops.at(-1)
              : null
            : destination)
        }
        geometry={
          (approaching ? null : selectedTrip?.geometry) ||
          (journey === "quote" ? quote?.geometry : null)
        }
        vehicles={
          journey === "trip"
            ? vehicle ? [vehicle] : []
            : data.vehicles
        }
        terminals={journey === "terminal" ? terminals : []}
        mode={journey === "select" ? editing : null}
        onSelect={choosePoint}
      />
    );
  }
  const disclaimer = data.sampleMode
    ? "Sample fares only · not an official LGU fares"
    : "";
  const tabPages = ["Home", "Routes", "Terminals", "Trips", "Profile"];
  const greeting = greetingFor(data.serverTime);
  let title = "Where to today?",
    subtitle = `${greeting}, ${data.user.name.split(" ")[0]}`,
    back: string | null = null;
  let content: React.ReactNode,
    footer: React.ReactNode = null,
    hero: React.ReactNode = null,
    live = false;
  function receiptDetails(value: Trip | Quote) {
    return (
      <View style={ps.card}>
        <Locations pickup={value.pickup} destination={value.destination} />
        <View style={ps.divider} />
        <SummaryRow
          label="Ride"
          value={`${value.distance} km · ${value.minutes} min`}
        />
        {"driver" in value && (
          <SummaryRow
            label="Driver"
            value={`${value.driver || "—"} · ${value.plate || "—"}`}
          />
        )}
        {pickupNote && !("passengerId" in value) ? (
          <Text style={ps.small}>Your note: “{pickupNote}”</Text>
        ) : null}
        {"pickupNote" in value && value.pickupNote ? (
          <Text style={ps.small}>Your note: “{value.pickupNote}”</Text>
        ) : null}
      </View>
    );
  }
  function fares(value: Trip | Quote) {
    const demo = "demoPayment" in value ? value.demoPayment : undefined;
    return (
      <View style={ps.card}>
        <SummaryRow
          label={`City fare matrix${value.sampleFare ? " (sample)" : ""}`}
          value={money(value.fare)}
        />
        <SummaryRow label="Booking fee" value={money(0)} />
        <View style={ps.divider} />
        <View style={ps.between}>
          <Text style={ps.label}>Total</Text>
          <Text style={ps.fare}>{money(value.fare)}</Text>
        </View>
        {"paymentStatus" in value && value.paymentStatus ? (
          <SummaryRow
            label="Payment"
            value={
              value.paymentStatus === "paid"
                ? demo
                  ? "Paid"
                  : "Paid in cash"
                : value.paymentStatus === "pending"
                  ? "Awaiting confirmation"
                  : "Pay the driver in cash"
            }
          />
        ) : null}

        {demo && (
          <Text style={ps.small}>
            Demo reference: {demo.reference}. This is not proof of payment. The
            actual fare remains payable to your driver.
          </Text>
        )}
      </View>
    );
  }
  if (page === "Home") {
    title = "Calbayog";
    subtitle = `${greeting}, ${data.user.name.split(" ")[0]}`;
    content = (
      <PassengerHomeScreen
        data={data}
        active={active}
        onBook={() => go("Journey")}
        onRoutes={() => go("Routes")}
        onTerminals={() => go("Terminals")}
        onTrack={() =>
          active?.status === "Requested"
            ? go("Ride accepted", active.id)
            : active?.serviceType === "PUJ/PUV"
              ? go("PUJ arrived", active.id)
              : go("Track ride", active?.id)
        }
        onRideAgain={rideAgain}
        onDestination={(point) => {
          setDestination(point);
          setQuote(null);
          go("Journey");
        }}
      />
    );
  } else if (page === "Journey") {
    title = "Where to?";
    subtitle = "";
    back = "Home";
    content = (
      <>
        <Locations
          pickup={pickup?.name}
          destination={destination?.name}
          onPickup={() => pick("pickup")}
          onDestination={() => pick("destination")}
        />
        <Action
          title={working ? "Getting your location…" : "Use my location for pickup"}
          icon="locate-outline"
          light
          disabled={locked}
          onPress={gps}
        />
        <View style={{ gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setEditing((m) => (m === "pickup" ? "destination" : "pickup"))}
            style={[ps.pill, { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6 }]}
          >
            <Icon name={editing === "pickup" ? "location-outline" : "flag-outline"} size={14} color={c.ink} />
            <Text style={ps.pillText}>Tap map to set {editing}</Text>
          </Pressable>
          {map(240, "select")}
        </View>
        <View style={ps.row}>
          <TextInput
            accessibilityLabel="Pickup note"
            placeholder="Note for your driver, e.g. by the park gate"
            placeholderTextColor={c.muted}
            value={pickupNote}
            maxLength={200}
            onChangeText={setPickupNote}
            style={[ps.input, { flex: 1 }]}
          />
        </View>
      </>
    );
    footer = (
      <Action
        title={
          working
            ? "Finding your road route…"
            : active
              ? "View your active ride"
              : "Confirm locations"
        }
        icon="arrow-forward"
        disabled={locked || (!active && (!pickup || !destination))}
        onPress={getQuote}
      />
    );
  } else if (page === "Location search") {
    title = `Choose ${editing}`;
    subtitle = "";
    back = "Journey";
    content = (
      <>
        <View style={ps.search}>
          <Icon name="search-outline" size={20} />
          <TextInput
            accessibilityLabel={`Search ${editing}`}
            style={ps.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Street, place, or landmark"
            placeholderTextColor={c.muted}
            returnKeyType="search"
            onSubmitEditing={searchPlaces}
          />
        </View>
        <Action
          title={working ? "Searching…" : "Search places"}
          disabled={locked || search.trim().length < 3}
          onPress={searchPlaces}
          icon="search-outline"
        />
        {results.map((point) => (
          <Pressable
            accessibilityRole="button"
            key={`${point.latitude},${point.longitude}`}
            onPress={() => choosePoint(point)}
            style={ps.location}
          >
            <Icon name="location-outline" size={20} />
            <Text style={[ps.label, { flex: 1 }]}>{point.name}</Text>
            <Icon name="chevron-forward" size={16} />
          </Pressable>
        ))}
        <Text style={ps.section}>Calbayog landmarks</Text>
        {data.landmarks.map((point) => (
          <Pressable
            key={point.name}
            accessibilityRole="button"
            onPress={() => choosePoint(point)}
            style={ps.location}
          >
            <Icon name="location-outline" />
            <Text style={[ps.label, { flex: 1 }]}>{point.name}</Text>
            <Icon name="chevron-forward" size={16} />
          </Pressable>
        ))}
        <Action
          title="Pinpoint on the map"
          icon="map-outline"
          light
          onPress={() => go("Journey")}
        />
      </>
    );
  } else if (page === "Choose ride" || page === "Review ride") {
    title = page === "Choose ride" ? "Choose your ride" : "Review your ride";
    subtitle =
      page === "Choose ride"
        ? `${pickup?.name || "Pickup"} → ${destination?.name || "Destination"}`
        : "Cash fare, paid to your driver";
    back = page === "Choose ride" ? "Journey" : "Choose ride";
    if (!quote) {
      content = (
        <Hint text="Your fare quote is no longer available. Confirm your locations to get a fresh quote." />
      );
      footer = <Action title="Back to journey" onPress={() => go("Journey")} />;
    } else if (page === "Choose ride") {
      content = (
        <>
          {map(190, "quote")}
          {[
            {
              key: "regular" as const,
              title: "Regular",
              sub: `Shared, pay per head · ${quote.minutes} min`,
              fare: quote.fare,
            },
            {
              key: "special" as const,
              title: "Special (pakyaw)",
              sub: "Whole tricycle, pay for all 3 seats",
              fare: quote.fare * 3,
            },
          ].map((option) => (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: rideType === option.key }}
              onPress={() => setRideType(option.key)}
              style={[ps.card, rideType === option.key && ps.selected]}
            >
              <View style={ps.row}>
                <Glyph name="tricycle" size={30} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={ps.label}>{option.title}</Text>
                  <Text style={ps.small}>{option.sub}</Text>
                </View>
                <Text style={ps.fare}>{money(option.fare)}</Text>
              </View>
            </Pressable>
          ))}

          {/* Jeepney / PUV card — opens the PUJ booking flow */}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (!routes.length) {
                setError("No PUJ/PUV routes are available right now.");
                return;
              }
              setPujRoute(routes[0]);
              go("PUJ review");
            }}
            style={ps.card}
          >
            <View style={ps.row}>
              <Glyph name="jeepney" size={30} color={c.muted} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={ps.label}>Jeepney</Text>
                <Text style={ps.small}>Fixed routes, board at the terminal</Text>
              </View>
              <Text style={[ps.fare, { color: c.muted }]}>
                {routes.length
                  ? `from ${money(Math.min(...routes.map((r) => r.fare)))}`
                  : "—"}
              </Text>
            </View>
          </Pressable>
        </>
      );
      footer = (
        <Action
          title={`Continue · ${money(rideType === "special" ? quote.fare * 3 : quote.fare)} cash`}
          onPress={() => go("Review ride")}
        />
      );
    } else {
      content = (
        <>
          {receiptDetails(quote)}
          {fares(quote)}
        </>
      );
      footer = (
        <Action
          title={
            working
              ? "Sending your request…"
              : paymentMethod === "Cash"
                ? `Request ${rideType === "special" ? "special" : "regular"} tricycle · ${money(rideType === "special" ? quote.fare * 3 : quote.fare)}`
                : `Simulate ${paymentMethod} & request ride · ${money(quote.fare)}`
          }
          icon="checkmark-circle-outline"
          disabled={locked}
          onPress={confirm}
        />
      );
    }
  } else if (page === "PUJ review") {
    title = "Review PUJ/PUV ride";
    subtitle = pujRoute?.name || "Select a route";
    back = "Choose ride";
    if (!pujRoute) {
      content = (
        <Hint text="No route selected. Go back and choose a PUJ/PUV route." />
      );
      footer = <Action title="Back" onPress={() => go("Choose ride")} />;
    } else {
      content = (
        <>
          <View style={ps.card}>
            <View style={ps.between}>
              <Text style={ps.section}>{pujRoute.name}</Text>
              <Tag text={pujRoute.id} />
            </View>
            {pujRoute.destination ? (
              <Text style={ps.small}>Destination: {pujRoute.destination}</Text>
            ) : null}
            <Text style={ps.body}>
              {pujRoute.stops.map((p) => p.name).join(" → ")}
            </Text>
            <View style={ps.divider} />
            <SummaryRow
              label="Fare per passenger"
              value={money(pujRoute.fare)}
              strong
            />
            <SummaryRow
              label="Next departure"
              value={`${nextDeparture(pujRoute, data.serverTime)}${minutesUntil(pujRoute, data.serverTime) !== null ? ` · ${waitLabel(pujRoute, data.serverTime).toLowerCase()}` : ""}`}
            />
          </View>
          <View style={ps.card}>
            <Locations
              pickup={pickup?.name || pujRoute.stops[0]?.name}
              destination={destination?.name || pujRoute.destination || pujRoute.stops.at(-1)?.name}
            />
          </View>
          <Text style={ps.small}>
            We hold a seat on the next unit with room. Pay when you board.
          </Text>
        </>
      );
      footer = (
        <Action
          title={
            working
              ? "Booking…"
              : `Book for ${money(pujRoute.fare)}`
          }
          icon="checkmark-circle-outline"
          disabled={locked}
          onPress={() =>
            perform(async () => {
              const from = pickup || pujRoute.stops[0] || data.landmarks[0];
              const to =
                destination ||
                pujRoute.stops.at(-1) ||
                data.landmarks[2];
              const pujTrip: Trip = {
                id: `puj-trip-${Date.now()}`,
                pickup: from.name,
                destination: to.name,
                pickupPoint: from,
                destinationPoint: to,
                distance: Math.round(distanceKm(from, to) * 10) / 10,
                fare: pujRoute.fare,
                minutes: pujRoute.interval || 15,
                passengerId: data.user.id,
                passenger: data.user.name,
                driverId: null,
                status: "Requested",
                createdAt: new Date().toISOString(),
                timestamps: { Requested: Date.now() },
                rating: null,
                sampleFare: false,
                expires: Date.now() + 10 * 60 * 1000,
                fareReference: pujRoute.reference,
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [from.longitude, from.latitude],
                    [to.longitude, to.latitude],
                  ],
                },
              };
              const created = await api<Trip>("/book-puj", {
                trip: pujTrip,
                routeId: pujRoute.id,
              });
              await refresh();
              go("PUJ arrived", created.id);
            })
          }
        />
      );
    }
  } else if (page === "PUJ arrived") {
    const pujTrip = data.trips.find((t) => t.id === params.trip);
    const unit = data.vehicles.find((v) => v.id === pujTrip?.vehicleId);
    const pujRouteInfo = data.routes.find((r) => r.id === pujTrip?.routeId);
    const stand = data.terminals.find((t) => t.routeId === pujTrip?.routeId);
    title =
      pujTrip?.status === "Expired"
        ? "Seat released"
        : pujTrip?.status === "Requested"
          ? "Seat requested"
          : `Board at ${stand?.name || pujTrip?.pickup || "the terminal"}`;
    subtitle =
      pujRouteInfo && pujTrip?.status !== "Expired"
        ? `Next departure ${nextDeparture(pujRouteInfo, data.serverTime)} · ${waitLabel(pujRouteInfo, data.serverTime).toLowerCase()}`
        : "";
    back = "Home";
    if (!pujTrip) {
      content = <Text style={ps.body}>This jeepney booking can’t be found.</Text>;
      footer = <Action title="Back to Home" onPress={() => go("Home")} />;
    } else if (pujTrip.status === "Expired") {
      content = (
        <Text style={ps.body}>Nobody boarded on this booking, so the seat went back to the queue.</Text>
      );
      footer = <Action title="See jeepney routes" onPress={() => go("Routes")} />;
    } else {
      content = (
        <>
          <View style={[ps.row, { gap: 14 }]}>
            <BodyNumber value={unit?.plate || pujTrip.plate} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ps.label}>{[unit?.name, pujTrip.driver].filter(Boolean).join(" · ")}</Text>
              <Text style={ps.small}>{unit?.capacity ? `${unit.capacity}-seat jeepney` : "Jeepney"}</Text>
            </View>
          </View>
          <RouteBoard from={pujTrip.pickup} to={pujTrip.destination} />
          <View style={ps.card}>
            <SummaryRow label="Fare, pay the driver or konduktor" value={money(pujTrip.fare)} strong />
            <SummaryRow
              label="Student, senior or PWD (show ID)"
              value={money(Math.round(pujTrip.fare * 0.8 * 100) / 100)}
            />
          </View>
          <Text style={ps.small}>Show this screen when you board. Tap PARA! when you get off.</Text>
        </>
      );
      footer = (
        <ParaButton
          disabled={locked}
          onPress={() =>
            perform(async () => {
              if (await action(`/trips/${pujTrip.id}`, { status: "Completed" })) {
                haptic.success();
                go("PUJ complete", pujTrip.id);
              }
            })
          }
        />
      );
    }
  } else if (page === "PUJ complete") {
    title = "Trip complete";
    subtitle = "Salamat ha pagsakay!";
    back = "Home";
    const pujTrip = data.trips.find(
      (t) => t.id === params.trip && t.status === "Completed",
    );
    content = pujTrip ? (
      <>
        <View style={ps.banner}>
          <Text style={ps.total}>{money(pujTrip.fare)}</Text>
          <Text style={ps.bannerSub}>
            {fullDate(pujTrip.createdAt)} · {stamp(pujTrip.createdAt)}
          </Text>
        </View>
        {receiptDetails(pujTrip)}
        {fares(pujTrip)}
        <RateTrip
          rating={pujTrip.rating}
          driver={pujTrip.driver}
          disabled={locked}
          onRate={(rating) => action(`/trips/${pujTrip.id}/rating`, { rating })}
        />
      </>
    ) : (
      <Hint text="No trip found." />
    );
    footer = <Action title="Back to Home" onPress={() => go("Home")} />;
  } else if (page === "Ride accepted" || page === "Arrived" || page === "Track ride" || page === "Drop off" || page === "Pay cash") {
    const driverName = trip?.driver?.split(" ")[0] || "Your driver";
    const eta =
      trip && vehicle && trip.status === "Accepted"
        ? Math.max(1, Math.round((distanceKm(vehicle.location, trip.pickupPoint) / 18) * 60))
        : null;
    const view =
      !trip
        ? "missing"
        : trip.status === "Expired"
          ? "expired"
          : trip.status === "Cancelled"
            ? "cancelled"
            : trip.status === "Completed"
              ? "completed"
              : page === "Pay cash"
                ? "pay"
                : page === "Drop off"
                  ? "dropoff"
                  : trip.status === "In progress"
                    ? "riding"
                    : trip.status === "Arrived"
                      ? "arrived"
                      : trip.status === "Accepted"
                        ? "approaching"
                        : "searching";
    back = view === "dropoff" ? "Track ride" : view === "pay" ? "Drop off" : "Home";
    live = ["searching", "approaching", "riding"].includes(view);
    subtitle = "";
    if (!trip || view === "missing") {
      title = "No active ride";
      content = <Text style={ps.body}>Choose a destination on Home to book one.</Text>;
      footer = <Action title="Back to Home" onPress={() => go("Home")} />;
    } else if (view === "expired") {
      title = "No driver accepted";
      subtitle = "The request closed after 10 minutes. Nothing to pay.";
      content = (
        <>
          <RouteBoard from={trip.pickup} to={trip.destination} />
          <SummaryRow label="Last fare" value={money(trip.fare)} />
          <SummaryRow
            label="Closed at"
            value={trip.timestamps.Expired ? stamp(trip.timestamps.Expired) : "—"}
          />
        </>
      );
      footer = (
        <>
          <Action
            title={working ? "Getting a fresh fare…" : `Ask again · ${money(trip.fare)}`}
            disabled={locked}
            onPress={() => rideAgain(trip)}
          />
          <Secondary title="Back to Home" onPress={() => go("Home")} />
        </>
      );
    } else if (view === "cancelled" || view === "completed") {
      title = view === "cancelled" ? "Request cancelled" : "This ride is finished";
      content = <RouteBoard from={trip.pickup} to={trip.destination} />;
      footer =
        view === "completed" ? (
          <Action title="See receipt" onPress={() => go("Receipt", trip.id)} />
        ) : (
          <Action title="Back to Home" onPress={() => go("Home")} />
        );
    } else if (view === "searching") {
      title = "Asking drivers nearby";
      subtitle = `Closest first · ${money(trip.fare)} cash`;
      hero = map(heroHeight, "trip");
      content = (
        <>
          <RouteBoard from={trip.pickup} to={trip.destination} />
          {Boolean(trip.pickupNote) && <Text style={ps.small}>Your note: “{trip.pickupNote}”</Text>}
        </>
      );
      footer = (
        <>
          {trip.expires ? <SearchCountdown expires={trip.expires} /> : null}
          <Secondary title="Cancel request" disabled={locked} onPress={cancel} />
        </>
      );
    } else if (view === "approaching") {
      title = eta ? `${driverName} is ${eta} min away` : `${driverName} is on the way`;
      subtitle = `Meet at ${trip.pickup}`;
      hero = map(heroHeight, "trip");
      content = (
        <>
          <DriverLine trip={trip} />
          <RouteBoard from={trip.pickup} to={trip.destination} compact />
          {Boolean(trip.pickupNote) && <Text style={ps.small}>Your note: “{trip.pickupNote}”</Text>}
          <SummaryRow label="Fare, in cash" value={money(trip.fare)} strong />
        </>
      );
      footer = <Secondary title="Cancel request" disabled={locked} onPress={cancel} />;
    } else if (view === "arrived") {
      title = `${driverName} is here`;
      subtitle = "Board only if the body number matches";
      const readAloud = () =>
        Speech.speak(
          `${driverName} is here at ${trip.pickup}. ${trip.driverAssociation ? `${trip.driverAssociation}, ` : ""}body number ${trip.plate || "not set"}. Fare ${trip.fare} pesos, cash.`,
          { language: "en-PH", rate: 0.9 },
        );
      content = (
        <>
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
            <BodyNumber value={trip.plate} toda={trip.driverAssociation} align="center" />
            <View style={{ alignItems: "center", gap: 2 }}>
              <Text style={ps.label}>{trip.driver}</Text>
              <Text style={[ps.small, { textAlign: "center" }]} numberOfLines={2}>
                Waiting at {trip.pickup}
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={readAloud} hitSlop={8}>
              <Text style={ps.textLink}>Read details aloud</Text>
            </Pressable>
          </View>
          <RouteBoard from={trip.pickup} to={trip.destination} compact />
          <SummaryRow label="Fare, in cash" value={money(trip.fare)} strong />
          {Boolean(trip.pickupNote) && <Text style={ps.small}>Your note: “{trip.pickupNote}”</Text>}
        </>
      );
      footer = (
        <>
          <Action
            title={working ? "Starting…" : "I’m on board"}
            disabled={locked}
            onPress={() => void advance("In progress", "Track ride")}
          />
          <View style={ps.row}>
            <View style={{ flex: 1 }}>
              <Secondary
                title="Wrong number"
                onPress={() => {
                  setReport(
                    `The tricycle at pickup did not match body number ${trip.plate || "—"} (trip ${tripRef(trip.id)}).`,
                  );
                  go("Support", trip.id);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Secondary title="Cancel ride" disabled={locked} onPress={cancel} />
            </View>
          </View>
        </>
      );
    } else if (view === "riding") {
      title = `About ${trip.minutes} min to ${trip.destination}`;
      subtitle =
        vehicle && isStale(vehicle.location.updatedAt, data.serverTime)
          ? `Driver’s GPS last seen ${lastSeen(vehicle.location.updatedAt, data.serverTime).toLowerCase()}`
          : `${trip.distance} km trip · estimate`;
      hero = map(heroHeight, "trip");
      content = (
        <>
          <RouteBoard from={trip.pickup} to={trip.destination} compact />
          <DriverLine trip={trip} small />
          <SummaryRow label="Fare, in cash" value={money(trip.fare)} strong />
          <Secondary title="Share trip status" disabled={locked} onPress={() => share()} />
        </>
      );
      footer = <ParaButton disabled={locked} onPress={() => go("Drop off", trip.id)} />;
    } else if (view === "dropoff") {
      title = `Is this ${trip.destination}?`;
      subtitle = "If not, tell your driver before you pay.";
      content = (
        <>
          {map(220, "trip")}
          <DriverLine trip={trip} small />
          <SummaryRow label="Fare, in cash" value={money(trip.fare)} strong />
        </>
      );
      footer = (
        <Action title={`Yes, pay ${money(trip.fare)}`} onPress={() => go("Pay cash", trip.id)} />
      );
    } else {
      const bill = [20, 50, 100, 200, 500, 1000].find((b) => b >= trip.fare) || trip.fare;
      title = `Pay ${driverName}`;
      subtitle = "Cash, straight to your driver.";
      content = (
        <>
          <View style={{ gap: 4, paddingVertical: 6 }}>
            <Text style={[ps.total, { fontSize: 72, lineHeight: 72 }]}>{money(trip.fare)}</Text>
            <Text style={ps.small}>City fare matrix · no booking or platform fee</Text>
          </View>
          <View style={ps.card}>
            <SummaryRow
              label="Student, senior or PWD (show ID)"
              value={money(Math.round(trip.fare * 0.8 * 100) / 100)}
              strong
            />
            {bill > trip.fare && (
              <SummaryRow label={`Paying with ${money(bill)}`} value={`${money(bill - trip.fare)} change`} />
            )}
          </View>
          <RouteBoard from={trip.pickup} to={trip.destination} compact />
        </>
      );
      footer = (
        <Action
          title={working ? "Completing trip…" : `Paid ${money(trip.fare)}`}
          disabled={locked}
          onPress={() =>
            perform(async () => {
              if (await action(`/trips/${trip.id}`, { status: "Completed" })) {
                haptic.success();
                await refresh();
                go("Receipt", trip.id);
              }
            })
          }
        />
      );
    }
  } else if (page === "Routes") {
    title = "Routes";
    subtitle = `${data.routes.filter((route) => route.active).length} active in Calbayog`;
    content = (
      <PassengerRoutesScreen
        data={data}
        selectedId={routeId}
        onSelect={setRouteId}
        busy={locked}
        onTerminals={() => go("Terminals")}
        onCancel={(id) => {
          void action(`/stops/${id}`, {}, "DELETE");
        }}
        onPickup={(route) => {
          if (route.transportType === "Tricycle") {
            setQuote(null);
            go("Journey");
            return;
          }
          // For PUJ/PUV routes, send the passenger into the PUJ booking flow.
          setPujRoute(route);
          go("PUJ review");
        }}
      />
    );
  } else if (page === "Terminals") {
    title = "Nearby terminals";
    subtitle = "Estimated departures";
    content = (
      <>
        {map(160, "terminal")}
        {terminals.map((item) => {
          const route = routes.find((r) => r.id === item.routeId);
          return (
            <View
              key={item.id}
              style={[ps.card, terminal?.id === item.id && ps.selected]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: terminal?.id === item.id }}
                onPress={() => setTerminalId(item.id)}
                style={({ pressed }) => [ps.row, pressed && { opacity: 0.7 }]}
              >
                <Icon name="business-outline" size={24} />
                <View style={{ flex: 1 }}>
                  <Text style={ps.label}>{item.name}</Text>
                  <Text style={ps.small}>
                    {route?.name || "Route not active"}
                  </Text>
                </View>
                <Icon
                  name={terminal?.id === item.id ? "chevron-up" : "chevron-down"}
                  size={18}
                />
              </Pressable>
              {terminal?.id === item.id && (
                <View style={ps.row}>
                  <View style={{ flex: 1 }}>
                    <Action
                      title="Use as pickup"
                      light
                      onPress={() => {
                        setPickup(item.point);
                        setQuote(null);
                        setGpsAt(null);
                        go("Journey");
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Action
                      title="Directions"
                      icon="navigate-outline"
                      light
                      onPress={() => {
                        void perform(async () => {
                          await Linking.openURL(
                            `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${pickup ? `${pickup.latitude}%2C${pickup.longitude}` : ""}%3B${item.point.latitude}%2C${item.point.longitude}`,
                          );
                        });
                      }}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}
        {!terminals.length && (
          <Hint text="No active terminals are configured yet." />
        )}
        <View style={ps.between}>
          <Text style={ps.section}>Today’s departures</Text>
          <Text style={ps.tiny}>Updated {stamp(data.serverTime)}</Text>
        </View>
        {routes
          .filter((route) => route.scheduled !== false && route.interval > 0)
          .map((route) => (
            <Pressable
              key={route.id}
              accessibilityRole="button"
              onPress={() => {
                setRouteId(route.id);
                go("Routes");
              }}
              style={ps.depart}
            >
              <View>
                <Text style={ps.departTime}>
                  {nextDeparture(route, data.serverTime).replace("Tomorrow ", "")}
                </Text>
                <Text style={ps.tiny}>
                  {nextDeparture(route, data.serverTime).startsWith("Tomorrow")
                    ? "Tomorrow"
                    : waitLabel(route, data.serverTime)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ps.label}>{route.name}</Text>
                {route.destination ? (
                  <Text style={ps.tiny}>Destination: {route.destination}</Text>
                ) : null}
                <Text style={ps.tiny}>
                  {route.id} · Every {route.interval} min
                </Text>
              </View>
              <Icon name="chevron-forward" size={20} />
            </Pressable>
          ))}
        <Hint
          icon="time-outline"
          text="Times shift with loading. Confirm at the terminal."
        />
      </>
    );
  } else if (page === "Receipt") {
    title =
      trip?.status === "Completed"
        ? "Receipt"
        : trip?.status === "Cancelled"
          ? "Trip cancelled"
          : "Trip details";
    subtitle = `Salamat ha pagsakay, ${data.user.name.split(" ")[0]}.`;
    back = "Trips";
    content = trip ? (
      <>
        <Ticket
          serial={tripRef(trip.id).replace("#", "")}
          when={`${fullDate(trip.createdAt)} · ${stamp(trip.createdAt)}${trip.timestamps.Completed ? `–${stamp(trip.timestamps.Completed)}` : ""}`}
          stamp={trip.status === "Completed" ? "Paid in cash" : trip.status === "Cancelled" ? "Cancelled" : undefined}
        >
          <Text style={[ps.total, { fontSize: 56, lineHeight: 58 }]}>
            {money(trip.status === "Completed" ? trip.fare : 0)}
          </Text>
          <RouteBoard from={trip.pickup} to={trip.destination} compact />
          <SummaryRow label="Ride" value={`${trip.distance} km · ${trip.minutes} min`} />
          {trip.driver ? (
            <SummaryRow label="Driver" value={`${trip.driver} · ${trip.plate || "—"}`} />
          ) : null}
          <SummaryRow label="Fare source" value="City fare matrix" />
        </Ticket>
        {trip.status === "Completed" && (
          <RateTrip
            rating={trip.rating}
            driver={trip.driver}
            disabled={locked}
            onRate={(rating) => action(`/trips/${trip.id}/rating`, { rating })}
          />
        )}
        <Pressable accessibilityRole="button" onPress={() => go("Support", trip.id)} hitSlop={8}>
          <Text style={ps.textLink}>Report a problem with this ride</Text>
        </Pressable>
      </>
    ) : (
      <Hint text="No receipt found. Open a trip from your history." />
    );
    footer = (
      <View style={ps.row}>
        {trip?.status === "Completed" && (
          <View style={{ flex: 1 }}>
            <Action
              title="Share receipt"
              icon="share-outline"
              light
              disabled={locked}
              onPress={() => share(true)}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Action title="Done" onPress={() => go("Home")} />
        </View>
      </View>
    );
  } else if (page === "Profile") {
    title = "Account";
    subtitle = data.user.phone || data.user.email;
    content = (
      <PassengerProfileScreen
        data={data}
        busy={locked}
        onEdit={() => go("Edit profile")}
        onTrips={() => go("Trips")}
        onNotifications={() => go("Notifications")}
        onSupport={() => go("Support")}
        onSignOut={() => {
          void logout();
        }}
        onDeleteAccount={() =>
          confirmAccountDeletion(() => {
            void perform(async () => {
              if (await action("/account/delete", {})) {
                await logout();
              }
            });
          })
        }
      />
    );
  } else if (page === "Trips") {
    title = "Trips";
    subtitle = `${data.trips.length} ${data.trips.length === 1 ? "trip" : "trips"}`;
    content = (
      <PassengerTripsScreen
        trips={data.trips}
        onBook={() => go("Journey")}
        onOpen={(trip) =>
          go(
            trip.serviceType === "PUJ/PUV" && trip.status === "Expired"
              ? "PUJ arrived"
              : trip.status === "Expired" || trip.status === "Requested"
              ? "Ride accepted"
              : ["Completed", "Cancelled"].includes(trip.status)
                ? trip.serviceType === "PUJ/PUV" && trip.status === "Completed"
                  ? "PUJ complete"
                  : "Receipt"
                : trip.serviceType === "PUJ/PUV"
                  ? "PUJ arrived"
                  : trip.status === "Arrived"
                    ? "Arrived"
                    : "Track ride",
            trip.id,
          )
        }
      />
    );
  } else if (page === "Edit profile") {
    title = "Edit passenger profile";
    subtitle = "";
    back = "Profile";
    content = (
      <>
        <Text style={ps.label}>Full name</Text>
        <TextInput
          accessibilityLabel="Full name"
          style={ps.input}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
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
        <Text style={ps.small}>{data.user.email}</Text>
        <Action
          title="Save profile"
          disabled={locked || !name.trim() || (!!phone.trim() && !isPhMobile(phone))}
          onPress={() => {
            void perform(async () => {
              if (await action("/profile", { name: name.trim(), phone: normalizePhMobile(phone) }, "PATCH")) {
                go("Profile");
              }
            });
          }}
        />
        <Action
          title="Sign out"
          light
          disabled={locked}
          onPress={() => {
            void logout();
          }}
        />
      </>
    );
  } else if (page === "Notifications") {
    title = "Updates";
    subtitle = unread ? `${unread} new` : "";
    back = "Profile";
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
        <View style={[ps.card, { paddingVertical: 2, gap: 0 }]}>
        {data.notifications.map((item, index) => (
          <View
            key={item.id}
            style={[
              { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 14 },
              index > 0 && { borderTopWidth: 1, borderTopColor: c.line },
            ]}
            accessibilityLabel={`${item.read ? "" : "Unread. "}${item.message}`}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 7,
                backgroundColor: item.read ? "transparent" : c.amber,
              }}
            />
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={[
                  ps.body,
                  !item.read && { fontWeight: "600", color: c.ink },
                ]}
              >
                {item.message}
              </Text>
              <Text style={ps.tiny}>
                {fullDate(item.createdAt)} · {stamp(item.createdAt)}
              </Text>
            </View>
          </View>
        ))}
        </View>
        {!data.notifications.length && (
          <Text style={ps.body}>Nothing new.</Text>
        )}
      </>
    );
  } else {
    title = "Help";
    subtitle = "";
    back = "Profile";
    content = (
      <>
        {params.trip ? <Text style={ps.small}>About trip {tripRef(params.trip)}</Text> : null}
        <Text style={ps.label}>Tell us what happened</Text>
        <TextInput
          accessibilityLabel="Support report details"
          style={[ps.input, { minHeight: 130, textAlignVertical: "top" }]}
          value={report}
          onChangeText={setReport}
          multiline
          maxLength={2000}
          placeholder="What went wrong?"
          placeholderTextColor={c.muted}
        />
        <Action
          title="Send to the transport office"
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
        {data.reports.map((item) => (
          <View style={ps.card} key={item.id}>
            <Tag text={statusLabel(item.status)} />
            <Text style={ps.body}>{item.details}</Text>
            <Text style={ps.tiny}>{fullDate(item.createdAt)}</Text>
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
        setError("");
        router.setParams({ screen: back, trip: params.trip || "" });
        return true;
      },
    );
    return () => subscription.remove();
  }, [back, params.trip]);
  return (
    <View style={ps.app}>
      {live && hero ? (
        <View
          style={{ flex: 1, minHeight: 220 }}
          onLayout={(event) => {
            const next = Math.round(event.nativeEvent.layout.height);
            if (Math.abs(next - heroHeight) > 1) {
              setHeroHeight(next);
            }
          }}
        >
          {hero}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Minimize ride, go to Home"
            onPress={() => go("Home")}
            style={ps.mapButton}
          >
            <Icon name="chevron-down" size={24} color={c.ink} />
          </Pressable>
        </View>
      ) : null}
      <View style={live && hero ? ps.sheetHeader : ps.header}>
        {live && hero ? <View style={ps.grabber} /> : null}
        {back && !(live && hero) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => go(back!, params.trip)}
            style={ps.iconButton}
          >
            <Icon name="arrow-back" size={22} color={c.ink} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={ps.heading}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={ps.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {!back && !live && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread ? `Notifications, ${unread} unread` : "Notifications"}
            style={ps.iconButton}
            onPress={() => go("Notifications")}
          >
            <Glyph name="bell" size={22} />
            {unread > 0 && <View style={ps.unreadDot} />}
          </Pressable>
        )}
      </View>
      <ScrollView
        ref={scroll}
        style={live && hero ? { flexGrow: 0, flexShrink: 1 } : ps.scroll}
        contentContainerStyle={[ps.content, live && hero ? { flexGrow: 0 } : null]}
        keyboardShouldPersistTaps="handled"
      >
        {!connected && (
          <Hint text="Connection lost. Showing your last synced trip. Keep the app open to reconnect." />
        )}
        {Boolean(error) && <Hint text={error} />}
        {Boolean(notice) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
            onPress={dismissNotice}
          >
            <Hint info text={`${notice}  ×`} />
          </Pressable>
        )}
        {content}
      </ScrollView>
      {footer && (
        <View style={ps.footer}>
          {footer}
          {disclaimer ? <Text style={ps.disclaimer}>{disclaimer}</Text> : null}
        </View>
      )}
      {tabPages.includes(page) && (
        <View style={[ps.nav, { marginBottom: navLift }]}>
          {[
            { label: "Home", text: "Home", icon: "home" as GlyphName },
            { label: "Routes", text: "Routes", icon: "routes" as GlyphName },
            { label: "Trips", text: "Trips", icon: "ticket" as GlyphName },
            { label: "Profile", text: "Account", icon: "account" as GlyphName },
          ].map((tab) => {
            const selected =
              page === tab.label ||
              (page === "Terminals" && tab.label === "Routes");
            return (
              <Pressable
                key={tab.label}
                accessibilityRole="tab"
                accessibilityLabel={tab.text}
                accessibilityState={{ selected }}
                onPress={() => go(tab.label)}
                style={({ pressed }) => [
                  ps.navItem,
                  selected && ps.navSelected,
                  pressed && ps.pressed,
                ]}
              >
                <Glyph name={tab.icon} size={24} color={selected ? "#FFFFFF" : "#8E928E"} />
                <Text style={[ps.navLabel, selected && { color: "#FFFFFF" }]}>
                  {tab.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}