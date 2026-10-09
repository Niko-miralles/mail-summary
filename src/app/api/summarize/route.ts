import { getSessionUser } from "@/lib/session";
import { getUser } from "@/lib/store";
import { processUserMail } from "@/lib/process";

export async function POST() {
  const userId = await getSessionUser();
  if (!userId) return Response.json({ error: "not_logged_in" }, { status: 401 });
  const user = await getUser(userId);
  if (!user) return Response.json({ error: "no_user" }, { status: 404 });
  const summaries = await processUserMail(user);
  return Response.json({ summaries });
}
