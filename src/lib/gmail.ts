import { google } from "googleapis";
import type { StoredUser } from "./store";
import { saveUser } from "./store";

export function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/api/auth/callback`,
  );
}

export const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export type NewMail = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  senderName: string;
};

function decodeHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string): string {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function senderName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+)"?\s*</);
  return (m ? m[1] : from).trim() || from;
}

export async function googleAuth(user: StoredUser) {
  const auth = oauthClient();
  auth.setCredentials({
    refresh_token: user.refreshToken,
    access_token: user.accessToken,
    expiry_date: user.accessTokenExpiry,
  });
  auth.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      user.accessToken = tokens.access_token;
      user.accessTokenExpiry = tokens.expiry_date ?? undefined;
      await saveUser(user);
    }
  });
  return auth;
}

export async function gmailClient(user: StoredUser) {
  return google.gmail({ version: "v1", auth: await googleAuth(user) });
}

export type FullMail = {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
};

function findBody(part: import("googleapis").gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  if (part.parts) {
    for (const p of part.parts) {
      const b = findBody(p);
      if (b) return b;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    const html = Buffer.from(part.body.data, "base64url").toString("utf8");
    return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

export async function fetchMailBody(user: StoredUser, id: string): Promise<FullMail> {
  const gmail = await gmailClient(user);
  const full = await gmail.users.messages.get({ userId: "me", id, format: "full" });
  const headers = full.data.payload?.headers as never[];
  return {
    id,
    from: decodeHeader(headers, "From"),
    to: decodeHeader(headers, "To"),
    subject: decodeHeader(headers, "Subject") || "(sin asunto)",
    date: decodeHeader(headers, "Date"),
    body: findBody(full.data.payload) || full.data.snippet || "",
  };
}

export async function fetchNewMail(user: StoredUser): Promise<NewMail[]> {
  const gmail = await gmailClient(user);
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread in:inbox -category:{promotions social updates forums}",
    maxResults: 10,
  });
  const messages = res.data.messages ?? [];
  const out: NewMail[] = [];
  for (const m of messages) {
    if (!m.id || m.id === user.lastCheckedMessageId) break;
    const full = await gmail.users.messages.get({
      userId: "me",
      id: m.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject"],
    });
    const from = decodeHeader(full.data.payload?.headers as never[], "From");
    out.push({
      id: m.id,
      from,
      senderName: senderName(from),
      subject: decodeHeader(full.data.payload?.headers as never[], "Subject") || "(sin asunto)",
      snippet: full.data.snippet ?? "",
    });
  }
  return out;
}

export async function markChecked(user: StoredUser, latestId?: string) {
  if (latestId) user.lastCheckedMessageId = latestId;
  await saveUser(user);
}
