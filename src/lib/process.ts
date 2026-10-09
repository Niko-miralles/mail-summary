import { fetchNewMail, markChecked } from "./gmail";
import { summarizeMail } from "./ai";
import { sendPush } from "./push";
import type { StoredUser } from "./store";

export async function processUserMail(user: StoredUser): Promise<string[]> {
  const mails = await fetchNewMail(user);
  if (!mails.length) return [];
  // mails are newest-first from Gmail
  const summaries: string[] = [];
  for (const m of [...mails].reverse()) {
    const s = await summarizeMail(m);
    if (s === "SKIP" || !s) continue;
    summaries.push(s);
    await sendPush(user, m.senderName, s);
  }
  await markChecked(user, mails[0].id);
  return summaries;
}
