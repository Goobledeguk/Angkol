import { Animated, PanResponder, type GestureResponderEvent, type NativeTouchEvent, type PanResponderInstance } from "react-native";
import type { Point, Vehicle } from "../types/types";
import { MAX_ZOOM, MIN_ZOOM, applyGesture, cameraAt, mercX, mercY, pointAtScreen, scaleOf, zoomAbout, type Camera } from "./geo";

type Touch = Pick<NativeTouchEvent, "pageX" | "pageY">;
const spread = (a: Touch, b: Touch) => Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);

/** What the map component hands the gesture controller after every render. */
export type GestureInputs = {
  cam: Camera;
  width: number;
  height: number;
  mode?: "pickup" | "destination" | null;
  vehicles: Vehicle[];
  onSelect?: (point: Point) => void;
  onVehiclePress?: (vehicle: Vehicle) => void;
  /** Commits a camera (the gesture is over). */
  commit: (cam: Camera, userMoved: boolean) => void;
};

/**
 * Drag, pinch, double-tap and tap handling for the map. While a finger is
 * down only the animated transform changes, so the map follows the finger
 * without React re-rendering; the camera is committed once, on release.
 */
export class MapGestures {
  readonly tx = new Animated.Value(0);
  readonly ty = new Animated.Value(0);
  readonly scale = new Animated.Value(1);
  readonly responder: PanResponderInstance;

  private inputs: GestureInputs | null = null;
  private live = { tx: 0, ty: 0, s: 1 };
  private single?: Touch;
  private pinch?: { mid: { x: number; y: number }; dist: number };
  private travel = 0;
  private startedAt = 0;
  private lastTap = 0;
  private origin = { x: 0, y: 0 };

  constructor() {
    this.responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => this.grant(e),
      onPanResponderMove: (e) => this.move(e),
      onPanResponderRelease: (e) => this.release(e),
      onPanResponderTerminate: () => this.finish(),
    });
  }

  sync(inputs: GestureInputs) {
    this.inputs = inputs;
  }

  /** The frame's position on screen, so taps map to the right spot even inside a scrolled page. */
  setOrigin(x: number, y: number) {
    this.origin = { x, y };
  }

  /** Clears the live transform; called after a committed camera is drawn. */
  reset() {
    this.set({ tx: 0, ty: 0, s: 1 });
  }

  /** Commits a camera and, in pinpoint mode, reports the spot under the pin. */
  settle(cam: Camera) {
    const inputs = this.inputs;
    if (!inputs) {
      return;
    }
    inputs.commit(cam, true);
    if (inputs.mode && inputs.onSelect) {
      const center = pointAtScreen(cam, inputs.width / 2, inputs.height / 2, inputs.width, inputs.height);
      inputs.onSelect({ ...center, name: "Pinned spot" });
    }
  }

  private set(next: { tx: number; ty: number; s: number }) {
    this.live = next;
    this.tx.setValue(next.tx);
    this.ty.setValue(next.ty);
    this.scale.setValue(next.s);
  }

  private grant(e: GestureResponderEvent) {
    const t = e.nativeEvent.touches;
    this.single = t.length === 1 ? t[0] : { pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY };
    this.pinch = undefined;
    this.travel = 0;
    this.startedAt = Date.now();
  }

  private move(e: GestureResponderEvent) {
    const inputs = this.inputs;
    if (!inputs) {
      return;
    }
    const t = e.nativeEvent.touches;
    const cur = this.live;
    if (t.length >= 2) {
      const mid = {
        x: (t[0].pageX + t[1].pageX) / 2 - this.origin.x - inputs.width / 2,
        y: (t[0].pageY + t[1].pageY) / 2 - this.origin.y - inputs.height / 2,
      };
      const dist = Math.max(1, spread(t[0], t[1]));
      const prev = this.pinch;
      this.single = undefined;
      this.travel += 99;
      if (prev) {
        const want = cur.s * (dist / prev.dist);
        const s = Math.max(2 ** (MIN_ZOOM - inputs.cam.zoom), Math.min(2 ** (MAX_ZOOM - inputs.cam.zoom), want));
        const k = s / cur.s;
        // Keep the content under the fingers' midpoint under it while zooming.
        this.set({ tx: mid.x - k * (prev.mid.x - cur.tx), ty: mid.y - k * (prev.mid.y - cur.ty), s });
      }
      this.pinch = { mid, dist };
      return;
    }
    const p = t[0] ?? { pageX: e.nativeEvent.pageX, pageY: e.nativeEvent.pageY };
    this.pinch = undefined;
    const prev = this.single;
    this.single = p;
    if (!prev) {
      return;
    }
    const dx = p.pageX - prev.pageX;
    const dy = p.pageY - prev.pageY;
    this.travel += Math.abs(dx) + Math.abs(dy);
    this.set({ tx: cur.tx + dx, ty: cur.ty + dy, s: cur.s });
  }

  private release(e: GestureResponderEvent) {
    if (this.travel < 8 && Date.now() - this.startedAt < 400) {
      this.reset();
      this.tap(e.nativeEvent.pageX, e.nativeEvent.pageY);
      return;
    }
    this.finish();
  }

  private finish() {
    const inputs = this.inputs;
    const { tx, ty, s } = this.live;
    if (!inputs || (tx === 0 && ty === 0 && s === 1)) {
      return;
    }
    this.settle(applyGesture(inputs.cam, tx, ty, s));
  }

  private tap(pageX: number, pageY: number) {
    const inputs = this.inputs;
    if (!inputs) {
      return;
    }
    const { cam, width: w, height: h } = inputs;
    const x = pageX - this.origin.x;
    const y = pageY - this.origin.y;
    const now = Date.now();
    if (now - this.lastTap < 300) {
      this.lastTap = 0;
      this.settle(zoomAbout(cam, 2, x - w / 2, y - h / 2));
      return;
    }
    this.lastTap = now;
    const scale = scaleOf(cam.zoom);
    const hit = inputs.vehicles.find((v) => {
      const vx = w / 2 + (mercX(v.location.longitude) - cam.cx) * scale;
      const vy = h / 2 + (mercY(v.location.latitude) - cam.cy) * scale;
      return Math.hypot(vx - x, vy - y) <= 22;
    });
    if (hit && inputs.onVehiclePress) {
      inputs.onVehiclePress(hit);
      return;
    }
    if (inputs.mode) {
      // Tapping in pinpoint mode moves that spot under the pin.
      this.settle(cameraAt(pointAtScreen(cam, x, y, w, h), cam.zoom));
    }
  }
}
