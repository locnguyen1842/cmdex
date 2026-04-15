import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import wails from "@wailsio/runtime/plugins/vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), wails("./bindings")],
  server: {
    port: 9245,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
