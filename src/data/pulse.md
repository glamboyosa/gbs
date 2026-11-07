# Pulse: hearing what customers really think

The story of Pulse, a voice feedback product I designed and built, first launched in February 2026. Live at [pulseapp.click](https://www.pulseapp.click). Code: [github.com/glamboyosa/Pulse](https://github.com/glamboyosa/Pulse). Walkthrough: [36-second video](https://youtu.be/n0NAYKywunA).

## The one-minute version

Restaurants, salons and shops rarely hear what most customers think. Customers have plenty to say, but few fill in a form.

My bet is that far more will talk for 30 seconds if it takes one tap. So Pulse is a QR code on the table. The customer scans it, records a voice note in the browser and leaves. No app, no account.

The first version mostly stopped there: it recorded the notes, transcribed them and tagged a sentiment. That turned out to be the easy half. An owner with forty transcripts a week still has to read them all, and some of them are in Yoruba or Pidgin. Version 2 is the other half. Every note now arrives in English, translated if it was spoken in another language, summarised in one line and tagged with what it's about. An unhappy customer triggers an email straight away. Every Monday the owner gets up to three things to fix, each with how many people raised it and their own words.

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

## Built with

Next.js 16 with an Elysia API, Postgres with Drizzle, ElevenLabs for speech to text, GPT-5 mini through the AI SDK for translation and summaries, Cloudflare R2 for audio, Resend for email, Polar for payments, and Vercel for hosting.
