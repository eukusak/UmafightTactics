import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { Server } from 'node:http';
import { attachMultiplayer } from './server/index';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), { name: 'arena-multiplayer', configureServer(server) { if (server.httpServer instanceof Server) attachMultiplayer(server.httpServer); } }],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: { port: 5173, host: true },
});
