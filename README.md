# Mail Summary

Web app (PWA) que resume tus emails de Gmail con IA y te los manda como notificaciones push, en vez de las notificaciones normales de Gmail.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Google OAuth (scope `gmail.readonly`) — flow manual en `src/app/api/auth/*`
- Gmail API (`googleapis`) para los no leídos del inbox
- Claude (`@anthropic-ai/sdk`) para los resúmenes de una frase
- Web Push (`web-push` + `public/sw.js`) para las notificaciones
- Vercel KV como storage (tokens OAuth, suscripciones push, último mensaje visto)
- Vercel Cron cada 5 min → `GET /api/cron`

## Env vars

Ver `.env.example`. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` debe ser la clave pública VAPID.

## Flujo

1. Login con Google → guarda refresh token en KV, cookie firmada como sesión
2. El usuario activa notificaciones (Push API) → suscripción guardada en KV
3. El cron (o el botón "Resumir no leídos ahora") mira `is:unread` sin newsletters, resume cada email nuevo con Claude y manda push
