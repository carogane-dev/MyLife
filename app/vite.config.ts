import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Nécessaire pour accéder au serveur de dev via un tunnel (nom d'hôte
    // différent de localhost/l'IP locale) : uniquement pour le développement.
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
