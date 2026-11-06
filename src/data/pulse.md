# Pulse v2: from voice notes to what to fix

Notes on rebuilding Pulse, the voice feedback app I designed and built, in November 2026. Live at [pulseapp.click](https://www.pulseapp.click). Code: [github.com/glamboyosa/Pulse](https://github.com/glamboyosa/Pulse). Walkthrough: [36-second video](https://youtu.be/n0NAYKywunA).

## The one-minute version

Customers rarely fill in feedback forms, but most will talk for 30 seconds if it takes one tap. Pulse puts a QR code on the table. The customer scans it, records a voice note in the browser, and leaves. No app, no account.

The first version recorded those notes and transcribed them. That was the easy half. An owner with forty transcripts still has to read them all, and half of them might be in Yoruba or Pidgin.

v2 is about the other half: turning voice notes into something an owner acts on. Every note now arrives transcribed in the language it was spoken, translated to English, summarised in one line and tagged with themes and sentiment. An unhappy customer triggers an email straight away. Every Monday the owner gets up to three things to fix, each with a count and a real quote.

Before any of that, I audited v1 and found it wasn't safe to sell. Anyone could buy any number of credits at a price they chose, and anyone could read any business's transcripts. So v2 started with security and tests, then features, then a redesign.

## What the audit found

I read the whole codebase before writing anything. The short list:

- **Billing could be gamed.** The custom checkout had no login check and took the price from the browser. The Polar webhook had no idempotency, so a retried delivery credited a pack twice. Refunds took back the whole pack, even for a partial refund.
- **Customer data was public.** Two endpoints returned any business's transcripts and audio links to anyone who passed a user ID. Transcription was an open, unlimited endpoint billed to my ElevenLabs and OpenAI keys.
- **Login was weak.** One-time codes came from `Math.random`, lived for about 20 minutes and had no attempt limit. The session secret fell back to a hard-coded default.
- **Recording was fragile.** Older Android Chrome couldn't record at all. Transcription was hard-coded to English. Errors were `alert()` boxes.
- **No tests, no CI**, and about a third of the repo was a dead copy of the app in another framework.

## Phase 1: safe to sell

- Checkout needs a session, and the server prices every pack and custom amount itself. The browser only says which pack.
- The webhook is idempotent: Polar's payment ID is unique in the purchases table, so a replayed event is a no-op. Partial refunds take back only the pulses they paid for.
- Every owner endpoint checks the session. The open transcription endpoint is gone; transcription only happens inside a feedback submission that has spent a pulse.
- Login codes come from `crypto`, expire in 10 minutes and allow 5 attempts. Session secrets shorter than 32 characters are rejected.
- One Postgres-backed rate limiter covers login, submissions, replies and the digest. It is a single upsert, so two concurrent requests can't both slip under the limit.
- Spending a pulse is one conditional update (`pulses_remaining > 0`), so two customers can't both spend the last pulse. If saving the feedback fails, the pulse goes back. A business with no credit is told so before the customer records, not after.

Then tests. Vitest runs against a real Postgres, not mocks: 166 tests across billing, auth, submission, replies, branding, the digest and account deletion. Playwright drives the full journey on desktop and a Pixel 7 profile. A fake microphone streams a real WAV file into the browser, so the real ElevenLabs and OpenAI calls run end to end.

## Phase 2: what owners pay for

I ranked features by one question: what makes an owner check Pulse every week?

1. **Any language.** ElevenLabs Scribe detects the language instead of assuming English. GPT-5 mini, through the AI SDK with an OpenRouter fallback, returns a structured result: English translation, a one-line summary, up to four themes and a sentiment. I ran it on real recordings and text in Yoruba, Nigerian Pidgin, French and Portuguese.
2. **Unhappy-customer alerts.** Negative feedback emails the owner at once, with the summary in the subject, while the customer may still be on site.
3. **Insights and the Monday digest.** Sentiment over the last 30 days against the 30 before, and themes ranked by how often they come up negative. A cron job writes a digest every Monday: up to three things to fix, each with a count and a quote.
4. **Spots.** Extra QR codes for a table, a branch or an event. Each one tags its feedback, and the dashboard filters by spot.
5. **Branding.** Owners set the question, logo, an accent colour, a thank-you message and a Google review link.
6. **A typed fallback.** Voice stays the default. Typing appears only when the microphone is refused or the browser can't record, and typed feedback is labelled so owners can tell the two apart.
7. **Print.** Table tents and sticker sheets for any QR code, laid out for A4 and the browser's Save as PDF.
8. **Close the loop.** A customer can leave an email after recording. The owner sends one reply from the dashboard. Pulse sends it from the business's name, and the owner never sees the address unless the customer writes back.
9. **Privacy basics.** Export everything as JSON, delete any feedback or the whole account, audio deleted after 12 months, a privacy page listing every sub-processor and a DPA template for business customers.

## Phase 3: the redesign

v1 called itself neobrutalist, but the look came from classes copied into every component, white shadows on a white page and three display fonts nobody used.

v2 keeps neobrutalism and makes it a system: design tokens for 2px ink borders and hard offset shadows, one display face (Bricolage Grotesque) and ink on paper with one yellow accent. Colour appears only where it means something: green, amber and red for sentiment, and red for errors. I checked the sentiment colours for contrast (5.6:1 and 5.4:1).

- **The recorder** is one big round button with a live level meter, so customers can see the mic is hearing them. Name and email come after the recording, never before it.
- **The landing page** shows the product working: a hero card that cycles through real-looking feedback in Pidgin, Yoruba, English and Portuguese. The pricing is the real pricing.
- **The dashboard** got a compact stats strip, sentiment pills and a little motion on the cards. Reduced motion is respected everywhere.
- **Link previews** have a 1200×630 image and a short video. LinkedIn's crawler gets the image without the video, because LinkedIn shows no image at all when `og:video` is present.

## Numbers

- 16 commits, about 14,600 lines added and 9,600 removed, including the dead framework copy.
- 7 database migrations, all applied to production.
- 166 Vitest tests against real Postgres, and 3 Playwright journeys on desktop and mobile.
- Pricing unchanged: one pulse per voice note, no subscription, 5 free to start.

## Stack

Next.js 16 (App Router) with an Elysia API mounted inside it. Postgres on Neon with Drizzle. ElevenLabs Scribe for speech to text. The AI SDK with GPT-5 mini and an OpenRouter fallback. Cloudflare R2 for audio, Resend for email, Polar for payments, and Vercel for hosting and crons.
