import { getSessionUser } from "@/lib/session";
import { getUser, saveUser } from "@/lib/store";

export async function POST(request: Request) {
  const userId = await getSessionUser();
  if (!userId) return Response.json({ error: "not_logged_in" }, { status: 401 });
  const user = await getUser(userId);
  if (!user) return Response.json({ error: "no_user" }, { status: 404 });
  const body = (await request.json()) as { lang?: string };
  if (body.lang === "es" || body.lang === "en") {
    user.lang = body.lang;
    await saveUser(user);
  }
  return Response.json({ lang: user.lang ?? "es" });
}

export async function GET() {
  const userId = await getSessionUser();
  if (!userId) return Response.json({ error: "not_logged_in" }, { status: 401 });
  const user = await getUser(userId);
  if (!user) return Response.json({ error: "no_user" }, { status: 404 });
  return Response.json({ email: user.email, name: user.name, lang: user.lang ?? "es" });
}
