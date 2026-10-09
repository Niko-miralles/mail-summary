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
    user.recentMails = [
      { id: m.id, senderName: m.senderName, from: m.from, subject: m.subject, summary: s },
      ...(user.recentMails ?? []),
    ].slice(0, 20);
    await sendPush(user, m.senderName, s, `/?mail=${m.id}`);
  }
  await markChecked(user, mails[0].id);
  return summaries;
}
