import { kv } from "@vercel/kv";

export type StoredUser = {
  userId: string;
  email: string;
  name?: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiry?: number;
  lastHistoryId?: string;
  lastCheckedMessageId?: string;
  subscriptions: PushSubscriptionJSON[];
  createdAt: number;
};

export async function getUser(userId: string): Promise<StoredUser | null> {
  return kv.get<StoredUser>(`user:${userId}`);
}

export async function saveUser(user: StoredUser): Promise<void> {
  await kv.set(`user:${user.userId}`, user);
  await kv.sadd("users", user.userId);
}

export async function listUserIds(): Promise<string[]> {
  return kv.smembers("users");
}
