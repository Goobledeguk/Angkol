import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { useNow } from "../useNow";
import { useAppActive } from "../useAppActive";

describe("useNow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-21T01:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts at the current time", async () => {
    const { result } = await renderHook(() => useNow(1000));
    expect(result.current).toBe(Date.parse("2026-11-21T01:00:00Z"));
  });

  it("ticks on the given interval", async () => {
    const { result } = await renderHook(() => useNow(30_000));
    await act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(result.current).toBe(Date.parse("2026-11-21T01:00:30Z"));
    await act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(result.current).toBe(Date.parse("2026-11-21T01:01:30Z"));
  });

  it("does not tick before the interval passes", async () => {
    const { result } = await renderHook(() => useNow(30_000));
    await act(() => {
      jest.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(Date.parse("2026-11-21T01:00:00Z"));
  });

  it("stops ticking after unmount", async () => {
    const clear = jest.spyOn(global, "clearInterval");
    const { unmount } = await renderHook(() => useNow(1000));
    await unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
});

describe("useAppActive", () => {
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    listener = undefined;
    remove.mockClear();
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
      listener = handler as (state: AppStateStatus) => void;
      return { remove } as never;
    });
    Object.defineProperty(AppState, "currentState", { value: "active", configurable: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reports active on mount", async () => {
    const { result } = await renderHook(() => useAppActive());
    expect(result.current).toBe(true);
  });

  it("goes inactive in the background and back to active", async () => {
    const { result } = await renderHook(() => useAppActive());
    await act(() => listener?.("background"));
    expect(result.current).toBe(false);
    await act(() => listener?.("active"));
    expect(result.current).toBe(true);
  });

  it("calls onResume once when returning to the foreground", async () => {
    const onResume = jest.fn();
    await renderHook(() => useAppActive(onResume));
    await act(() => listener?.("background"));
    await act(() => listener?.("active"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("does not call onResume for active → active changes", async () => {
    const onResume = jest.fn();
    await renderHook(() => useAppActive(onResume));
    await act(() => listener?.("active"));
    expect(onResume).not.toHaveBeenCalled();
  });

  it("uses the latest onResume callback", async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderHook(({ cb }) => useAppActive(cb), { initialProps: { cb: first } });
    await rerender({ cb: second });
    await act(() => listener?.("inactive"));
    await act(() => listener?.("active"));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("removes the listener on unmount", async () => {
    const { unmount } = await renderHook(() => useAppActive());
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
