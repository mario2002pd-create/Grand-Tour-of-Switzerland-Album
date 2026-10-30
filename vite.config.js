import { defineConfig } from 'vite';
import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Carpetas de contenido que se sirven tal cual (no pasan por el bundler).
// En desarrollo Vite ya las sirve desde la raíz; al construir se copian a dist/.
const CARPETAS_ESTATICAS = ['data', 'img', 'fotos'];

function copiarContenido() {
  let outDir = 'dist';
  return {
    name: 'copiar-contenido',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      for (const carpeta of CARPETAS_ESTATICAS) {
        if (existsSync(carpeta)) {
          cpSync(carpeta, resolve(outDir, carpeta), { recursive: true });
        }
      }
    },
  };
}

export default defineConfig({
  base: '/Grand-Tour-of-Switzerland-Album/',
  publicDir: false,
  plugins: [copiarContenido()],
  server: { host: true },
  build: { target: 'es2020' },
});
