import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMusings, { rehypeFocusableBlocks } from './src/lib/remark-musings.mjs';

const apiPort = process.env.DEV_API_PORT || '4322';

function devRouting() {
  return {
    name: 'dev-routing',
    hooks: {
      'astro:config:setup'({ command, updateConfig }) {
        // Astro's slash guard runs before Vite's proxy, so disable it only for local development.
        if (command === 'dev') updateConfig({ trailingSlash: 'ignore' });
      },
    },
  };
}

function legacyDevRoutes() {
  return {
    name: 'legacy-dev-routes',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = new URL(request.url || '/', 'http://localhost');
        if (url.pathname === '/notes/stock-picker-experiment.html') {
          request.url = `/notes/stock-picker-experiment/${url.search}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  site: 'https://abhishekdoesstuff.com',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: false,
  integrations: [devRouting()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMusings],
      rehypePlugins: [rehypeFocusableBlocks],
      smartypants: false,
    }),
    syntaxHighlight: false,
  },
  vite: {
    plugins: [legacyDevRoutes()],
    server: {
      proxy: {
        '^/api(?:/|$)': `http://127.0.0.1:${apiPort}`,
        '/analytics.js': `http://127.0.0.1:${apiPort}`,
      },
    },
  },
  build: {
    format: 'directory',
    // Keep styles external to honor the site's strict Content Security Policy.
    inlineStylesheets: 'never',
  },
});
