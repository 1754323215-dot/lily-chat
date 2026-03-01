import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://139.129.194.84:8083',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://139.129.194.84:8083',
        ws: true,
      },
    },
  },
});
