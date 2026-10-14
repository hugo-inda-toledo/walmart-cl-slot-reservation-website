export interface SessionStore {
  read<T>(key: string, guard: (value: unknown) => value is T): T | undefined;
  write(key: string, value: unknown): void;
  remove(key: string): void;
}

const PREFIX = "wcsr:";

export const sessionStore: SessionStore = {
  read<T>(key: string, guard: (value: unknown) => value is T): T | undefined {
    try {
      const raw = getSessionStorage()?.getItem(PREFIX + key);

      if (raw === null || raw === undefined) {
        return undefined;
      }

      const value: unknown = JSON.parse(raw);
      return guard(value) ? value : undefined;
    } catch {
      return undefined;
    }
  },

  write(key: string, value: unknown): void {
    try {
      getSessionStorage()?.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  },

  remove(key: string): void {
    try {
      getSessionStorage()?.removeItem(PREFIX + key);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  },
};

function getSessionStorage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}
