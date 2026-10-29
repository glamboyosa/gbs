import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  integrations: [tailwind(), react()],
  vite: {
    build: {
      // Inlined fonts would ship in every page's CSS instead of loading only when a page needs them.
      assetsInlineLimit: (filePath) => (filePath.endsWith('.woff2') ? false : undefined),
    },
  },
  output: 'server',
  adapter: vercel({
    webAnalytics: true,
    imageService: true,
    imagesConfig: {
      // Rotation images and book covers render at up to about 300 CSS px, so these cover 1x–3x screens.
      sizes: [320, 480, 640, 720, 960],
      formats: ['image/avif', 'image/webp'],
      // Source files are content-hashed by Astro, so a long cache is safe.
      minimumCacheTTL: 2678400,
    },
  }),
});