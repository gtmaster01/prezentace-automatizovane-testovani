ZDROJÁKY PREZENTACE
===================

  src/index.html        slidy (texty, poznámky) + místa pro vložení CSS a JS
  src/style.css         vzhled, typografie, animace textu
  src/js/01-util.js     pomocné funkce (easing, pružina kamery)
  src/js/02-engine.js   Three.js: renderer, obloha, prach, bloom, kamera, popisky
  src/js/03-phone.js    3D telefon a simulovaná bankovní aplikace na displeji
  src/js/04-acts.js     3D scéna každého slidu („akty“)
  src/js/05-deck.js     přepínání slidů, klávesy, video, poznámky
  src/js/06-main.js     start
  fonts/                písma (SIL Open Font License)
  vendor/               Three.js r186 jako jeden minifikovaný soubor (MIT)

SESTAVENÍ
  node build.mjs
  Vytvoří ../prezentace.html (stačí Node 18+, žádné balíčky).
  Pozor: přepíše prezentace.html, ruční úpravy dělej v src/index.html.

NOVÝ VENDOR (jen při změně verze Three.js nebo doplňků)
  npm i three esbuild
  npx esbuild vendor/vendor-entry.js --bundle --format=iife --global-name=THREE \
      --minify --legal-comments=none --outfile=vendor/three-vendor.min.js
