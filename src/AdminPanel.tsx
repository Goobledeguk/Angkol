import React, { useState } from "react";
import { View, Text, Switch } from "react-native";
import { Snapshot, Point, Route, Terminal } from "./types";
import { Card, Field, Button, Choice, Heading, Badge, money } from "./ui";
import CalbayogMap from "./CalbayogMap";
import { s } from "./styles";
export default function AdminPanel({
  data,
  busy,
  action,
}: {
  data: Snapshot;
  busy: boolean;
  action: (
    endpoint: string,
    input: unknown,
    method?: string,
  ) => Promise<boolean>;
}) {
  const [base, setBase] = useState(String(data.baseFare));
  const [rate, setRate] = useState(String(data.perKm));
  const [reference, setReference] = useState(data.fareReference);
  const [approved, setApproved] = useState(data.fareApproved);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");
  const [stops, setStops] = useState<Point[]>([]);
  const [routeFare, setRouteFare] = useState("13");
  const [interval, setInterval] = useState("15");
  const [start, setStart] = useState("06:00");
  const [end, setEnd] = useState("20:00");
  const [routeRef, setRouteRef] = useState("Sample Calbayog corridor");
  const [routeApproved, setRouteApproved] = useState(false);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [terminalName, setTerminalName] = useState("");
  const [terminalRoute, setTerminalRoute] = useState(data.routes[0]?.id || "");
  const [selected, setSelected] = useState<Point>(data.landmarks[0]);
  function editRoute(r: Route) {
    setRouteId(r.id);
    setRouteName(r.name);
    setStops(r.stops);
    setRouteFare(String(r.fare));
    setInterval(String(r.interval));
    setStart(r.startsAt);
    setEnd(r.endsAt);
    setRouteRef(r.reference);
    setRouteApproved(r.approved);
  }
  function editTerminal(t: Terminal) {
    setTerminalId(t.id);
    setTerminalName(t.name);
    setTerminalRoute(t.routeId);
    setSelected(t.point);
  }
  return (
    <>
      <Heading title="Calbayog transport management" />
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
        <Text style={s.small}>Leave unapproved while using sample data.</Text>
        <Button
          title="Save fare matrix"
          disabled={busy}
          onPress={() =>
            action("/configure", {
              type: "fare",
              baseFare: +base,
              perKm: +rate,
              approved,
              reference,
            })
          }
        />
      </Card>
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
                action(`/drivers/${u.id}`, { verified: !u.verified }, "PATCH")
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
      <Heading
        title="Map and route stops"
        sub="Select a Calbayog map point or a landmark."
      />
      <CalbayogMap
        mode="pickup"
        pickup={selected}
        landmarks={data.landmarks}
        vehicles={data.vehicles}
        terminals={data.terminals.filter((t) => t.active)}
        onSelect={setSelected}
      />
      <View style={s.chips}>
        {data.landmarks.map((p) => (
          <Choice key={p.name} label={p.name} onPress={() => setSelected(p)} />
        ))}
      </View>
      <Field
        label="Selected point name"
        value={selected.name}
        onChange={(name) => setSelected({ ...selected, name })}
      />
      <Text style={s.small}>
        {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
      </Text>
      <Card>
        <Text style={s.cardTitle}>Routes</Text>
        {data.routes.map((r) => (
          <View key={r.id} style={{ gap: 8 }}>
            <View style={s.rowBetween}>
              <Text style={[s.label, { flex: 1 }]}>{r.name}</Text>
              <Switch
                accessibilityLabel={`Activate ${r.name}`}
                value={r.active}
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
            <Text style={s.small}>
              {r.approved ? "Approved" : "Sample"} · {money(r.fare)} ·{" "}
              {r.startsAt}–{r.endsAt} · Every {r.interval} min
            </Text>
            <Button title="Edit route" secondary onPress={() => editRoute(r)} />
          </View>
        ))}
        <Heading title={routeId ? "Edit route" : "Add route"} />
        <Field label="Route name" value={routeName} onChange={setRouteName} />
        <Text style={s.label}>Stops in order</Text>
        {stops.map((p, i) => (
          <View key={`${p.name}-${i}`} style={s.rowBetween}>
            <Text style={[s.body, { flex: 1 }]}>
              {i + 1}. {p.name}
            </Text>
            <Button
              title="Remove"
              secondary
              onPress={() => setStops(stops.filter((_, n) => i !== n))}
            />
          </View>
        ))}
        <Button
          title="Add selected map point as stop"
          secondary
          onPress={() => setStops([...stops, selected])}
        />
        <Field
          label="Route fare"
          value={routeFare}
          onChange={setRouteFare}
          numeric
        />
        <Field
          label="Departure interval (minutes)"
          value={interval}
          onChange={setInterval}
          numeric
        />
        <Field
          label="Operating start (HH:mm)"
          value={start}
          onChange={setStart}
        />
        <Field label="Operating end (HH:mm)" value={end} onChange={setEnd} />
        <Field
          label="Route approval / source reference"
          value={routeRef}
          onChange={setRouteRef}
        />
        <View style={s.rowBetween}>
          <Text style={s.label}>Verified approved route</Text>
          <Switch
            accessibilityLabel="Approved route"
            value={routeApproved}
            onValueChange={setRouteApproved}
          />
        </View>
        <Button
          title="Save route"
          disabled={busy}
          onPress={async () => {
            if (
              await action("/configure", {
                type: "route",
                id: routeId || undefined,
                name: routeName,
                stops,
                fare: +routeFare,
                interval: +interval,
                startsAt: start,
                endsAt: end,
                approved: routeApproved,
                reference: routeRef,
                active:
                  data.routes.find((r) => r.id === routeId)?.active ?? true,
              })
            ) {
              setRouteId(null);
              setRouteName("");
              setStops([]);
            }
          }}
        />
        <Button
          title="Clear route form"
          secondary
          onPress={() => {
            setRouteId(null);
            setRouteName("");
            setStops([]);
          }}
        />
      </Card>
      <Card>
        <Text style={s.cardTitle}>Terminals</Text>
        {data.terminals.map((t) => (
          <View key={t.id} style={s.rowBetween}>
            <Text style={[s.label, { flex: 1 }]}>{t.name}</Text>
            <Button title="Edit" secondary onPress={() => editTerminal(t)} />
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
          Location: {selected.name}. Select its exact position on the map above.
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
          disabled={busy}
          onPress={async () => {
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
      </Card>
    </>
  );
}
