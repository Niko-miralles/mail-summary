import { oauthClient } from "@/lib/gmail";
import { getUser, saveUser } from "@/lib/store";
import { setSessionUser } from "@/lib/session";
import { google } from "googleapis";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  if (error || !code) {
    return Response.redirect(`${process.env.APP_URL}/?error=${encodeURIComponent(error || "no_code")}`);
  }
  const auth = oauthClient();
  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token && !tokens.access_token) {
    return Response.redirect(`${process.env.APP_URL}/?error=no_tokens`);
  }
  auth.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth });
  const info = await oauth2.userinfo.get();
  const userId = info.data.id!;
  const existing = await getUser(userId);
  await saveUser({
    userId,
    email: info.data.email ?? "",
    name: info.data.name ?? undefined,
    refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? "",
    accessToken: tokens.access_token ?? undefined,
    accessTokenExpiry: tokens.expiry_date ?? undefined,
    subscriptions: existing?.subscriptions ?? [],
    lastCheckedMessageId: existing?.lastCheckedMessageId,
    createdAt: existing?.createdAt ?? Date.now(),
  });
  await setSessionUser(userId);
  return Response.redirect(`${process.env.APP_URL}/`);
}
