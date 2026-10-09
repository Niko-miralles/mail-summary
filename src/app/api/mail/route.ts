import { getSessionUser } from "@/lib/session";
import { getUser } from "@/lib/store";
import { fetchMailBody } from "@/lib/gmail";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const userId = await getSessionUser();
  if (!userId) return Response.json({ error: "not_logged_in" }, { status: 401 });
  const user = await getUser(userId);
  if (!user) return Response.json({ error: "no_user" }, { status: 404 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ mails: user.recentMails ?? [] });
  }
  const stored = (user.recentMails ?? []).find((m) => m.id === id);
  const mail = await fetchMailBody(user, id);
  return Response.json({ ...mail, summary: stored?.summary ?? null });
}
