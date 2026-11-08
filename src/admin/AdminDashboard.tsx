import type { Snapshot } from "../types/types";
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
  refresh?: () => Promise<boolean>;
};
// Administrator pages are available on the web only.
export default function AdminDashboard(_props: AdminDashboardProps) {
  return null;
}
