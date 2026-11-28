export type Role =
  | "Passenger"
  | "Tricycle driver"
  | "PUJ / PUV driver"
  | "Administrator"
  | "Vehicle Owner / Operator";
export type AdminLevel = "Technical Team" | "Franchise Owner";
export type VehicleStatus =
  | "Arrived"
  | "In Terminal"
  | "Broken / Inactive"
  | "In transit"
  | "Decommissioned";
export type ApplicationStatus = "pending" | "accepted" | "declined";
export type Point = { name: string; latitude: number; longitude: number };
export type Geometry = { type: "LineString"; coordinates: number[][] };
export type User = {
  photo?: string;
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  adminLevel?: AdminLevel;
  ownerVehicleIds?: string[];
  available: boolean;
  verified: boolean;
  pendingFranchiseApproval?: boolean;
  applicationStatus?: ApplicationStatus;
  licenseDocAttached?: boolean;
  license: string;
  association: string;
  plate: string;
  permitNo?: string;
  franchiseName?: string;
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
  | "Cancelled"
  | "Expired";
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
  serviceType?: "Tricycle" | "PUJ/PUV";
  routeId?: string | null;
  vehicleId?: string;
  paymentStatus?: "unpaid" | "pending" | "paid";
  driverPhoto?: string;
  demoPayment?: {
    method: "GCash" | "Maya" | "Bank transfer";
    status: "Test succeeded";
    reference: string;
    realMoneyCharged: false;
  };
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
  destination?: string;
  transportType?: "Tricycle" | "PUJ / PUV";
  scheduled?: boolean;
  geometry?: Geometry;
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
  vehicleType?: "SUV" | "Coaster" | "Mini Van" | "Bus" | "Tricycle" | "Jeepney";
  plate: string;
  routeId: string | null;
  capacity: number;
  location: Point & { updatedAt: number };
  stale: boolean;
  status?: VehicleStatus;
  ownerId?: string;
  ownerName?: string;
  currentDriver?: string;
  /** PUJ/PUV: the driver is running the route right now (not waiting at the terminal). */
  onRun?: boolean;
  /** Tricycle: the driver is online and taking rides. */
  online?: boolean;
  runId?: string | null;
  nextStop?: string | null;
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
    /** The ride this update is about, when known. */
    tripId?: string | null;
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
