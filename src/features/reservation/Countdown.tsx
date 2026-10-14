import { useEffect, useRef } from "react";

import type { ServerClock } from "@/api/http/serverClock";
import { useAnnounce } from "@/shared/ui";

import { useCountdown } from "./useCountdown";

export interface CountdownProps {
  readonly expiresAt: string;
  readonly clock: ServerClock;
  readonly onElapsed: () => void;
}

function getAnnouncement(remainingMs: number): string | null {
  const remainingSeconds = Math.ceil(remainingMs / 1_000);
  if (remainingSeconds <= 0) return null;
  if (remainingSeconds <= 30 && remainingSeconds % 10 === 0) {
    return `Quedan ${String(remainingSeconds)} segundos`;
  }
  if (remainingSeconds % 60 === 0) {
    return `Quedan ${String(remainingSeconds / 60)} minutos`;
  }
  return null;
}

export function Countdown({ expiresAt, clock, onElapsed }: CountdownProps) {
  const countdown = useCountdown(expiresAt, clock, onElapsed);
  const announce = useAnnounce();
  const lastAnnouncement = useRef<string | null>(null);

  useEffect(() => {
    lastAnnouncement.current = null;
  }, [expiresAt]);

  useEffect(() => {
    const message = getAnnouncement(countdown.remainingMs);
    if (message !== null && message !== lastAnnouncement.current) {
      lastAnnouncement.current = message;
      announce(message);
    }
  }, [announce, countdown.remainingMs]);

  return <span aria-hidden="true">{countdown.label}</span>;
}
