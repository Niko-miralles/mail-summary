import { getSessionUser } from "@/lib/session";
import { getUser } from "@/lib/store";

export async function GET() {
  const userId = await getSessionUser();
  if (!userId) return Response.json({ error: "not_logged_in" }, { status: 401 });
  const user = await getUser(userId);
  if (!user) return Response.json({ error: "no_user" }, { status: 404 });
  return Response.json({ email: user.email, name: user.name });
}
