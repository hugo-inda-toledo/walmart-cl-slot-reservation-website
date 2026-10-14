const SHORT_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sept",
  "oct",
  "nov",
  "dic",
] as const;

const LONG_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

const CLP_FORMATTER = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function formatClp(amount: number): string {
  return CLP_FORMATTER.format(amount).replaceAll(/[\u00a0\u202f ]/gu, "");
}

export function parseCalendarDate(iso: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(iso);

  if (match === null) {
    throw new Error("La fecha calendario debe tener formato YYYY-MM-DD.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = { year, month, day };

  if (!isValidCalendarDate(date)) {
    throw new Error("La fecha calendario no es válida.");
  }

  return date;
}

export function formatDayMonth(date: CalendarDate): string {
  return `${String(date.day)} ${monthName(SHORT_MONTHS, date.month)}`;
}

export function formatLongDate(date: CalendarDate): string {
  return `${weekdayName(date)} ${String(date.day)} de ${monthName(LONG_MONTHS, date.month)}`;
}

export function compareCalendarDates(a: string, b: string): number {
  const left = parseCalendarDate(a);
  const right = parseCalendarDate(b);

  return (
    left.year - right.year || left.month - right.month || left.day - right.day
  );
}

export function formatTimeRange(
  startIso: string,
  endIso: string,
  timeZone: string,
): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
    timeZone,
  });

  return `${formatTime(startIso, formatter)}-${formatTime(endIso, formatter)}`;
}

export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTime(iso: string, formatter: Intl.DateTimeFormat): string {
  const parts = formatter.formatToParts(new Date(iso));
  const hour = getPart(parts, "hour");
  const minute = getPart(parts, "minute");
  const period = getPart(parts, "dayPeriod").toLowerCase();

  return `${hour}:${minute}${period}`;
}

function getPart(
  parts: readonly Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const value = parts.find((part) => part.type === type)?.value;

  if (value === undefined) {
    throw new Error(`No se pudo obtener ${type} del horario.`);
  }

  return value;
}

function isValidCalendarDate(date: CalendarDate): boolean {
  if (date.month < 1 || date.month > 12 || date.day < 1) {
    return false;
  }

  const daysInMonth = [
    31,
    isLeapYear(date.year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return date.day <= monthDays(daysInMonth, date.month);
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function weekday({ year, month, day }: CalendarDate): number {
  const monthOffsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;

  return (
    (adjustedYear +
      Math.floor(adjustedYear / 4) -
      Math.floor(adjustedYear / 100) +
      Math.floor(adjustedYear / 400) +
      monthDays(monthOffsets, month) +
      day) %
    7
  );
}

function monthName(months: readonly string[], month: number): string {
  return monthDays(months, month);
}

function weekdayName(date: CalendarDate): string {
  const name = WEEKDAYS[weekday(date)];

  if (name === undefined) {
    throw new Error("No se pudo determinar el día de la semana.");
  }

  return name;
}

function monthDays<T>(values: readonly T[], month: number): T {
  const value = values[month - 1];

  if (value === undefined) {
    throw new Error("El mes calendario no es válido.");
  }

  return value;
}
