import { getSessionUser } from "@/lib/session";
import { getUser, saveUser } from "@/lib/store";

export async function POST(request: Request) {
  const userId = await getSessionUser();
  if (!userId) return Response.json({ error: "not_logged_in" }, { status: 401 });
  const sub = (await request.json()) as PushSubscriptionJSON;
  const user = await getUser(userId);
  if (!user) return Response.json({ error: "no_user" }, { status: 404 });
  if (!user.subscriptions.some((s) => s.endpoint === sub.endpoint)) {
    user.subscriptions.push(sub);
    await saveUser(user);
  }
  return Response.json({ ok: true });
}
