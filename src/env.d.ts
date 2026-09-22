/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
    readonly SPOTIFY_CLIENT_ID: string;
    readonly SPOTIFY_CLIENT_SECRET: string;
    readonly SPOTIFY_REFRESH_TOKEN: string;
    readonly STRAVA_CLIENT_ID: string;
    readonly STRAVA_CLIENT_SECRET: string;
    readonly STRAVA_ACCESS_TOKEN: string;
    readonly STRAVA_REFRESH_TOKEN: string;
    readonly STRAVA_SETUP_TOKEN: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
