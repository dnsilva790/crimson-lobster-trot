import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api/todoist': {
        target: 'https://api.todoist.com/', // Adicionada barra final aqui
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/todoist/, ''),
        secure: true, // Use true for HTTPS targets
      },
    },
  },
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));