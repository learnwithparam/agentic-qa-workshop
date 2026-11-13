// Store time. The world runs on a store clock that tests can set, so slot rules are repeatable.
export type LocalParts = { date: string; hour: number; minute: number };

export function localParts(instant: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const pieces = formatter.formatToParts(instant);
  const part = Object.fromEntries(pieces.map((piece) => [piece.type, piece.value]));
  return {
    date: `${part.year}-${part.month}-${part.day}`,
    hour: Number(part.hour),
    minute: Number(part.minute),
  };
}

export function addDays(date: string, days: number): string {
  // Noon UTC keeps the date the same in every time zone while we move it.
  const moment = new Date(`${date}T12:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}

export function dateLabel(date: string): string {
  const moment = new Date(`${date}T12:00:00Z`);
  return moment.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
