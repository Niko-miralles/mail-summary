import { oauthClient, SCOPES } from "@/lib/gmail";


export async function GET() {
  const url = oauthClient().generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    include_granted_scopes: true,
  });
  return Response.redirect(url);
}
