import Anthropic from "@anthropic-ai/sdk";
import type { NewMail } from "./gmail";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

export async function summarizeMail(mail: NewMail, lang: "es" | "en" = "es"): Promise<string> {
  const prompt =
    lang === "en"
      ? `Summarize this email in ONE short notification-style sentence in English ("Kitty texted: meeting tomorrow at 7"). No quotes, no preamble. If it looks like spam/automated noise reply only "SKIP".

From: ${mail.from}
Subject: ${mail.subject}
Snippet: ${mail.snippet}`
      : `Resume este email en UNA frase corta en español, estilo notificación ("Kitty te escribió: quedamos mañana a las 7"). Sin comillas, sin preámbulo. Si parece spam/automático sin interés responde solo "SKIP".

De: ${mail.from}
Asunto: ${mail.subject}
Extracto: ${mail.snippet}`;
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 120,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return text;
}
