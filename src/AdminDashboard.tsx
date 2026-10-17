import React from "react";
import { ScrollView, Text } from "react-native";
import AdminPanel from "./AdminPanel";
import { Button, Heading } from "./ui";
import type { Snapshot } from "./types";
export type AdminDashboardProps = {
  data: Snapshot;
  busy: boolean;
  connected: boolean;
  notice: string;
  dismissNotice: () => void;
  action: (
    endpoint: string,
    input: unknown,
    method?: string,
  ) => Promise<boolean>;
  logout: () => Promise<void>;
};
// Mobile administrator preview uses the shared management controls.
export default function AdminDashboard(props: AdminDashboardProps) {
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Heading
        title="Administrator preview"
        sub="Fictional sample configuration"
      />
      <Button title="Leave preview" onPress={props.logout} />
      {Boolean(props.notice) && <Text>{props.notice}</Text>}
      <AdminPanel data={props.data} busy={props.busy} action={props.action} />
    </ScrollView>
  );
}
