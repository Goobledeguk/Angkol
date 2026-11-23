import { Geometry, Point, Vehicle, Terminal, StopRequest } from "../types/types";
export type MapProps = {
  pickupLabel?: string;
  destinationLabel?: string;
  pickupColor?: string;
  destinationColor?: string;
  terminalColors?: boolean;
  height?: number;
  /**
   * Pinpoint mode: a fixed pin sits in the middle of the map and the person
   * moves the map under it. `onSelect` gets the spot when the map settles.
   */
  mode?: "pickup" | "destination" | null;
  pickup?: Point | null;
  destination?: Point | null;
  geometry?: Geometry | null;
  landmarks?: Point[];
  vehicles?: Vehicle[];
  terminals?: Terminal[];
  stops?: StopRequest[];
  /** The phone's own position, drawn as a person. */
  me?: Point | null;
  /** Draw the pickup as a person (a passenger waiting there). Defaults to true. */
  pickupIsPerson?: boolean;
  /** Changing this re-frames the map (for example after "Use my location" or a search pick). */
  recenterKey?: string | number;
  /** Keep re-framing as vehicles move until the person pans the map themselves. */
  track?: boolean;
  onSelect?: (point: Point) => void;
  /** Tapping a vehicle marker. */
  onVehiclePress?: (vehicle: Vehicle) => void;
};
