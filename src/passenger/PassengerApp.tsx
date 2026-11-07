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
import { Share, Linking } from "../services/previewActions";
import { api } from "../services/api";
import type { Point, Quote, Snapshot, Trip } from "../types/types";
import CalbayogMap from "../map/CalbayogMap";
import { Icon, money } from "../common/ui";
import { ps, passengerColors as c } from "./passengerStyles";
import DriverAvatar from "../common/DriverAvatar";
import { Skeleton, CardSkeleton, ListSkeleton } from "../common/Skeleton";

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
      {icon && <Icon name={icon} size={19} color={light ? c.green : "white"} />}
      <Text style={[ps.buttonText, light && { color: c.green }]}>{title}</Text>
    </Pressable>
  );
}
function Tag({ text, icon }: { text: string; icon?: IconName }) {
  return (
    <View style={ps.pill}>
      {icon && <Icon name={icon} size={12} />}
      <Text style={ps.pillText}>{text}</Text>
    </View>
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
      <Icon name={icon} size={18} color={info ? c.green : "#B37D2C"} />
      <Text style={[ps.hintText, info && { color: c.green }]}>{text}</Text>
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
          style={card ? ps.row : ps.location}
        >
          <View style={[ps.dot, item.orange && ps.square]} />
          <View style={{ flex: 1 }}>
            <Text style={ps.locationCaption}>{item.label}</Text>
            <Text style={ps.label}>{item.value}</Text>
          </View>
          {item.onPress && (
            <Icon name="chevron-forward" size={19} color="#90A59A" />
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
function nextDeparture(route: Snapshot["routes"][number], now: number) {
  if (
    route.scheduled === false ||
    !route.interval ||
    !route.startsAt ||
    !route.endsAt
  ) {
    return "No fixed schedule";
  }
  const clock = new Date(now).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Manila",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const minutes = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return h * 60 + m;
  };
  const start = minutes(route.startsAt),
    end = minutes(route.endsAt),
    current = minutes(clock);
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
function tripText(trip: Trip) {
  return `Angkol · ${trip.id}\n${trip.status}\n${trip.pickup} → ${trip.destination}\nDriver: ${trip.driver || "Awaiting assignment"}${trip.plate ? ` · ${trip.plate}` : ""}\n${trip.demoPayment ? `${trip.demoPayment.method} TEST ONLY — no money charged; actual fare remains payable. Demo reference: ${trip.demoPayment.reference}\nFare` : "Fixed cash fare"}: ${money(trip.fare)}${trip.sampleFare ? " (sample fare)" : ""}\n${fullDate(trip.createdAt)} · ${stamp(trip.createdAt)}`;
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
  const navLift = insets.bottom > 0 ? Math.max(insets.bottom - 8, 0) : 0;
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
    "Receipt",
    "Routes",
    "Terminals",
    "Trips",
    "Profile",
    "Edit profile",
    "Support",
    "Notifications",
  ];
  const requested = aliases[params.screen || ""] || params.screen || "Home";
  const page = validPages.includes(requested) ? requested : "Home";
  const [pickup, setPickup] = useState<Point | null>(data.landmarks[0] || null),
    [destination, setDestination] = useState<Point | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null),
    [pickupNote, setPickupNote] = useState("");
  const [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [gpsAt, setGpsAt] = useState<number | null>(null);
  const [editing, setEditing] = useState<"pickup" | "destination">(
      "destination",
    ),
    [search, setSearch] = useState(""),
    [results, setResults] = useState<Point[]>([]);
  const [routeId, setRouteId] = useState<string | null>(null),
    [terminalId, setTerminalId] = useState<string | null>(null);
  const [name, setName] = useState(data.user.name),
    [phone, setPhone] = useState(data.user.phone),
    [report, setReport] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const submitting = useRef(false),
    scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    previousStatuses = useRef(new Map(data.trips.map((t) => [t.id, t.status])));
  const active = data.trips.find(
    (t) => !["Completed", "Cancelled"].includes(t.status),
  );
  const trip =
    data.trips.find((t) => t.id === params.trip) || active || data.trips[0];
  const vehicle = data.vehicles.find((v) => v.id === trip?.driverId);
  const routes = data.routes.filter((r) => r.active),
    terminals = data.terminals.filter((t) => t.active);
  const selectedRoute =
    routes.find((route) => route.id === routeId) || routes[0];
  const terminal = terminals.find((t) => t.id === terminalId) || terminals[0];
  const locked = working || busy;
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
          router.setParams({ screen: "Receipt", trip: value.id });
        } else if (value.status === "In progress") {
          router.setParams({ screen: "Track ride", trip: value.id });
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
      setPickup(data.landmarks[0] || null);
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
        ...(paymentMethod !== "Cash" ? { demoMethod: paymentMethod } : {}),
      });
      setQuote(null);
      await refresh();
      go("Ride accepted", created.id);
    });
  const cancel = () => {
    if (!trip || !["Requested", "Accepted"].includes(trip.status)) {
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
              ? "Driver location"
              : undefined
        }
        destinationLabel={approaching ? "Your pickup location" : undefined}
        pickup={
          (approaching
            ? vehicle?.location || selectedTrip.pickupPoint
            : selectedTrip?.pickupPoint) ||
          (journey === "route"
            ? selectedRoute?.stops[0]
            : journey === "terminal"
              ? terminal?.point
              : pickup)
        }
        destination={
          (approaching
            ? selectedTrip.pickupPoint
            : selectedTrip?.destinationPoint) ||
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
            ? data.vehicles.filter((v) => v.id === trip?.driverId)
            : data.vehicles
        }
        terminals={journey === "terminal" ? terminals : []}
        landmarks={[]}
        mode={journey === "select" ? editing : null}
        onSelect={choosePoint}
      />
    );
  }
  const disclaimer = data.sampleMode
    ? "Sample fares only · not an official LGU tariff"
    : "Cash payments go directly to your driver";
  const tabPages = ["Home", "Routes", "Terminals", "Trips", "Profile"];
  const cityHour = Number(
    new Date(data.serverTime).toLocaleTimeString("en-GB", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      hourCycle: "h23",
    }),
  );
  const greeting =
    cityHour >= 5 && cityHour < 12
      ? "MAUPAY NGA AGA"
      : cityHour >= 12 && cityHour < 18
        ? "MAUPAY NGA KULOP"
        : "MAUPAY NGA GAB-I";
  let title = "Where to today?",
    subtitle = `${greeting}, ${data.user.name.split(" ")[0].toUpperCase()}`,
    back: string | null = null;
  let content: React.ReactNode,
    footer: React.ReactNode = null;
  function receiptDetails(value: Trip | Quote) {
    return (
      <View style={ps.card}>
        <Locations pickup={value.pickup} destination={value.destination} />
        <View style={ps.divider} />
        <SummaryRow
          label="Distance & ride time"
          value={`${value.distance} km · about ${value.minutes} min`}
          strong
        />
        {"driver" in value && (
          <SummaryRow
            label="Driver & vehicle"
            value={`${value.driver || "—"} · ${value.plate || "—"}`}
            strong
          />
        )}
        {pickupNote && !("passengerId" in value) ? (
          <Text style={ps.small}>Pickup note: {pickupNote}</Text>
        ) : null}
        {"pickupNote" in value && value.pickupNote ? (
          <Text style={ps.small}>Pickup note: {value.pickupNote}</Text>
        ) : null}
      </View>
    );
  }
  function fares(value: Trip | Quote) {
    const demo = "demoPayment" in value ? value.demoPayment : undefined;
    return (
      <View style={ps.card}>
        <Text style={ps.section}>Upfront fare</Text>
        <SummaryRow
          label={`Fixed ride fare${value.sampleFare ? " (sample)" : ""}`}
          value={money(value.fare)}
          strong
        />
        <SummaryRow label="Booking fee" value={money(0)} />
        <View style={ps.divider} />
        <View style={ps.between}>
          <Text style={ps.body}>Total fare</Text>
          <Text style={ps.total}>{money(value.fare)}</Text>
        </View>
        <View style={ps.row}>
          <Icon name="cash-outline" size={16} />
          <Text style={[ps.small, { color: c.green }]}>
            {demo
              ? `${demo.method} · Test succeeded — no money charged`
              : "Cash to driver"}
          </Text>
        </View>
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
    title = "Your next journey";
    subtitle = "Calbayog City, Samar";
    content = (
      <PassengerHomeScreen
        data={data}
        active={active}
        onBook={() => go("Journey")}
        onRoutes={() => go("Routes")}
        onTerminals={() => go("Terminals")}
        onTrack={() => go("Track ride", active?.id)}
        onDestination={(point) => {
          setDestination(point);
          setQuote(null);
          go("Journey");
        }}
      />
    );
  } else if (page === "Journey") {
    title = "Set your journey";
    subtitle = "Choose a place or pinpoint it on the map";
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
          title={working ? "Getting your location…" : "Use my current location"}
          icon="locate-outline"
          light
          disabled={locked}
          onPress={gps}
        />
        {map(240, "select")}
        <View style={ps.tabRow}>
          {(["pickup", "destination"] as const).map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              onPress={() => setEditing(kind)}
              style={[
                ps.pill,
                editing !== kind && { backgroundColor: "#E9EFEB" },
              ]}
            >
              <Text style={ps.pillText}>Tap map to set {kind}</Text>
            </Pressable>
          ))}
        </View>
        <View>
          <Text style={ps.section}>
            Meet at {pickup?.name || "your pickup"}
          </Text>
          <Text style={ps.body}>
            Calbayog City, Samar · Choose a safe roadside pickup.
          </Text>
        </View>
        <View style={ps.row}>
          <Icon name="chatbox-outline" size={18} />
          <TextInput
            accessibilityLabel="Pickup note"
            placeholder="Pickup note: by the park entrance"
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
    subtitle = "Search Calbayog or choose a landmark";
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
        : "Check your trip before sending a request";
    back = page === "Choose ride" ? "Journey" : "Choose ride";
    if (!quote) {
      content = (
        <Hint text="Your fare quote is no longer available. Confirm your locations to get a fresh quote." />
      );
      footer = <Action title="Back to journey" onPress={() => go("Journey")} />;
    } else if (page === "Choose ride") {
      content = (
        <>
          {map(170, "quote")}
          <View style={[ps.card, ps.selected]}>
            <View style={ps.row}>
              <View style={[ps.iconButton, { backgroundColor: c.green }]}>
                <Icon name="bicycle-outline" size={26} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ps.label}>Regular tricycle</Text>
                <Text style={ps.tiny}>Direct ride · registered driver</Text>
              </View>
              <Text style={ps.fare}>{money(quote.fare)}</Text>
            </View>
            <View style={ps.between}>
              <Tag text="Selected · fixed total" />
              <Text style={ps.tiny}>Driver assigned after confirmation</Text>
            </View>
          </View>
          <View style={[ps.card, { opacity: 0.65 }]}>
            <View style={ps.row}>
              <Icon name="person-outline" size={25} />
              <View style={{ flex: 1 }}>
                <Text style={ps.label}>Solo tricycle</Text>
                <Text style={ps.tiny}>Separate service not configured</Text>
              </View>
              <Text style={ps.small}>Unavailable</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => go("Routes")}
            style={ps.card}
          >
            <View style={ps.row}>
              <Icon name="bus-outline" size={25} />
              <View style={{ flex: 1 }}>
                <Text style={ps.label}>Jeepney / PUV</Text>
                <Text style={ps.tiny}>Shared route · check departures</Text>
              </View>
              <Text style={ps.fare}>
                {routes.length
                  ? `From ${money(Math.min(...routes.map((r) => r.fare)))}`
                  : "—"}
              </Text>
            </View>
            <Tag text="Per passenger" />
          </Pressable>
          <Hint
            info
            text={
              quote.sampleFare
                ? "Fixed fares use sample transport tables. These amounts are illustrative, not official tariffs."
                : `Configured fare reference: ${quote.fareReference}`
            }
          />
        </>
      );
      footer = (
        <Action
          title={`Continue with Regular · ${money(quote.fare)}`}
          onPress={() => go("Review ride")}
        />
      );
    } else {
      content = (
        <>
          <View style={ps.between}>
            <Text style={ps.section}>Regular tricycle</Text>
            <Tag text="1 booking" />
          </View>
          {receiptDetails(quote)}
          {fares(quote)}
          <View style={ps.card}>
            <Text style={ps.section}>Payment method</Text>
            <Text style={ps.small}>
              Electronic options are demos only. No account details, PIN, or OTP
              are needed.
            </Text>
            {["Cash", "GCash", "Maya", "Bank transfer"].map((method) => (
              <Pressable
                key={method}
                accessibilityRole="radio"
                accessibilityState={{ checked: paymentMethod === method }}
                disabled={locked}
                onPress={() => setPaymentMethod(method)}
                style={[ps.card, paymentMethod === method && ps.selected]}
              >
                <View style={ps.between}>
                  <Text style={ps.label}>
                    {method === "Cash"
                      ? "Cash to driver"
                      : `${method} · Test payment`}
                  </Text>
                  <Icon
                    name={
                      paymentMethod === method
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={20}
                  />
                </View>
              </Pressable>
            ))}
            {paymentMethod !== "Cash" && (
              <Hint
                text={`Test payment — no money charged. Confirming simulates a successful ${paymentMethod} payment and requests a ride. The actual fare remains payable to your driver.`}
              />
            )}
          </View>
          <Hint
            info
            icon="shield-checkmark-outline"
            text="A verified driver will be assigned after you confirm. Their name, license approval, and vehicle details appear next."
          />
          <View style={{ flex: 1 }} />
          <Text style={ps.small}>
            Confirming creates one unique ride request. Your fixed fare is saved
            with the booking.
          </Text>
        </>
      );
      footer = (
        <Action
          title={
            working
              ? "Sending your request…"
              : paymentMethod === "Cash"
                ? `Confirm ride request · ${money(quote.fare)}`
                : `Simulate ${paymentMethod} & request ride · ${money(quote.fare)}`
          }
          icon="checkmark-circle-outline"
          disabled={locked}
          onPress={confirm}
        />
      );
    }
  } else if (page === "Ride accepted" || page === "Track ride") {
    back = "Home";
    subtitle = trip
      ? `${trip.id.slice(0, 20)} · ${trip.status}`
      : "Your current ride";
    title =
      trip?.status === "Cancelled"
        ? "Ride cancelled"
        : trip?.status === "Arrived"
          ? "Your driver has arrived"
          : page === "Ride accepted"
            ? trip?.driver
              ? "Your ride is accepted"
              : "Finding your driver"
            : trip?.status === "In progress"
              ? "On your way"
              : "Track your ride";
    if (!trip) {
      content = (
        <Hint text="You have no active ride. Choose a destination to start a new journey." />
      );
      footer = <Action title="Back to Home" onPress={() => go("Home")} />;
    } else {
      const statuses = [
        "Requested",
        "Accepted",
        "Arrived",
        "In progress",
        "Completed",
      ] as const;
      const driverName = trip.driver?.split(" ")[0];
      content = (
        <>
          {page === "Ride accepted" && (
            <>
              <View style={ps.banner}>
                <View style={ps.between}>
                  <Text style={[ps.bannerTitle, { flex: 1 }]}>
                    {trip.status === "Cancelled"
                      ? "This request was cancelled"
                      : trip.status === "Arrived"
                        ? `${driverName || "Your driver"} has arrived`
                        : driverName
                          ? `${driverName} is on the way`
                          : "Looking for an available driver"}
                  </Text>
                  <View style={ps.check}>
                    <Icon
                      name={driverName ? "checkmark" : "time-outline"}
                      size={25}
                    />
                  </View>
                </View>
                <Text style={ps.bannerSub}>
                  {trip.status === "Cancelled"
                    ? "You can start a new booking from Home."
                    : trip.status === "Arrived"
                      ? "Meet your driver at the pickup point. Check the vehicle plate before boarding."
                      : driverName
                        ? "Your driver has accepted. Watch the map for location updates."
                        : "Your request was sent to the nearest eligible driver. Keep the app open for updates."}
                </Text>
              </View>
              <View style={ps.card}>
                {statuses.slice(0, 3).map((status, i) => (
                  <View key={status} style={ps.step}>
                    <View
                      style={[
                        ps.stepMark,
                        !trip.timestamps[status] && {
                          backgroundColor: "#EDF1EE",
                        },
                      ]}
                    >
                      <Icon
                        name={
                          trip.timestamps[status]
                            ? "checkmark"
                            : "ellipse-outline"
                        }
                        size={18}
                        color={trip.timestamps[status] ? c.green : "#9AA99F"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ps.label}>
                        {
                          [
                            "Request sent",
                            "Driver accepted your ride",
                            "Driver arrived at pickup",
                          ][i]
                        }
                      </Text>
                      <Text style={ps.tiny}>
                        {trip.timestamps[status]
                          ? `${stamp(trip.timestamps[status]!)} · ${status}`
                          : "Waiting for update"}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
          {page === "Track ride" && (
            <>
              <View>
                {map(310, "trip")}
                <View style={ps.topMapBadge}>
                  <Icon name="git-network-outline" size={14} />
                  <Text style={[ps.small, { color: c.green }]}>
                    {trip.status}{" "}
                    {trip.timestamps[trip.status]
                      ? `· ${stamp(trip.timestamps[trip.status]!)}`
                      : ""}
                  </Text>
                </View>
              </View>
              {vehicle?.stale ? (
                <Hint
                  icon="eye-off-outline"
                  text={`Driver location is stale · last update ${stamp(vehicle.location.updatedAt)}. Showing the last known position; arrival time may change.`}
                />
              ) : vehicle ? (
                <Hint
                  info
                  icon="navigate-outline"
                  text={`Driver GPS updated ${stamp(vehicle.location.updatedAt)}. Road time is an estimate, not a live traffic ETA.`}
                />
              ) : (
                <Hint text="The driver’s live location is not available yet. Your trip status will update automatically." />
              )}
              <View style={ps.between}>
                <View style={{ flex: 1 }}>
                  <Text style={ps.locationCaption}>To {trip.destination}</Text>
                  <Text style={ps.section}>
                    About {trip.minutes} min riding
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={ps.locationCaption}>Cash fare</Text>
                  <Text style={ps.fare}>{money(trip.fare)}</Text>
                </View>
              </View>
            </>
          )}
          {trip.driver && (
            <View style={ps.card}>
              <View style={ps.row}>
                <DriverAvatar
                  photo={trip.driverPhoto}
                  name={trip.driver}
                  size={68}
                />
                <View style={{ flex: 1 }}>
                  <Text style={ps.section}>{trip.driver}</Text>
                  <Text style={ps.small}>Administrator-approved driver</Text>
                </View>
                <Icon name="shield-checkmark-outline" size={24} />
              </View>
              <Tag icon="checkmark" text="Driver approval recorded" />
              <Text style={ps.small}>
                {trip.driverPhoto
                  ? "Driver-uploaded photo. Match the person and plate before boarding."
                  : "Driver photo not provided. Confirm the driver’s name and plate before boarding."}
              </Text>
              <View style={[ps.location, { paddingVertical: 10 }]}>
                <Icon name="bicycle-outline" size={25} />
                <View style={{ flex: 1 }}>
                  <Text style={ps.label}>Registered tricycle</Text>
                  <Text style={ps.small}>
                    {trip.plate || "Check the plate with your driver"}
                  </Text>
                </View>
              </View>
              {trip.driverAssociation ? (
                <Text style={ps.small}>
                  {trip.driverAssociation} · Check the plate number before
                  boarding.
                </Text>
              ) : null}
              <View style={ps.row}>
                <View style={{ flex: 1 }}>
                  <Action
                    title="Support"
                    light
                    icon="chatbubble-outline"
                    onPress={() => go("Support", trip.id)}
                  />
                </View>
                {Boolean(trip.driverPhone?.replace(/[^\d+]/g, "")) && (
                  <View style={{ flex: 1 }}>
                    <Action
                      title="Call driver"
                      icon="call-outline"
                      onPress={() => {
                        void perform(async () => {
                          await Linking.openURL(
                            `tel:${trip.driverPhone!.replace(/[^\d+]/g, "")}`,
                          );
                        });
                      }}
                    />
                  </View>
                )}
              </View>
            </View>
          )}
          {page === "Ride accepted" && (
            <SummaryRow
              label="Confirmed cash fare"
              value={money(trip.fare)}
              strong
            />
          )}
          {page === "Track ride" && gpsAt && (
            <Hint
              info
              icon="navigate-outline"
              text={`Your phone GPS was last checked ${stamp(gpsAt)}.`}
            />
          )}
          {trip.status === "Cancelled" && (
            <Hint text="This ride was cancelled. You can start a new booking from Home." />
          )}
          {trip.status === "Completed" && (
            <Action
              title="View your receipt"
              onPress={() => go("Receipt", trip.id)}
            />
          )}
        </>
      );
      footer = (
        <>
          {page === "Ride accepted" ? (
            <Action
              title="Track my ride"
              icon="navigate-outline"
              onPress={() => go("Track ride", trip.id)}
            />
          ) : (
            <Action
              title="Share trip status"
              icon="share-social-outline"
              light
              disabled={locked}
              onPress={() => share()}
            />
          )}
          {["Requested", "Accepted"].includes(trip.status) && (
            <Pressable
              accessibilityRole="button"
              disabled={locked}
              onPress={cancel}
            >
              <Text style={ps.textLink}>
                Need to change plans? Cancel request
              </Text>
            </Pressable>
          )}
        </>
      );
    }
  } else if (page === "Routes") {
    title = "Routes near you";
    subtitle = "Your connection to the city";
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
          void perform(async () => {
            await action("/stop", {
              routeId: route.id,
              point: pickup || data.landmarks[0],
            });
          });
        }}
      />
    );
  } else if (page === "Terminals") {
    title = "Nearby terminals";
    subtitle = "Calbayog City · estimated departures";
    content = (
      <>
        {map(160, "terminal")}
        {terminals.map((item) => {
          const route = routes.find((r) => r.id === item.routeId);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => setTerminalId(item.id)}
              style={[ps.card, terminal?.id === item.id && ps.selected]}
            >
              <View style={ps.row}>
                <Icon name="business-outline" size={24} />
                <View style={{ flex: 1 }}>
                  <Text style={ps.label}>{item.name}</Text>
                  <Text style={ps.small}>
                    {route?.name || "Route not active"}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} />
              </View>
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
                      title="Directions ↗"
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
            </Pressable>
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
                  {nextDeparture(route, data.serverTime)}
                </Text>
                <Text style={ps.tiny}>ESTIMATED</Text>
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
          text="Estimated, not guaranteed. Departure may shift with loading; confirm at the terminal."
        />
      </>
    );
  } else if (page === "Receipt") {
    title =
      trip?.status === "Completed"
        ? "You’ve arrived!"
        : trip?.status === "Cancelled"
          ? "Trip cancelled"
          : "Trip details";
    subtitle = `Salamat sa pagsakay, ${data.user.name.split(" ")[0]}.`;
    back = "Trips";
    content = trip ? (
      <>
        <View style={ps.banner}>
          <View style={ps.between}>
            <Text style={[ps.section, { color: "white", flex: 1 }]}>
              {trip.status === "Completed" ? "Trip completed" : trip.status}
            </Text>
            <View style={ps.check}>
              <Icon
                name={trip.status === "Completed" ? "checkmark" : "close"}
                size={26}
              />
            </View>
          </View>
          <Text style={ps.bannerSub}>
            {fullDate(trip.createdAt)} · {stamp(trip.createdAt)}
            {trip.timestamps.Completed
              ? `–${stamp(trip.timestamps.Completed)}`
              : ""}
          </Text>
          <Text style={ps.bannerSub}>Trip ID: {trip.id}</Text>
        </View>
        {receiptDetails(trip)}
        {trip.status === "Completed" && (
          <>
            {fares(trip)}
            <Text style={[ps.label, { textAlign: "center" }]}>
              How was your ride
              {trip.driver ? ` with ${trip.driver.split(" ")[0]}` : ""}?
            </Text>
            <View style={[ps.row, { justifyContent: "space-around" }]}>
              {[1, 2, 3, 4, 5].map((rating) => (
                <Pressable
                  key={rating}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${rating} out of 5`}
                  accessibilityState={{
                    selected: trip.rating === rating,
                    disabled: locked,
                  }}
                  disabled={locked}
                  onPress={() => {
                    void action(`/trips/${trip.id}/rating`, { rating });
                  }}
                  style={ps.star}
                >
                  <Icon
                    name={
                      trip.rating && rating <= trip.rating
                        ? "star"
                        : "star-outline"
                    }
                    size={27}
                    color={c.amber}
                  />
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => go("Support", trip.id)}
        >
          <Text style={ps.textLink}>Need help with this trip?</Text>
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
              title="Save receipt"
              icon="download-outline"
              light
              disabled={locked}
              onPress={() => share(true)}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Action title="Back to Home" onPress={() => go("Home")} />
        </View>
      </View>
    );
  } else if (page === "Profile") {
    title = "Your account";
    subtitle = "Make every journey feel like yours";
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
      />
    );
  } else if (page === "Trips") {
    title = "Your trips";
    subtitle = "Every local journey, in one place";
    content = (
      <PassengerTripsScreen
        trips={data.trips}
        onBook={() => go("Journey")}
        onOpen={(trip) =>
          go(
            ["Completed", "Cancelled"].includes(trip.status)
              ? "Receipt"
              : "Track ride",
            trip.id,
          )
        }
      />
    );
  } else if (page === "Edit profile") {
    title = "Edit passenger profile";
    subtitle = "Keep your contact details up to date";
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
        <Text style={ps.small}>{data.user.email}</Text>
        <Action
          title="Save profile"
          disabled={locked || !name.trim()}
          onPress={() => {
            void perform(async () => {
              if (await action("/profile", { name, phone }, "PATCH")) {
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
    title = "Your notifications";
    subtitle = "Updates about your rides and account";
    back = "Profile";
    content = (
      <>
        <Action
          title="Mark all as read"
          light
          disabled={locked}
          onPress={() => {
            void action("/notifications/read", {});
          }}
        />
        {data.notifications.map((item) => (
          <View key={item.id} style={ps.card}>
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
        ))}
        {!data.notifications.length && (
          <Text style={ps.body}>You’re all caught up.</Text>
        )}
      </>
    );
  } else {
    title = "Passenger support";
    subtitle = "Privacy, safety and help with a journey";
    back = "Profile";
    content = (
      <>
        <Hint
          info
          icon="shield-checkmark-outline"
          text="Location access is optional. Driver positions are shown only when available, and stale positions are labeled. Share trip status only with people you choose."
        />
        {params.trip ? <Text style={ps.small}>Trip: {params.trip}</Text> : null}
        <Text style={ps.label}>Tell us what happened</Text>
        <TextInput
          accessibilityLabel="Support report details"
          style={[ps.input, { minHeight: 130, textAlignVertical: "top" }]}
          value={report}
          onChangeText={setReport}
          multiline
          maxLength={2000}
          placeholder="Describe the issue so the transport administrator can help…"
          placeholderTextColor={c.muted}
        />
        <Action
          title="Send report to administrator"
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
            <Tag text={item.status} />
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
      <View style={ps.header}>
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => go(back!, params.trip)}
            style={ps.iconButton}
          >
            <Icon name="arrow-back" size={26} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={ps.heading}>
            {title}
          </Text>
          <Text style={ps.subtitle}>{subtitle}</Text>
        </View>
        {!back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            style={ps.iconButton}
            onPress={() => go("Notifications")}
          >
            <Icon name="notifications-outline" size={22} />
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
          <Text style={ps.disclaimer}>{disclaimer}</Text>
        </View>
      )}
      {tabPages.includes(page) && (
        <View style={[ps.nav, { marginBottom: navLift }]}>
          {[
            { label: "Home", icon: "home-outline" as IconName },
            { label: "Routes", icon: "navigate-outline" as IconName },
            { label: "Trips", icon: "time-outline" as IconName },
            { label: "Profile", icon: "person-outline" as IconName },
          ].map((tab) => {
            const selected =
              page === tab.label ||
              (page === "Terminals" && tab.label === "Routes");
            return (
              <Pressable
                key={tab.label}
                accessibilityRole="tab"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected }}
                onPress={() => go(tab.label)}
                style={({ pressed }) => [
                  ps.navItem,
                  selected && ps.navSelected,
                  pressed && ps.pressed,
                ]}
              >
                <Icon
                  name={tab.icon}
                  size={25}
                  color={selected ? c.green : "#71877A"}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
