import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow access from other machines
    port: 5173,
  },
  // Remove optimizeDeps.exclude to allow Vite to properly bundle lucide-react
  // This prevents ad blockers from blocking the import
});
