import webpush from "web-push";
import type { StoredUser } from "./store";
import { saveUser } from "./store";

let configured = false;
function ensure() {
  if (!configured) {
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_MAILTO || "admin@example.com"}`,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    configured = true;
  }
}

export async function sendPush(user: StoredUser, title: string, body: string) {
  ensure();
  const payload = JSON.stringify({ title, body });
  const dead: string[] = [];
  await Promise.all(
    user.subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub as never, payload);
      } catch (e: unknown) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(sub.endpoint!);
      }
    }),
  );
  if (dead.length) {
    user.subscriptions = user.subscriptions.filter((s) => !dead.includes(s.endpoint!));
    await saveUser(user);
  }
}
