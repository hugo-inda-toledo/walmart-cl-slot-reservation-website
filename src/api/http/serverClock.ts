export interface ServerClock {
  now(): number;
  observe(
    serverDateHeader: string | null,
    requestStartMs: number,
    responseEndMs: number,
  ): void;
}

export function createServerClock(
  deviceNow: () => number = Date.now,
): ServerClock {
  let offsetMs = 0;

  return {
    now: () => deviceNow() + offsetMs,
    observe: (serverDateHeader, requestStartMs, responseEndMs) => {
      if (serverDateHeader === null) {
        offsetMs = 0;
        return;
      }

      const serverMs = Date.parse(serverDateHeader);
      if (Number.isNaN(serverMs)) return;
      // El header Date HTTP trunca a segundos: el desfase puede quedar sesgado
      // hasta ~1 s hacia atrás; es aceptable frente a la ventana de 10 min.
      offsetMs = serverMs - (requestStartMs + responseEndMs) / 2;
    },
  };
}
