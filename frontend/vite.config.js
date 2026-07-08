import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Offline-first: precache the app shell (HTML/JS/CSS) so the editor can load
    // and run even with no network — refresh/restart while offline works. API and
    // WebSocket requests are never cached (they must hit the live backend).
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/collab/, /^\/socket\.io/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "CompileX — Collaborative IDE",
        short_name: "CompileX",
        theme_color: "#0a0a0f",
        background_color: "#0a0a0f",
        display: "standalone",
        icons: [{ src: "/x.png", sizes: "512x512", type: "image/png" }],
      },
      devOptions: { enabled: false }, // SW only in the production build
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          codemirror: [
            "@codemirror/lang-javascript",
            "@codemirror/lang-python",
            "@codemirror/lang-cpp",
            "@codemirror/lang-html",
            "@codemirror/lang-css",
            "@uiw/codemirror-theme-okaidia",
            "@uiw/codemirror-theme-github",
          ],
        },
      },
    },
  },
});
