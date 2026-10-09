import { google } from "googleapis";
import type { StoredUser } from "./store";
import { googleAuth } from "./gmail";

export type CalEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  allDay: boolean;
};

export async function fetchTodayEvents(user: StoredUser, tz: string): Promise<CalEvent[]> {
  const calendar = google.calendar({ version: "v3", auth: await googleAuth(user) });
  const now = new Date();
  const start = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 20,
    timeZone: tz,
  });
  return (res.data.items ?? []).map((e) => ({
    id: e.id ?? "",
    title: e.summary ?? "(sin título)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    location: e.location ?? undefined,
    allDay: !e.start?.dateTime,
  }));
}

export function formatEventTime(e: Pick<CalEvent, "start" | "allDay">, tz: string): string {
  if (e.allDay) return "todo el día";
  return new Date(e.start).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}
