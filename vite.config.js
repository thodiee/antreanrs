import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Mengizinkan akses dari semua interface jaringan (LAN & Wi-Fi)
    port: 3000,       // Kunci di port 3000
    strictPort: true, // Pastikan selalu di port 3000 (tidak berpindah-pindah port)
    cors: true,       // Izinkan akses antar perangkat jaringan
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3001',
        ws: true,
      },
      '/videos': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
