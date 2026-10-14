import { useEffect, useRef, useState } from "react";

import type { ServerClock } from "@/api/http/serverClock";
import { formatCountdown } from "@/shared/format/formatters";

export interface CountdownState {
  readonly remainingMs: number;
  readonly expired: boolean;
  readonly label: string;
}

function getCountdownState(
  expiresAt: string,
  clock: ServerClock,
): CountdownState {
  const remainingMs = Math.max(0, Date.parse(expiresAt) - clock.now());
  return {
    remainingMs,
    expired: remainingMs === 0,
    label: formatCountdown(remainingMs),
  };
}

export function useCountdown(
  expiresAt: string,
  clock: ServerClock,
  onElapsed: () => void,
): CountdownState {
  const [countdown, setCountdown] = useState(() =>
    getCountdownState(expiresAt, clock),
  );
  const elapsed = useRef(false);

  useEffect(() => {
    elapsed.current = false;
    const tick = () => {
      const next = getCountdownState(expiresAt, clock);
      setCountdown(next);
      if (next.expired && !elapsed.current) {
        elapsed.current = true;
        onElapsed();
      }
    };

    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [clock, expiresAt, onElapsed]);

  return countdown;
}
