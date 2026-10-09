import { getSessionUser } from "@/lib/session";
import { getUser } from "@/lib/store";
import { fetchTodayEvents, formatEventTime } from "@/lib/calendar";

const TZ = process.env.CALENDAR_TZ || "Europe/Madrid";

export async function GET() {
  const userId = await getSessionUser();
  if (!userId) return Response.json({ error: "not_logged_in" }, { status: 401 });
  const user = await getUser(userId);
  if (!user) return Response.json({ error: "no_user" }, { status: 404 });
  const events = await fetchTodayEvents(user, TZ);
  return Response.json({
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      time: formatEventTime(e, TZ),
      location: e.location,
    })),
  });
}
