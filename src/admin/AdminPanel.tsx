import React, { useRef, useState } from "react";
import { View, Text, Switch } from "react-native";
import { Snapshot, Route } from "../types/types";
import { Card, Field, Button, Choice, Heading, Badge } from "../common/ui";
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
  const [routeId, setRouteId] = useState<string | null>(initialRoute?.id || null),
    [routeName, setRouteName] = useState(initialRoute?.name || ""),
    [routeFare, setRouteFare] = useState(
      initialRoute ? String(initialRoute.fare) : "",
    ),
    [routeRef, setRouteRef] = useState(initialRoute?.reference || ""),
    [routeApproved, setRouteApproved] = useState(
      initialRoute?.approved || false,
    ),
    [routeDestination, setRouteDestination] = useState(
      initialRoute?.destination || "",
    );
  const [routeError, setRouteError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [fareBase, setFareBase] = useState(String(data.baseFare ?? 0));
  const [fareKm, setFareKm] = useState(String(data.perKm ?? 0));
  const [transportType, setTransportType] = useState<"PUJ / PUV">("PUJ / PUV");
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

  function editRoute(r: Route) {
    setRouteId(r.id);
    setRouteName(r.name);
    setRouteFare(String(r.fare));
    setRouteRef(r.reference || "");
    setRouteApproved(!!r.approved);
    setRouteDestination(r.destination || "");
  }

  function clearRouteForm() {
    setRouteId(null);
    setRouteName("");
    setRouteFare("");
    setRouteRef("");
    setRouteApproved(false);
    setRouteDestination("");
    setRouteError("");
    setTransportType("PUJ / PUV");
  }

  return (
    <>
      {Boolean(feedback) && (
        <Text accessibilityRole="alert" style={s.body}>
          {feedback}
        </Text>
      )}

      {section === "all" && (
        <Heading title="Calbayog transport management" />
      )}

      {/* Driver approval */}
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

      {/* Route management (map and map-related inputs removed) */}
      {(section === "all" || section === "routes") && (
        <>
          <Card>
            <Heading title={routeId ? "Edit route" : "Add route"} />
            <Field
              label="Route name"
              value={routeName}
              onChange={setRouteName}
            />
            <Text style={s.label}>Vehicle type</Text>
            <View style={s.chips}>
              <Choice
                label="PUJ / PUV"
                selected
                onPress={() => setTransportType("PUJ / PUV")}
              />
            </View>
            <Field
              label="Route fare"
              value={routeFare}
              onChange={setRouteFare}
              numeric
            />
            <Field
              label="PUJ/PUV destination"
              value={routeDestination}
              onChange={setRouteDestination}
            />
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
                  !routeDestination.trim() && "PUJ/PUV destination",
                  (!routeFare.trim() ||
                    !Number.isFinite(Number(routeFare)) ||
                    Number(routeFare) < 0) &&
                    "valid route fare",
                ].filter(Boolean);
                if (missing.length) {
                  setRouteError(`Please provide: ${missing.join(", ")}.`);
                  return;
                }
                const ok = await save(
                  {
                    type: "route",
                    id: routeId || undefined,
                    name: routeName.trim(),
                    transportType,
                    destination: routeDestination.trim(),
                    stops: [
                      {
                        name: routeDestination.trim() || routeName.trim(),
                        latitude: data.landmarks[0]?.latitude ?? 12.0676,
                        longitude: data.landmarks[0]?.longitude ?? 124.5942,
                      },
                    ],
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
                );
                if (ok) {
                  clearRouteForm();
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
              onPress={clearRouteForm}
            />
          </Card>

          {/* Route table — shows created routes */}
          <Card>
            <Text style={s.cardTitle}>Configured routes</Text>
            {data.routes.length === 0 && (
              <Text style={s.body}>No routes yet. Add one above.</Text>
            )}
            {data.routes.map((r) => (
              <View key={r.id} style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{r.name}</Text>
                  <Text style={s.small}>
                    ₱{r.fare} · {r.destination || "—"} ·{" "}
                    {r.approved ? "Approved" : "Pending"}
                  </Text>
                </View>
                <Button
                  title="Edit"
                  secondary
                  onPress={() => editRoute(r)}
                />
                <Switch
                  accessibilityLabel={`Activate ${r.name}`}
                  value={!!r.active}
                  onValueChange={(active) =>
                    void action("/configure", {
                      type: "toggle",
                      collection: "routes",
                      id: r.id,
                      active,
                    })
                  }
                />
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Terminals (simplified, no map point picker) */}
      {(section === "all" || section === "terminals") && (
        <Card>
          <Text style={s.cardTitle}>Terminals</Text>
          {data.terminals.map((t) => (
            <View key={t.id} style={s.rowBetween}>
              <Text style={[s.label, { flex: 1 }]}>{t.name}</Text>
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
          {data.terminals.length === 0 && (
            <Text style={s.body}>No terminals configured yet.</Text>
          )}
        </Card>
      )}

      {/* Fares — tricycle matrix + per-route PUJ fares */}
      {(section === "all" || section === "fares") && (
        <Card>
          <Text style={s.cardTitle}>Fare configuration</Text>
          <Text style={s.small}>
            Tricycle fares use the base fare plus the per-kilometre rate.
            PUJ/PUV fares are set per route in the Routes section.
          </Text>
          <Field
            label="Tricycle base fare (PHP)"
            value={fareBase}
            onChange={setFareBase}
            numeric
          />
          <Field
            label="Per-kilometre rate (PHP)"
            value={fareKm}
            onChange={setFareKm}
            numeric
          />
          <Button
            title="Save fare rules"
            disabled={busy}
            onPress={() => {
              const baseFare = Number(fareBase);
              const perKm = Number(fareKm);
              if (!(baseFare > 0) || !(perKm > 0)) {
                setFeedback("Enter a base fare and rate greater than zero.");
                return;
              }
              void save(
                { type: "fare", baseFare, perKm },
                "Fare rules saved.",
              ).then((ok) => {
                if (ok) {
                  setFareBase(String(baseFare));
                  setFareKm(String(perKm));
                }
              });
            }}
          />
          {data.routes.map((r) => (
            <View key={r.id} style={s.rowBetween}>
              <Text style={[s.label, { flex: 1 }]}>{r.name}</Text>
              <Text style={s.label}>₱{r.fare}</Text>
            </View>
          ))}
          {feedback ? <Text style={s.small}>{feedback}</Text> : null}
        </Card>
      )}
    </>
  );
}