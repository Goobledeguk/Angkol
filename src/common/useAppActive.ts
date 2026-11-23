import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export function useAppActive(onResume?: () => void) {
  const [active, setActive] = useState(AppState.currentState !== "background");
  const wasActive = useRef(active);
  const resume = useRef(onResume);

  useEffect(() => {
    resume.current = onResume;
  }, [onResume]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const next = state === "active";
      if (next && !wasActive.current) {
        resume.current?.();
      }
      wasActive.current = next;
      setActive(next);
    });
    return () => subscription.remove();
  }, []);

  return active;
}
