import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

export default defineConfig({
  integrations: [tailwind(), react()],
  output: 'server',
  adapter: vercel({
    webAnalytics: true,
    imageService: true,
    imagesConfig: {
      // Rotation images render at roughly 240–300 CSS px, so these cover 1x–3x screens.
      sizes: [320, 480, 640, 720, 960],
      formats: ['image/avif', 'image/webp'],
      // Source files are content-hashed by Astro, so a long cache is safe.
      minimumCacheTTL: 2678400,
    },
  }),
});