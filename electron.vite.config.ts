import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const qui = import.meta.dirname;

/**
 * L'indirizzo del centro proposto al primo avvio. Racconta l'installazione del proprietario, quindi
 * non sta nel repository: lo dice un file accanto, ignorato da Git, o una variabile d'ambiente.
 */
function centroPredefinito(): string {
  const file = resolve(qui, "centro-predefinito.txt");
  return (process.env.SHINKA_DESKTOP_CENTRO ?? (existsSync(file) ? readFileSync(file, "utf8") : "")).trim();
}

const versione = (JSON.parse(readFileSync(resolve(qui, "package.json"), "utf8")) as { version: string }).version;

export default defineConfig({
  main: {
    build: {
      outDir: "out/principale",
      lib: { entry: resolve(qui, "src/principale/avvio.ts"), formats: ["es"], fileName: () => "avvio.js" },
    },
    define: {
      __CENTRO_PREDEFINITO__: JSON.stringify(centroPredefinito()),
      __VERSIONE__: JSON.stringify(versione),
    },
  },
  preload: {
    build: {
      outDir: "out/ponte",
      // Una pagina chiusa nella sandbox carica il suo ponte solo in CommonJS, e in un file solo.
      lib: { entry: resolve(qui, "src/ponte/ponte.ts"), formats: ["cjs"], fileName: () => "ponte.cjs" },
      externalizeDeps: false,
    },
  },
  renderer: {
    root: resolve(qui, "src/pagina"),
    publicDir: resolve(qui, "shinka/web/public"),
    plugins: [react()],
    build: {
      outDir: resolve(qui, "out/pagina"),
      emptyOutDir: true,
      rollupOptions: { input: resolve(qui, "src/pagina/index.html") },
    },
  },
});
