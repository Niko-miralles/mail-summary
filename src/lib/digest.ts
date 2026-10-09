import type { StoredUser } from "./store";
import { saveUser } from "./store";
import { fetchTodayEvents, formatEventTime } from "./calendar";
import { sendPush } from "./push";

const TZ = process.env.CALENDAR_TZ || "Europe/Madrid";
const DIGEST_HOUR = 8; // envía la primera vez que el cron corre a partir de las 08:00 locales

function todayStr(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function localHour(): number {
  return Number(new Date().toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false }));
}

export function digestText(events: { title: string; start: string; allDay: boolean }[]): string {
  if (!events.length) return "Hoy no tienes nada en el calendario. Día libre.";
  const items = events
    .slice(0, 5)
    .map((e) => (e.allDay ? `${e.title} (todo el día)` : `${formatEventTime(e, TZ)} ${e.title}`))
    .join(" · ");
  const more = events.length > 5 ? ` y ${events.length - 5} más` : "";
  return `Hoy tienes ${events.length} ${events.length === 1 ? "evento" : "eventos"}: ${items}${more}`;
}

export async function maybeSendCalendarDigest(user: StoredUser): Promise<boolean> {
  if (user.lastCalendarDigest === todayStr() || localHour() < DIGEST_HOUR) return false;
  const events = await fetchTodayEvents(user, TZ);
  await sendPush(user, "Tu día", digestText(events), "/?view=calendar");
  user.lastCalendarDigest = todayStr();
  await saveUser(user);
  return true;
}
