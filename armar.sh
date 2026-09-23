#!/usr/bin/env sh
# Arma finora-tablero.html (la versión Artifact de Claude) a partir de src/.
# La versión web se arma con `node build.mjs`.
set -e
cd "$(dirname "$0")"
salida=finora-tablero.html
{
  cat src/00-cabeza.html
  echo '<style>'
  cat src/1[012]-*.css
  echo '</style>'
  echo '<div id="app"></div>'
  echo '<script src="https://cdn.jsdelivr.net/npm/preact@10.24.3/dist/preact.umd.js"></script>'
  echo '<script src="https://cdn.jsdelivr.net/npm/preact@10.24.3/hooks/dist/hooks.umd.js"></script>'
  echo '<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js"></script>'
  echo '<script>'
  echo '(function () {'
  cat src/2*.js
  echo '})();'
  echo '</script>'
} > "$salida"
echo "Listo: $salida ($(wc -c < "$salida") bytes)"
