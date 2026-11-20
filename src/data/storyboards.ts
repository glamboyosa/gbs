export type StoryboardFrame = {
  tag: string
  caption: string
  alt: string
}

export type StoryboardStrip = {
  title: string
  premise: string
  frames: StoryboardFrame[]
}

export type Storyboard = {
  slug: string
  title: string
  description: string
  intro: string
  accent: string
  noindex: boolean
  notes?: { href: string; label: string }
  strips: StoryboardStrip[]
}

/** Frame images live at /images/storyboards/<slug>/<strip>-<frame>.svg, numbered from 1. */
export const frameSrc = (slug: string, strip: number, frame: number) =>
  `/images/storyboards/${slug}/${strip + 1}-${frame + 1}.svg`

export const storyboards: Storyboard[] = [
  {
    slug: 'pulse',
    title: 'Pulse storyboard',
    description: 'A café owner and a shop owner hear why customers leave, through voice notes on Pulse.',
    intro:
      'Pulse lets customers leave a voice note from a QR code, a website button or an app. Owners read what was said and what to fix.',
    accent: 'Yellow marks the voice note.',
    noindex: true,
    notes: { href: '/pulse', label: 'Read the product notes' },
    strips: [
      {
        title: 'Hearing why customers stop coming',
        premise:
          'Ada runs a café. Tunde, a regular, has a bad lunch and leaves a voice note instead of quietly never coming back.',
        frames: [
          {
            tag: 'Before',
            caption: 'Ada runs a busy café. Some regulars stop coming back, and nobody tells her why.',
            alt: 'Ada behind the counter wondering why customers don’t come back, next to an empty table.',
          },
          {
            tag: 'Setting up',
            caption: 'She prints Pulse table tents and puts one on every table. Each table can have its own QR code.',
            alt: 'A table tent with a QR code and the words “Talk to us” on table 4.',
          },
          {
            tag: 'With Pulse',
            caption: 'Tunde scans the code and talks for 20 seconds, in Pidgin. No app, no account, no form.',
            alt: 'Tunde holding a phone with a yellow record button and a 20-second waveform.',
          },
          {
            tag: 'With Pulse',
            caption:
              'Ada gets an “Unhappy customer” email. The dashboard shows his words, an English translation and a one-line summary.',
            alt: 'A laptop showing an unhappy-customer card with the translated quote and a play button, and an email icon.',
          },
          {
            tag: 'After',
            caption:
              'Monday’s digest lists up to three things to fix, with quotes. Slow lunch service is top. She adds a second cook at noon.',
            alt: 'A Monday digest ranking slow lunch service first, leading to a second cook from 12:00 to 14:00.',
          },
          {
            tag: 'After',
            caption:
              'Tunde got a voucher for leaving a note, whatever it said. Next week he’s back, and staff scan it at the till.',
            alt: 'A phone showing a free-drink voucher with a code and QR code, scanned by a member of staff.',
          },
        ],
      },
      {
        title: 'Feedback from the page where it happened',
        premise:
          'Kemi runs an online shop. Her customers know what’s wrong; her support inbox only hears “it’s broken”.',
        frames: [
          {
            tag: 'Before',
            caption: 'Support emails say “checkout is broken” and nothing else. Kemi can’t reproduce it.',
            alt: 'A checkout page with a support email that only says “checkout is broken”.',
          },
          {
            tag: 'Setting up',
            caption:
              'She pastes one script tag, or hands pulseapp.click/agents.md to her coding agent. Her app gets the React Native component.',
            alt: 'The Pulse widget script tag, a coding agent reading agents.md, and a phone for the React Native app.',
          },
          {
            tag: 'With Pulse',
            caption: 'A shopper taps Feedback on the checkout page and says the coupon field wipes her address.',
            alt: 'The checkout page with the Feedback button open and a yellow record button.',
          },
          {
            tag: 'After',
            caption: 'Kemi sees the note with the page it came from. She fixes the coupon bug that afternoon.',
            alt: 'A dashboard note tagged “Left at /checkout” with the shopper’s quote, marked fixed the same day.',
          },
        ],
      },
    ],
  },
  {
    slug: 'firms',
    title: 'FIRMS storyboard',
    description: 'How a rebuilt wildfire data pipeline gave a programme team fire counts they can trust.',
    intro:
      'A conservation dashboard shows fires around the territories a programme team supports, from NASA satellite detections. I rebuilt the pipeline behind it.',
    accent: 'Orange marks a fire detection. Territory names are placeholders.',
    noindex: true,
    strips: [
      {
        title: 'Fire counts a programme team can trust',
        premise:
          'Mara, a programme officer, reports on fires around the territories her team supports. The numbers come from NASA satellite detections, through the dashboard’s fire pipeline.',
        frames: [
          {
            tag: 'Before',
            caption:
              'Mara is writing the yearly fire report for Test Territory 130. The dashboard’s fire count looks far too high.',
            alt: 'Mara looking at a bar chart of fires that climbs too steeply.',
          },
          {
            tag: 'Before',
            caption:
              'The old pipeline appended every load with no unique key, so most fires were stored two or three times. Charts showed about 3× the real count.',
            alt: 'Fire dots stacked in threes under a magnifying glass, labelled ×3.',
          },
          {
            tag: 'Before',
            caption:
              'A new territory joins and its chart is empty. The old pipeline deleted every fire outside the territories it already knew.',
            alt: 'A new territory outline beside an empty chart, and fire dots dropped into a bin.',
          },
          {
            tag: 'Rebuilt',
            caption:
              'The rebuilt pipeline stores each fire detection exactly once: 124.5 million of them. Each load is one transaction, and loading a file twice changes nothing.',
            alt: 'A satellite sending fire detections into a database holding 124.5 million rows, one row per fire.',
          },
          {
            tag: 'Rebuilt',
            caption:
              'Adding Test Territory 131 takes one recompute, about 24 minutes, with no CSV downloads. Its fire history back to 2019 appears.',
            alt: 'A territory with a dashed 10 km buffer and fires inside it, and a terminal running firms recompute in 24 minutes.',
          },
          {
            tag: 'After',
            caption:
              'Mara’s yearly counts are right now: each fire counted once, matching the old data with its duplicates removed, year by year. The daily update takes 2 minutes.',
            alt: 'Mara beside a chart marked “counted once” and a terminal showing the 7-day load in 2 minutes.',
          },
        ],
      },
      {
        title: 'Two weeks later: the week the fires went quiet',
        premise:
          'On 2 November 2026 NASA stopped producing the satellite feed the daily job downloaded. Nothing crashed. The chart just showed fewer fires.',
        frames: [
          {
            tag: 'Before',
            caption:
              'Early November. Mara’s 7-day chart shows fires for a few days, then nothing. In fire season, zero looks like good news.',
            alt: 'A 7-day chart with three bars followed by four days of zero, and Mara asking “Quiet week?”.',
          },
          {
            tag: 'Before',
            caption:
              'It wasn’t quiet. NASA retired the Suomi NPP feed. The file kept arriving with only older days, and the recompute counted the new days as zero.',
            alt: 'A crossed-out satellite and a 7-day file where only the first three days have fires.',
          },
          {
            tag: 'Fixed',
            caption:
              'The fix downloads NASA’s NOAA-20 file, with the same columns. And a file whose newest fire is more than two days old now fails the job instead of loading.',
            alt: 'The NOAA-20 satellite and a terminal where the 7-day load fails because its newest detection is 3 days old.',
          },
          {
            tag: 'After',
            caption:
              'Fires reappear on the chart. If a feed ever stalls again, the team sees a failed job to fix, not a quiet week that never happened.',
            alt: 'A full 7-day chart with fires every day, and a note that a stale file fails the job.',
          },
        ],
      },
    ],
  },
  {
    slug: 'katalepsis',
    title: 'katalepsis storyboard',
    description: 'How katalepsis makes a coding agent prove its UI work in a real browser.',
    intro:
      'katalepsis is an open source tool that checks frontend work in a real browser against a preview deployment and writes an evidence report.',
    accent: 'Blue marks evidence the browser produced.',
    noindex: true,
    strips: [
      {
        title: 'Proof before “it works”',
        premise:
          'Sam reviews pull requests written by a coding agent. The agent says the UI change works; katalepsis makes it show the evidence.',
        frames: [
          {
            tag: 'Before',
            caption: 'A coding agent finishes a UI change. Build, types and tests pass, so it reports: everything works.',
            alt: 'A terminal with passing build, typecheck and tests, and an agent saying “Done. Everything works.”',
          },
          {
            tag: 'Before',
            caption: 'Sam opens the preview. A cookie banner covers the Save button. No check ever clicked it.',
            alt: 'A preview page where a cookie banner covers the Save button, and Sam reacting.',
          },
          {
            tag: 'With katalepsis',
            caption:
              'This time the agent runs katalepsis verify, with checks written in plain English: what to try and what passing looks like.',
            alt: 'A terminal running katalepsis verify and a check: Save keeps the new name after a refresh.',
          },
          {
            tag: 'With katalepsis',
            caption:
              'A model drives a real browser against the preview. It can click, type and run assertions. It can’t declare the result.',
            alt: 'An agent clicking Save in a browser, with click, type and assert allowed and “decide result” crossed out.',
          },
          {
            tag: 'With katalepsis',
            caption:
              'Its verdict is only a claim. A plain function checks it: a pass counts only if it cites assertions katalepsis ran, compared with an untouched copy of the page.',
            alt: 'The model’s claim and the browser evidence feeding decideOutcome, which returns passed, failed or blocked.',
          },
          {
            tag: 'After',
            caption:
              'Sam opens the report in the pull request: screenshot, video and trace behind each check. The agent fixes the banner before anyone merges.',
            alt: 'A katalepsis report with screenshot, video and trace, one failed check, one passed and one not tested.',
          },
        ],
      },
    ],
  },
]
