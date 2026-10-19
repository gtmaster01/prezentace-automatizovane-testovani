# Automatizované testování: kdo kliká, když všichni spí

Patnáctiminutová prezentace pro studenty VŠ o automatizovaném testování mobilních aplikací. HTML + Three.js v jednom souboru, funguje offline.

**Spuštění:** otevři `prezentace.html` dvojklikem (Chrome nebo Edge). F = celá obrazovka, N = poznámky a časomíra, H = nápověda.

**Video z praxe:** ulož ho jako `video/ukazka.mp4`, nebo ho na slidu 8 přetáhni myší do okna. Do gitu se video necommituje (`.gitignore`).

Podrobnosti: [`JAK-NA-TO.txt`](JAK-NA-TO.txt) (prezentování, časový plán), [`_zdroj/README.txt`](_zdroj/README.txt) (struktura a sestavení).

## Úpravy

- Texty a poznámky: `_zdroj/src/index.html`, pak `node _zdroj/build.mjs` (přegeneruje `prezentace.html`).
- Vzhled: `_zdroj/src/style.css`, 3D scény: `_zdroj/src/js/04-acts.js`.

## Licence třetích stran

Three.js (MIT) a písma Bricolage Grotesque a JetBrains Mono (SIL OFL 1.1). Texty licencí jsou v `_zdroj/vendor` a `_zdroj/fonts`.
