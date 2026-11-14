import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const officeCdn = "https://officeapis.public.onecdn.static.microsoft"

export default defineConfig(({ command, isPreview }) => {
  const development = command === "serve" && !isPreview
  const certPath = process.env.WRITING_STUDIO_WORD_CERT
  const keyPath = process.env.WRITING_STUDIO_WORD_KEY
  if (command === "serve" && !(certPath && keyPath)) {
    throw new Error("Set WRITING_STUDIO_WORD_CERT and WRITING_STUDIO_WORD_KEY to your localhost HTTPS certificate and key paths.")
  }
  const https = command === "serve" && certPath && keyPath
    ? { cert: readFileSync(certPath), key: readFileSync(keyPath) }
    : undefined
  const serve = {
    host: "localhost",
    port: 3001,
    strictPort: true,
    https,
    cors: false,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": [
        "default-src 'none'",
        `script-src 'self' ${officeCdn}${development ? " 'unsafe-inline'" : ""}`,
        `connect-src 'self' ${officeCdn}${development ? " wss://localhost:3001" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "worker-src 'self' blob:",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com https://*.office365.com https://*.microsoft365.com https://*.office.net https://*.cloud.microsoft",
      ].join("; "),
    },
  }
  return {
    root: import.meta.dirname,
    publicDir: false,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": resolve(import.meta.dirname, "../src") },
      dedupe: ["react", "react-dom"],
    },
    server: serve,
    preview: serve,
    worker: { format: "es" },
    build: { target: "safari18", sourcemap: false },
  }
})
