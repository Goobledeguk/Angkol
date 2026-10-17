export type Role =
  "Passenger" | "Tricycle driver" | "PUJ / PUV driver" | "Administrator";
export type Point = { name: string; latitude: number; longitude: number };
export type Geometry = { type: "LineString"; coordinates: number[][] };
export type User = {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  available: boolean;
  verified: boolean;
  license: string;
  association: string;
  plate: string;
  capacity: number;
  routeId: string | null;
  location: (Point & { updatedAt: number }) | null;
};
export type Status =
  | "Requested"
  | "Accepted"
  | "Arrived"
  | "In progress"
  | "Completed"
  | "Cancelled";
export type Quote = {
  id: string;
  pickup: string;
  destination: string;
  pickupPoint: Point;
  destinationPoint: Point;
  distance: number;
  fare: number;
  minutes: number;
  geometry: Geometry;
  fareReference: string;
  sampleFare: boolean;
  expires: number;
};
export type Trip = Quote & {
  passengerId: string;
  passenger: string;
  driverId: string | null;
  driver?: string;
  driverPhone?: string;
  driverAssociation?: string;
  pickupNote?: string;
  plate?: string;
  status: Status;
  createdAt: string;
  timestamps: Partial<Record<Status, number>>;
  rating: number | null;
};
export type Route = {
  id: string;
  name: string;
  stops: Point[];
  fare: number;
  interval: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  approved: boolean;
  reference: string;
};
export type Terminal = {
  id: string;
  name: string;
  point: Point;
  routeId: string;
  active: boolean;
};
export type Vehicle = {
  id: string;
  name: string;
  kind: Role;
  plate: string;
  routeId: string | null;
  capacity: number;
  location: Point & { updatedAt: number };
  stale: boolean;
};
export type StopRequest = {
  id: string;
  routeId: string;
  point: Point;
  passenger: string;
  userId: string;
  createdAt: number;
};
export type Report = {
  id: string;
  details: string;
  tripId: string | null;
  status: string;
  reporter: string;
  createdAt: string;
};
export type Snapshot = {
  sampleMetrics?: {
    uptimePercent: number;
    responseMs: number;
    expiringDocuments: number;
  };
  runs?: DriverRun[];
  user: User;
  trips: Trip[];
  routes: Route[];
  terminals: Terminal[];
  vehicles: Vehicle[];
  users: User[];
  landmarks: Point[];
  stopRequests: StopRequest[];
  baseFare: number;
  perKm: number;
  fareApproved: boolean;
  sampleMode: boolean;
  fareReference: string;
  reports: Report[];
  notifications: {
    id: string;
    message: string;
    createdAt: string;
    read: boolean;
  }[];
  logs: { id: number; action: string; at: string }[];
  serverTime: number;
};
export type DriverRun = {
  id: string;
  driverId: string;
  driver: string;
  plate: string;
  capacity: number;
  routeId: string;
  routeName: string;
  stops: Point[];
  fare: number;
  sampleFare: boolean;
  reference: string;
  status: "In progress" | "Completed";
  startedAt: string;
  endedAt: string | null;
  stopIndex: number;
  onboard: number;
  totalBoarded: number;
  cashFares: number;
  revision: number;
  events: {
    at: string;
    stop: string;
    boarded: number;
    alighted: number;
    onboard: number;
    type: string;
  }[];
};
