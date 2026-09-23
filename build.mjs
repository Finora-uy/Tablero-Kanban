// Arma la versión web del tablero en dist/index.html (sin dependencias).
// Vercel lo corre en cada deploy; en tu compu: `node build.mjs`.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const src = join(raiz, 'src');
const leer = f => readFileSync(join(src, f), 'utf8');
const archivos = readdirSync(src).sort();

// Variables de entorno: las inyecta la integración de Supabase en Vercel.
// Para probar en tu compu, podés crear un .env.local (no se sube a GitHub).
function leerEnv(archivo) {
  if (!existsSync(archivo)) return {};
  const vars = {};
  for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) vars[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return vars;
}
const env = { ...leerEnv(join(raiz, '.env.local')), ...process.env };
const primera = (...nombres) => nombres.map(n => env[n]).find(v => v && v.trim()) || '';
// Solo claves públicas (anon / publishable). Nunca la service_role.
const config = {
  url: primera('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL'),
  anonKey: primera('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'),
};
if (/service_role/.test(config.anonKey)) throw new Error('La clave configurada es la service_role. Usá la anon o publishable.');

const css = archivos.filter(f => /^1\d-.*\.css$/.test(f)).map(leer).join('\n');
const js = archivos.filter(f => /^(2\d|3\d)-.*\.js$/.test(f) && f !== '29-arranque-claude.js').map(leer).join('\n');
const cabeza = leer('00-cabeza.html');
const chispa = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-6 -6 60 60'><path fill='#C0843A' d='M24 2C24 15.486 32.514 24 46 24C32.514 24 24 32.514 24 46C24 32.514 15.486 24 2 24C15.486 24 24 15.486 24 2Z'/></svg>`;
const configJS = JSON.stringify(config).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Tablero Kanban del equipo de Finora: tareas, hitos y avance del proyecto final.">
<meta name="theme-color" content="#07132F">
<meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(chispa)}">
${cabeza}
<style>
[hidden] { display: none !important; }
img { max-width: 100%; }
${css}
</style>
</head>
<body>
<div id="app"></div>
<script src="https://cdn.jsdelivr.net/npm/preact@10.24.3/dist/preact.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/preact@10.24.3/hooks/dist/hooks.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/dist/umd/supabase.js"></script>
<script>window.FINORA_CONFIG = ${configJS};</script>
<script>
(function () {
${js}
})();
</script>
</body>
</html>
`;

mkdirSync(join(raiz, 'dist'), { recursive: true });
writeFileSync(join(raiz, 'dist', 'index.html'), html);
console.log(`Listo: dist/index.html (${Buffer.byteLength(html)} bytes)`);
console.log(config.url && config.anonKey
  ? `Conectado a Supabase: ${config.url}`
  : 'Sin variables de Supabase: la web arranca en modo local (solo este navegador).');
