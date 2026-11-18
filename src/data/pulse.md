# Pulse: hearing what customers really think

The story of Pulse, a voice feedback product I designed and built, first launched in February 2026. Live at [pulseapp.click](https://www.pulseapp.click). Code: [github.com/glamboyosa/Pulse](https://github.com/glamboyosa/Pulse). Walkthrough: [36-second video](https://youtu.be/n0NAYKywunA). Storyboard: [a café owner and a shop owner using it](/storyboards/pulse).

## The one-minute version

Restaurants, salons and shops rarely hear what most customers think. Customers have plenty to say, but few fill in a form.

My bet is that far more will talk for 30 seconds if it takes one tap. So Pulse is a QR code on the table. The customer scans it, records a voice note in the browser and leaves. No app, no account.

The first version mostly stopped there: it recorded the notes, transcribed them and tagged a sentiment. That turned out to be the easy half. An owner with forty transcripts a week still has to read them all, and some of them are in Yoruba or Pidgin. Version 2 is the other half. Every note now arrives in English, translated if it was spoken in another language, summarised in one line and tagged with what it's about. An unhappy customer triggers an email straight away. Every Monday the owner gets up to three things to fix, each with how many people raised it and their own words.

Version 3 takes the same recorder off the table and onto websites and apps. One script tag adds a Feedback button to any site, and a copy-paste component does the same in React Native. A note from a website arrives with the page it was left on, so "checkout is broken" comes with `/checkout` attached. Vouchers followed: an owner can thank a customer who leaves a note from a QR code with something like a free drink, which gives them a reason to come back.

## Who it's for

Two people use Pulse, and they want different things.

**The customer** has an opinion and about a minute. They won't download an app or make an account, and they may not want to write in English. For them, Pulse is one big record button. They can listen back and send. Their name and email are optional and asked for only after the recording, because asking first loses people before they start.

**The owner** runs a busy place and has no time for a dashboard they need to study. They want to know three things: is anyone unhappy right now, what keeps coming up, and is it getting better. Everything in v2 answers one of those.

## What the owner gets

- **Every note, in English.** Notes spoken in another language show the original next to an English translation. Every note gets a one-line summary, a few themes and a sentiment: happy, neutral or unhappy.
- **An alert when someone is unhappy.** It arrives as an email with the summary, while the customer may still be in the building.
- **A Monday list of what to fix.** Up to three issues, each with a count and a real quote.
- **Insights.** Sentiment over the last 30 days against the 30 before, and the themes that come up unhappy most often.
- **A QR code per table or branch.** Spots tag each note with where it came from, so "the patio is too hot" shows up as a patio problem.
- **Their own look.** Their question, logo, colour and thank-you message, plus a link to leave a Google review.
- **A way to reply.** If a customer leaves an email, the owner can answer once. Pulse sends it from the business's name, and the owner never sees the address unless the customer writes back.
- **Table tents to print.** One click gives a ready-to-fold A4 sheet for any QR code.

## Decisions that shaped it

**Voice first, typing as a fallback.** Typed feedback would be easier to build and easier to read, but a text box is the form people already skip. Typing only appears when the microphone is blocked or the browser can't record, and it's labelled so the owner knows.

**Pay per note, no subscription.** One voice note spends one "pulse". New businesses get 5 free, then buy packs. A small café that gets 20 notes a month pays for 20, and doesn't have to think about a plan.

**Any language, read in English.** The speech-to-text model detects the language instead of assuming English, then a second step translates and summarises. I tried it on Yoruba, Nigerian Pidgin, French and Portuguese, because those are languages customers in Lagos and beyond actually speak.

**Protect the customer's contact details.** Customers will share an email when they want an answer, but not to be added to a mailing list. So the business can reply without ever holding the address.

**Cheap protections first.** Replies are capped at 20 a day per business. Confirming the customer's address first would close that gap, but it adds friction for everyone. I wrote down when I'd add it, and didn't build it.

## Making it safe to sell

Before adding anything, I read the whole of v1 as if I were about to charge money for it. It worked, but it wasn't ready. The checkout trusted the price sent by the browser. Payment notifications could credit an account twice. Some pages showed one business's feedback to anyone who knew where to look. There were no automated tests.

So the order of work was fixed: safety first, then features, then design. Payments are now priced on the server and can't be counted twice. Every owner page checks who is asking. Two customers can't both spend a business's last pulse. And 166 automated tests run against a real database, plus browser tests that play a real recording through a fake microphone, in a desktop browser and an emulated Pixel 7.

## The redesign

Pulse kept its neobrutalist style: thick ink borders and hard shadows. This time it's a real system rather than a look copied from screen to screen. It is ink on paper with one yellow accent. Colour only appears where it means something: green, amber and red for how a customer felt, and red for errors.

The record button is big and round, with a live level meter so customers can see the microphone hears them. The landing page shows the product working, cycling through real-looking feedback in four languages. It shows the real pricing and makes no made-up claims.

## Launch

v2 relaunches on Product Hunt on 8 November 2026, with posts on X, LinkedIn and Reddit the same weekend. From 10 November I'm emailing restaurants, cafés and salons in Nigeria, the UK and the US, offering each the 5 free pulses.

What I'm watching next is simple: which owners come back every week, and what they do after an unhappy-customer alert.

## Version 3: websites and apps

A QR code only reaches people standing in the room. Plenty of businesses meet their customers on a website or in an app instead, and a checkout or booking page is exactly where people get stuck and leave without saying why.

Version 3 shipped between 11 and 14 November 2026:

- **A Feedback button for any site.** One `<script>` tag. The owner picks a label, a shape, a colour and a side of the screen. `auto` colour picks black or white, whichever contrasts with the page behind it.
- **Install code for each stack.** HTML, Next.js, React, Astro and Vue or Nuxt each have a snippet, and one more covers WordPress, Webflow and Framer, on [pulseapp.click/docs/widget](https://www.pulseapp.click/docs/widget).
- **Docs for coding agents.** [/agents.md](https://www.pulseapp.click/agents.md) is a setup guide written for an agent to follow, and `/llms.txt` lists the docs. The docs have a button that copies a ready-made prompt.
- **React Native.** A copy-paste `PulseFeedback` component opens the same recorder in a WebView inside a modal.
- **Context.** The site can pass who the visitor is and things like the app version. Pulse also records the page path and title. Owners see where each note was left.

Nothing new runs behind it. A widget note goes through the same bot check, storage, transcription and analysis as a QR code note, and spends the same pulse.

## Vouchers: a reason to come back

Hearing about a cold lunch is useful. Getting that customer back is better. Vouchers let an owner offer something small, like a free drink, to anyone who leaves a note from a QR code. Notes from the website widget don't earn vouchers yet.

The owner writes the offer (up to 80 characters), sets an expiry and a monthly cap. When a note is transcribed and counts as a real note, the customer gets a six-character code and a QR code. Staff redeem it at the till by scanning the QR code or typing the code.

One rule shaped everything: **a voucher rewards leaving feedback, whatever it says.** Vouchers never look at sentiment and never touch the Google review link. Rewarding only good feedback, or reviews, breaks the FTC's rule on fake reviews, UK consumer law and Google's own policy. The rule is written at the top of the vouchers code so nobody adds that later.

## Under the hood

The parts of the code I'd want to talk through with another engineer.

### One recording, one upload

The browser records with `MediaRecorder`. Browsers support different audio formats, so Pulse asks for the first one the browser can record: mp4, then webm, then ogg. The recorder hands over audio in chunks, and Pulse joins them into one file when recording stops:

```ts
const chunks: Array<Blob> = []
recorder.ondataavailable = (event) => {
  if (event.data.size > 0) chunks.push(event.data)
}
recorder.onstop = () => {
  const audio = new Blob(chunks, {
    type: (recorder.mimeType || mimeType || 'audio/webm').split(';')[0],
  })
  // The customer can listen back before sending.
}
```

There is no chunked or streaming upload. A note stops at two minutes and the server accepts up to 8 MB, so one upload is simpler and fails cleanly: either the whole note arrives or nothing does. If the browser can't record at all, the record button is replaced by a text box, and the note is labelled as typed.

### Two customers can't spend the last pulse

Every note spends one pulse. Checking the balance and then subtracting would let two notes arriving together both see "1 left". So the check and the spend are one statement:

```sql
update users set pulses_remaining = pulses_remaining - 1, updated_at = now()
where unique_code = ${code} and pulses_remaining > 0
returning id, email, business_name, pulses_remaining
```

No row back means no credit, and the note is refused before anything is stored. If the upload to R2 fails after the spend, the pulse is given back. A Cloudflare Turnstile check runs before all of this, so a bot costs no pulse, no storage and no AI call.

### Answer first, transcribe after

Transcription and analysis take seconds. The customer shouldn't wait for them. The API saves the note as `processing`, replies, and does the slow work with Next's `after()`:

```ts
after(() => processFeedback(feedbackId, business, { audio }))
```

Work that runs after the reply can die, for example when a deploy replaces the server. So each time the owner opens the dashboard, Pulse retries the newest note that has been stuck for over 10 minutes. A note that failed outright, often silence, is retried only when the owner opens it, so Pulse doesn't pay to transcribe silence twice. Claiming the note and counting the attempt happen in one statement, so two page loads can't start two runs:

```sql
update feedback set
  status = 'processing',
  analysis_attempts = analysis_attempts + 1,
  analysis_started_at = now()
where id = ${feedbackId}
  and (status <> 'ready' or (transcript is null and audio_key is not null))
  and analysis_attempts < ${MAX_ANALYSIS_RETRIES}
  and (status <> 'processing' or analysis_started_at < now() - interval '10 minutes')
returning audio_key
```

### One model call, with a schema and a fallback

ElevenLabs turns the audio into text and detects the language. Then one model call does everything else and must return this shape:

```ts
const analysisSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  customerName: z.string().nullable(),
  language: z.string(),
  englishTranslation: z.string().nullable(),
  summary: z.string(),
  themes: z.array(z.string()),
})
```

One call per note keeps the cost per pulse predictable. The prompt asks for the same plain theme names every time ("wait time", "food quality"), so the Insights tab can count them across notes. The same model runs on OpenAI first and OpenRouter second, each with its own timeout, so one provider being down doesn't leave notes unread:

```ts
for (const model of models) {
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema }),
      prompt,
      maxRetries: 1,
      abortSignal: AbortSignal.timeout(timeoutMs),
    })
    return output
  } catch (error) {
    lastError = error
  }
}
throw lastError
```

If analysis fails, the transcript is kept, so the owner can still read the note.

### Payments credited exactly once

Polar can send the same "order paid" event more than once. Recording the order and adding the pulses are one statement, keyed on Polar's order id:

```sql
with purchase as (
  insert into pulse_purchases (user_id, amount, price, stripe_payment_id, status)
  -- buyer: the owner, matched by account id or email
  select id, ${pulses}, ${order.totalAmount}, ${order.id}, 'completed' from buyer
  on conflict (stripe_payment_id) do nothing
  returning user_id, amount
)
update users set pulses_remaining = users.pulses_remaining + purchase.amount
from purchase
where users.id = purchase.user_id
```

A repeated event inserts nothing, so it adds nothing. The price comes from the server, never from the browser. A refund removes pulses in proportion to the amount refunded, and a repeated refund event removes nothing extra.

### The Monday digest, sent once

The digest cron runs twice on Mondays, so the second run picks up anyone the first missed. Each owner's week is claimed with a row before any work starts. A run that finds the row already claimed skips that owner. The email goes out with an idempotency key, so even a retry that gets as far as Resend sends one email:

```ts
await sendWeeklyDigestEmail({
  to: owner.email,
  businessName: owner.name,
  content,
  idempotencyKey: `weekly-digest/${owner.id}/${weekStart}`,
})
```

### A widget only the owner's sites can frame

`widget.js` adds a button to the owner's page. The recorder itself runs in an iframe served by Pulse, so the host page's scripts and styles can't reach it. The iframe page sends a `frame-ancestors` header built from the sites the owner listed, so nobody can put their recorder on another site. Turnstile and rate limits cover anyone calling the API directly:

```ts
export const embedHeaders = (origins: Array<string>) => ({
  'Content-Security-Policy': `frame-ancestors ${origins.length > 0 ? origins.join(' ') : "'none'"}`,
  'Permissions-Policy': 'microphone=(self), camera=(), geolocation=(), payment=()',
})
```

`widget.js` is about 5 KB gzipped. The iframe only loads when the visitor heads for it, so it's usually ready by the time they click:

```js
var warm = function () {
  if (!panel && !closing) build()
}
button.addEventListener('pointerenter', warm)
button.addEventListener('focus', warm)
button.addEventListener('touchstart', warm, { passive: true })
```

### Vouchers that are hard to farm

A free drink per note invites people to send ten notes. The limits are layered:

- A note has to be real: at least 5 seconds and 3 spoken words, or 20 typed characters.
- A voucher has to be claimed within an hour of sending.
- One voucher per browser per business every 30 days, remembered in a signed cookie, so it can't be forged.
- Deleting the cookie only gets you so far: a hashed IP allows three a day, set loose because customers in one café share the wifi.
- Codes skip 0, O, 1, I and L, because staff read them aloud and type them.

```ts
const browserToken = (businessId: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience('pulse-voucher')
    .setSubject(businessId)
    .setExpirationTime(`${BROWSER_WINDOW_DAYS}d`)
    .sign(cookieKey())
```

## Built with

Next.js 16 with an Elysia API, Postgres with Drizzle, ElevenLabs for speech to text, GPT-5 mini through the AI SDK for translation and summaries, Cloudflare R2 for audio, Cloudflare Turnstile for bot checks, Resend for email, Polar for payments, and Vercel for hosting.
