import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import type { Plugin } from "vite";
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

/**
 * I file di Shinka che nell'app hanno un sostituto: chi li importa riceve il nostro, che di solito
 * importa l'originale e gli aggiunge qualcosa. Così la copia sotto `shinka/` resta com'è (ADR 0007).
 */
const SOSTITUTI: Record<string, string> = {
  "shinka/web/src/Palette.tsx": "src/pagina/PaletteDesktop.tsx",
};

function sostituisci(): Plugin {
  const pulito = (percorso: string): string => resolve(percorso.split("?")[0] ?? percorso);
  const sostituti = new Map(Object.entries(SOSTITUTI).map(([originale, nostro]) => [resolve(qui, originale), resolve(qui, nostro)]));
  const nostri = new Set(sostituti.values());
  return {
    name: "shinka-desktop:sostituti",
    enforce: "pre",
    async resolveId(chiesto, da, opzioni) {
      // Il sostituto importa l'originale: a lui non si sostituisce nulla.
      if (da === undefined || nostri.has(pulito(da))) return null;
      const trovato = await this.resolve(chiesto, da, { ...opzioni, skipSelf: true });
      const nostro = trovato === null ? undefined : sostituti.get(pulito(trovato.id));
      return nostro ?? null;
    },
  };
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
    plugins: [sostituisci(), react()],
    build: {
      outDir: resolve(qui, "out/pagina"),
      emptyOutDir: true,
      rollupOptions: { input: resolve(qui, "src/pagina/index.html") },
    },
  },
});
