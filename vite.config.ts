import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      minify: 'esbuild',
      cssMinify: true,
      cssCodeSplit: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          app: path.resolve(__dirname, 'app.html'),
          platform: path.resolve(__dirname, 'platform.html'),
        },
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react-vendor';
            if (id.includes('node_modules/react-router')) return 'react-router';
            if (id.includes('node_modules/lucide-react')) return 'lucide';
            if (id.includes('node_modules/@tanstack')) return 'tanstack';
            if (id.includes('node_modules/date-fns')) return 'date-fns';
            if (id.includes('node_modules/axios')) return 'axios';
            if (id.includes('node_modules/xlsx') || id.includes('node_modules/exceljs')) return 'excel';
            if (id.includes('node_modules/recharts') || id.includes('node_modules/chart')) return 'charts';
            if (id.includes('/marketing/')) return 'marketing-sections';
            if (id.includes('/seo/')) return 'seo';
            if (id.includes('/ui/')) return 'ui-components';
          },
        },
      },
      target: 'es2020',
      modulePreload: { polyfill: false },
      reportCompressedSize: false,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
