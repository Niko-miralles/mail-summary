import { createClient, type RedisClientType } from "redis";

export type StoredUser = {
  userId: string;
  email: string;
  name?: string;
  refreshToken: string;
  accessToken?: string;
  accessTokenExpiry?: number;
  lastCheckedMessageId?: string;
  subscriptions: PushSubscriptionJSON[];
  recentMails?: StoredMail[];
  createdAt: number;
};

export type StoredMail = {
  id: string;
  senderName: string;
  from: string;
  subject: string;
  summary: string;
  internalDate?: number;
};

let clientPromise: Promise<RedisClientType> | null = null;

function redis(): Promise<RedisClientType> {
  if (!clientPromise) {
    const url =
      process.env.KV_REST_API_REDIS_URL ||
      process.env.STORAGE_URL ||
      process.env.REDIS_URL;
    if (!url) throw new Error("Redis URL env var not set");
    const c = createClient({ url });
    c.on("error", () => {});
    clientPromise = c.connect() as Promise<RedisClientType>;
  }
  return clientPromise;
}

export async function getUser(userId: string): Promise<StoredUser | null> {
  const c = await redis();
  const raw = await c.get(`user:${userId}`);
  return raw ? (JSON.parse(raw) as StoredUser) : null;
}

export async function saveUser(user: StoredUser): Promise<void> {
  const c = await redis();
  await c.set(`user:${user.userId}`, JSON.stringify(user));
  await c.sAdd("users", user.userId);
}

export async function listUserIds(): Promise<string[]> {
  const c = await redis();
  return c.sMembers("users");
}
