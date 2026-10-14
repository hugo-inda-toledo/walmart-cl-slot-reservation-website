import { describe, expect, it } from "vitest";

import {
  compareCalendarDates,
  formatClp,
  formatCountdown,
  formatDayMonth,
  formatLongDate,
  formatTimeRange,
  parseCalendarDate,
} from "./formatters";

describe("formatClp", () => {
  it("formats integer Chilean pesos with a dollar sign, dots, and no decimals", () => {
    expect(formatClp(2990)).toBe("$2.990");
    expect(formatClp(1200000)).toBe("$1.200.000");
  });
});

describe("calendar date formatters", () => {
  it("parses and formats calendar dates without using the device timezone", () => {
    const date = parseCalendarDate("2026-10-14");

    expect(date).toEqual({ year: 2026, month: 10, day: 14 });
    expect(formatDayMonth(date)).toBe("14 oct");
    expect(formatLongDate(date)).toBe("miércoles 14 de octubre");
  });

  it("covers the full month and weekday tables", () => {
    const short = "ene feb mar abr may jun jul ago sept oct nov dic".split(" ");
    const long = (
      "enero febrero marzo abril mayo junio julio agosto septiembre " +
      "octubre noviembre diciembre"
    ).split(" ");
    short.forEach((name, index) => {
      const month = String(index + 1).padStart(2, "0");
      const date = parseCalendarDate(`2026-${month}-15`);
      expect(formatDayMonth(date)).toBe(`15 ${name}`);
      expect(formatLongDate(date)).toContain(` de ${long[index] ?? ""}`);
    });
    const weekdays = "domingo lunes martes miércoles jueves viernes sábado";
    weekdays.split(" ").forEach((name, index) => {
      const day = String(11 + index);
      expect(formatLongDate(parseCalendarDate(`2026-10-${day}`))).toBe(
        `${name} ${day} de octubre`,
      );
    });
  });

  it("compares ISO calendar dates chronologically", () => {
    expect(compareCalendarDates("2026-10-14", "2026-10-14")).toBe(0);
    expect(compareCalendarDates("2026-10-13", "2026-10-14")).toBeLessThan(0);
    expect(compareCalendarDates("2026-11-01", "2026-10-31")).toBeGreaterThan(0);
  });
});

describe("formatTimeRange", () => {
  it("uses the API timezone even when the process timezone is Pacific/Auckland", () => {
    expect(process.env.TZ).toBe("Pacific/Auckland");
    expect(
      formatTimeRange(
        "2026-10-14T03:00:00Z",
        "2026-10-14T05:00:00Z",
        "America/Santiago",
      ),
    ).toBe("12:00am-2:00am");
  });

  it("keeps the calendar day supplied by the API timezone across device-day boundaries", () => {
    expect(
      formatTimeRange(
        "2026-10-14T23:00:00Z",
        "2026-10-15T01:00:00Z",
        "America/Santiago",
      ),
    ).toBe("8:00pm-10:00pm");
  });
});

describe("formatCountdown", () => {
  it("renders full minutes and seconds and never returns a negative value", () => {
    expect(formatCountdown(598_000)).toBe("09:58");
    expect(formatCountdown(61_999)).toBe("01:01");
    expect(formatCountdown(-1)).toBe("00:00");
  });
});
