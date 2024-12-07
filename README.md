# Glamboyosa Personal Website

A modern, minimalist personal website built with Astro and React, featuring real-time Spotify playback status and elegant animations.

## Features

- 🎵 Real-time Spotify integration showing currently playing track
- 🔒 Secure authentication using Spotify PKCE flow
- 🎨 Dynamic color extraction from album artwork
- ✨ Smooth animations using Framer Motion
- 🌓 Custom font combinations (Lacquer, Inter, Rubik Marker Hatch)
- 🚀 Server-side rendering with Astro
- 🔄 Automatic token refresh handling
- 🎯 Redis caching for improved performance

## Tech Stack

- **Framework**: [Astro](https://astro.build)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Animations**: [Framer Motion](https://www.framer.com/motion)
- **Data Fetching**: [SWR](https://swr.vercel.app)
- **Database**: [Upstash Redis](https://upstash.com)
- **Deployment**: Docker & Vercel
- **Authentication**: Spotify OAuth 2.0 with PKCE

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Docker (optional)
- Spotify Developer Account

### Environment Variables

Copy the example environment file and update it with your credentials:
 
```bash
cp .env.example .env
```

You'll need to:
1. Create a Spotify application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a free Redis database at [Upstash](https://upstash.com)
3. Update the .env file with your credentials

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The site should now be running at http://localhost:4321

