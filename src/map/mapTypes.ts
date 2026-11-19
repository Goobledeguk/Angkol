import { Geometry, Point, Vehicle, Terminal, StopRequest } from "../types/types";
export type MapProps = {
  pickupLabel?: string;
  destinationLabel?: string;
  pickupColor?: string;
  destinationColor?: string;
  terminalColors?: boolean;
  height?: number;
  mode?: "pickup" | "destination" | null;
  pickup?: Point | null;
  destination?: Point | null;
  geometry?: Geometry | null;
  landmarks?: Point[];
  vehicles?: Vehicle[];
  terminals?: Terminal[];
  stops?: StopRequest[];
  onSelect?: (point: Point) => void;
};
