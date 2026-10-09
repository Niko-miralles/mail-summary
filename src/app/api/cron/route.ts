import { listUserIds, getUser } from "@/lib/store";
import { processUserMail } from "@/lib/process";
import { maybeSendCalendarDigest } from "@/lib/digest";
import { NextRequest } from "next/server";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const ids = await listUserIds();
  const results: Record<string, number | string> = {};
  for (const id of ids) {
    try {
      const user = await getUser(id);
      if (!user) continue;
      const digest = await maybeSendCalendarDigest(user).catch(() => false);
      results[id] = `${(await processUserMail(user)).length} mails${digest ? ", digest" : ""}`;
    } catch (e) {
      results[id] = `error: ${(e as Error).message}`;
    }
  }
  return Response.json({ results });
}
