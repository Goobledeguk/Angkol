import React, { useRef, useState } from "react";
import { View, Text, Switch } from "react-native";
import { Snapshot, Point, Route, Terminal } from "../types/types";
import { Card, Field, Button, Choice, Heading, Badge } from "../common/ui";
import CalbayogMap from "../map/CalbayogMap";
import { s } from "../common/styles";
export default function AdminPanel({
  data,
  busy,
  action,
  section = "all",
  initialRoute,
}: {
  data: Snapshot;
  busy: boolean;
  action: (
    endpoint: string,
    input: unknown,
    method?: string,
  ) => Promise<boolean>;
  section?: "all" | "routes" | "terminals" | "fares";
  initialRoute?: Route;
}) {
  const [base, setBase] = useState(
      data.fareReference !== "Not configured" ? String(data.baseFare) : "",
    ),
    [rate, setRate] = useState(
      data.fareReference !== "Not configured" ? String(data.perKm) : "",
    ),
    [reference, setReference] = useState(
      data.fareReference === "Not configured" ? "" : data.fareReference,
    ),
    [approved, setApproved] = useState(data.fareApproved);
  const [routeId, setRouteId] = useState<string | null>(
      initialRoute?.id || null,
    ),
    [routeName, setRouteName] = useState(initialRoute?.name || ""),
    [routeFare, setRouteFare] = useState(
      initialRoute ? String(initialRoute.fare) : "",
    ),
    [routeRef, setRouteRef] = useState(initialRoute?.reference || ""),
    [routeApproved, setRouteApproved] = useState(
      initialRoute?.approved || false,
    );
  const [terminalId, setTerminalId] = useState<string | null>(null),
    [terminalName, setTerminalName] = useState(""),
    [terminalRoute, setTerminalRoute] = useState(data.routes[0]?.id || "");
  const [selected, setSelected] = useState<Point | null>(
    initialRoute?.stops[0] || null,
  );
  const [routeError, setRouteError] = useState("");
  const [transportType, setTransportType] = useState<
    "" | "Tricycle" | "PUJ / PUV"
  >(initialRoute?.transportType || "");
  const [feedback, setFeedback] = useState("");
  const [routeDestination, setRouteDestination] = useState(
    initialRoute?.destination || "",
  );
  const saving = useRef(false);
  async function save(input: unknown, message: string) {
    if (busy || saving.current) {
      return false;
    }
    saving.current = true;
    setFeedback("");
    try {
      const ok = await action("/configure", input);
      setFeedback(
        ok
          ? message
          : "Changes could not be saved. Check the connection and try again.",
      );
      return ok;
    } catch (error) {
      setFeedback((error as Error).message);
      return false;
    } finally {
      saving.current = false;
    }
  }
  function selectTerminalPoint(point: Point) {
    setSelected(point);
  }

  function editTerminal(t: Terminal) {
    setTerminalId(t.id);
    setTerminalName(t.name);
    setTerminalRoute(t.routeId);
    setSelected(t.point);
  }
  return (
    <>
      {Boolean(feedback) && (
        <Text accessibilityRole="alert" style={s.body}>
          {feedback}
        </Text>
      )}
      {section === "all" && <Heading title="Calbayog transport management" />}
      {(section === "all" || section === "fares") && (
        <>
          <Card>
            <Text style={s.cardTitle}>Tricycle fare matrix</Text>
            <Field
              label="Base fare (first kilometer)"
              value={base}
              onChange={setBase}
              numeric
            />
            <Field
              label="Additional fare per kilometer"
              value={rate}
              onChange={setRate}
              numeric
            />
            <Field
              label="Ordinance / approval reference"
              value={reference}
              onChange={setReference}
            />
            <View style={s.rowBetween}>
              <Text style={s.label}>Approved fare matrix</Text>
              <Switch
                value={approved}
                onValueChange={setApproved}
                accessibilityLabel="Approved fare matrix"
              />
            </View>
            <Text style={s.small}>
              Turn on approval, then save to enable bookings. Turn it off and
              save to revoke approval.
            </Text>
            <Button
              title="Save fare matrix"
              disabled={busy}
              onPress={async () => {
                if (
                  !base.trim() ||
                  !rate.trim() ||
                  !Number.isFinite(+base) ||
                  !Number.isFinite(+rate) ||
                  +base < 0 ||
                  +rate < 0 ||
                  !reference.trim()
                ) {
                  setFeedback(
                    "Enter a valid base fare, additional fare (0 is allowed), and approval reference before saving.",
                  );
                  return;
                }
                await save(
                  {
                    type: "fare",
                    baseFare: +base,
                    perKm: +rate,
                    approved,
                    reference,
                  },
                  approved
                    ? "Fare matrix saved and approved."
                    : "Fare matrix saved. Approval is off.",
                );
              }}
            />
          </Card>
        </>
      )}
      {section === "all" && (
        <>
          <Heading
            title="Driver approval"
            sub="Verify licenses, vehicles, and associations before approval."
          />
          {data.users
            .filter((u) => u.role.includes("driver"))
            .map((u) => (
              <Card key={u.id}>
                <View style={s.rowBetween}>
                  <Text style={s.cardTitle}>{u.name}</Text>
                  <Badge>{u.verified ? "Approved" : "Pending"}</Badge>
                </View>
                <Text style={s.body}>
                  {u.role} · {u.email}
                </Text>
                <Text style={s.small}>
                  License: {u.license} · Plate: {u.plate} · Association:{" "}
                  {u.association} · Capacity: {u.capacity}
                </Text>
                <Button
                  title={u.verified ? "Revoke approval" : "Approve driver"}
                  secondary={u.verified}
                  disabled={busy}
                  onPress={() =>
                    action(
                      `/drivers/${u.id}`,
                      { verified: !u.verified },
                      "PATCH",
                    )
                  }
                />
                {u.role === "PUJ / PUV driver" && (
                  <View style={s.chips}>
                    {data.routes
                      .filter((r) => r.active)
                      .map((r) => (
                        <Choice
                          key={r.id}
                          label={r.name}
                          selected={u.routeId === r.id}
                          onPress={() =>
                            action(
                              `/drivers/${u.id}`,
                              { verified: u.verified, routeId: r.id },
                              "PATCH",
                            )
                          }
                        />
                      ))}
                  </View>
                )}
              </Card>
            ))}
          {!data.users.some((u) => u.role.includes("driver")) && (
            <Text style={s.body}>
              Drivers will appear after mobile registration.
            </Text>
          )}
        </>
      )}
      {section !== "fares" && (
        <>
          <Heading
            title="Terminal map point"
            sub="Select the terminal location on this map."
          />
          <CalbayogMap
            pickupLabel="Terminal"
            pickupColor="#7C3AED"
            terminalColors
            mode="pickup"
            pickup={selected}
            landmarks={data.landmarks}
            vehicles={data.vehicles}
            terminals={data.terminals.filter((t) => t.active)}
            onSelect={selectTerminalPoint}
          />
          {selected && (
            <>
              <Field
                label="Terminal point name"
                value={selected.name}
                onChange={(name) => {
                  selectTerminalPoint({ ...selected, name });
                  if (section === "terminals") {
                    setTerminalName(name);
                  }
                }}
              />
              <Text style={s.small}>
                You can rename this point before saving. The map position stays
                the same.
              </Text>
              <Text style={s.small}>
                {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
              </Text>
            </>
          )}
        </>
      )}
      {(section === "all" || section === "routes") && (
        <>
          <Card>
            <Heading title={routeId ? "Edit route" : "Add route"} />
            <Field
              label="Route name"
              value={routeName}
              onChange={setRouteName}
            />
            <Text style={s.small}>
              Terminal location:{" "}
              {selected?.name || "Select a terminal point on the map above."}
            </Text>
            <Text style={s.label}>Vehicle type</Text>
            <View style={s.chips}>
              <Choice
                label="Tricycle"
                selected={transportType === "Tricycle"}
                onPress={() => setTransportType("Tricycle")}
              />
              <Choice
                label="PUJ / PUV"
                selected={transportType === "PUJ / PUV"}
                onPress={() => setTransportType("PUJ / PUV")}
              />
            </View>
            <Field
              label="Route fare"
              value={routeFare}
              onChange={setRouteFare}
              numeric
            />
            {transportType === "PUJ / PUV" && (
              <Field
                label="PUJ/PUV destination"
                value={routeDestination}
                onChange={setRouteDestination}
              />
            )}
            <View style={s.rowBetween}>
              <Text style={s.label}>Approve route</Text>
              <Switch
                accessibilityLabel="Approved route"
                value={routeApproved}
                onValueChange={setRouteApproved}
              />
            </View>
            <Text style={s.small}>
              The approval switch is applied when you save the route.
            </Text>
            <Button
              title="Save route"
              disabled={busy}
              onPress={async () => {
                setRouteError("");
                const missing = [
                  !routeName.trim() && "route name",
                  !transportType && "vehicle type",
                  transportType === "PUJ / PUV" &&
                    !routeDestination.trim() &&
                    "PUJ/PUV destination",
                  !selected && "terminal map point",
                  (!routeFare.trim() ||
                    !Number.isFinite(Number(routeFare)) ||
                    Number(routeFare) < 0) &&
                    "valid route fare",
                ].filter(Boolean);
                if (missing.length) {
                  setRouteError(`Please provide: ${missing.join(", ")}.`);
                  return;
                }
                if (
                  await save(
                    {
                      type: "route",
                      id: routeId || undefined,
                      name: routeName,
                      transportType,
                      destination:
                        transportType === "PUJ / PUV"
                          ? routeDestination.trim()
                          : "",
                      stops: [selected],
                      fare: +routeFare,
                      scheduled: false,
                      approved: routeApproved,
                      reference: routeRef,
                      active:
                        data.routes.find((r) => r.id === routeId)?.active ??
                        true,
                    },
                    routeApproved
                      ? "Route saved and approved."
                      : "Route saved. Pending approval.",
                  )
                ) {
                  setRouteId(null);
                  setRouteName("");
                  setRouteDestination("");
                  setSelected(null);
                  setRouteApproved(false);
                  setRouteRef("");
                  setRouteFare("");
                  setTransportType("");
                } else {
                  setRouteError(
                    "The route was not saved. Check your connection and route details, then try again.",
                  );
                }
              }}
            />
            {Boolean(routeError) && (
              <Text
                accessibilityRole="alert"
                style={[s.body, { color: "#B42318" }]}
              >
                {routeError}
              </Text>
            )}
            <Button
              title="Clear route form"
              secondary
              onPress={() => {
                setRouteId(null);
                setRouteName("");
                setRouteDestination("");
                setSelected(null);
              }}
            />
          </Card>
        </>
      )}
      {(section === "all" || section === "terminals") && (
        <>
          <Card>
            <Text style={s.cardTitle}>Terminals</Text>
            {data.terminals.map((t) => (
              <View key={t.id} style={s.rowBetween}>
                <Text style={[s.label, { flex: 1 }]}>{t.name}</Text>
                <Button
                  title="Edit"
                  secondary
                  onPress={() => editTerminal(t)}
                />
                <Switch
                  accessibilityLabel={`Activate ${t.name}`}
                  value={t.active}
                  onValueChange={(active) =>
                    void action("/configure", {
                      type: "toggle",
                      collection: "terminals",
                      id: t.id,
                      active,
                    })
                  }
                />
              </View>
            ))}
            <Field
              label="Terminal name"
              value={terminalName}
              onChange={setTerminalName}
            />
            <Text style={s.small}>
              Location: {selected?.name || "Choose a point on the map"}. Select
              its exact position on the map above.
            </Text>
            <View style={s.chips}>
              {data.routes.map((r) => (
                <Choice
                  key={r.id}
                  label={r.name}
                  selected={terminalRoute === r.id}
                  onPress={() => setTerminalRoute(r.id)}
                />
              ))}
            </View>
            <Button
              title={terminalId ? "Save terminal" : "Add terminal"}
              disabled={busy || !selected}
              onPress={async () => {
                if (!selected) {
                  return;
                }
                if (
                  await action("/configure", {
                    type: "terminal",
                    id: terminalId || undefined,
                    name: terminalName,
                    point: selected,
                    routeId: terminalRoute,
                    active:
                      data.terminals.find((t) => t.id === terminalId)?.active ??
                      true,
                  })
                ) {
                  setTerminalId(null);
                  setTerminalName("");
                }
              }}
            />
          </Card>{" "}
        </>
      )}
    </>
  );
}
