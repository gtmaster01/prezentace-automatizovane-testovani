/* ==========================================================================
   START — typografie, 3D (když jde), řadič prezentace
   ========================================================================== */

// Starší prohlížeče bez roundRect na canvasu (např. Firefox ESR 102)
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    r = Math.min(typeof r === 'number' ? r : r[0] || 0, w / 2, h / 2);
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

/** Česká typografie: jednopísmenné předložky a spojky nezůstanou na konci řádku. */
function czechTypography(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const NBSP = String.fromCharCode(160);
  // bez lookbehind kvůli starším prohlížečům; dva průchody kvůli „a v …“
  const re = new RegExp('(^|[\\s' + NBSP + '(„])([ksvzouaiKSVZOUAI])[ \\t\\n]+', 'g');
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement.closest('pre, code, script, style')) continue;
    n.nodeValue = n.nodeValue.replace(re, '$1$2' + NBSP).replace(re, '$1$2' + NBSP);
  }
}

/** Nadpis s [data-split] se rozdělí na slova, která vyjíždějí zpod masky. */
function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of child.nodeValue.split(/([ \t\n\r]+)/)) {
          if (!part) continue;
          if (/^[ \t\n\r]+$/.test(part)) {
            frag.appendChild(document.createTextNode(' '));
            continue;
          }
          const w = document.createElement('span');
          w.className = 'w';
          const wi = document.createElement('span');
          wi.className = 'wi';
          wi.style.setProperty('--d', i++);
          wi.textContent = part;
          w.appendChild(wi);
          frag.appendChild(w);
        }
        node.replaceChild(frag, child);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        walk(child);
      }
    }
  };
  walk(el);
}

(function main() {
  const stage = document.getElementById('stage');
  czechTypography(stage);
  stage.querySelectorAll('[data-split]').forEach(splitWords);

  let engine = null;
  try {
    engine = new Engine(document.getElementById('gl'));
  } catch (err) {
    console.warn('3D scéna není k dispozici, prezentace poběží bez ní.', err);
    document.body.classList.add('no-webgl');
  }

  const boot = () => {
    if (engine) {
      try {
        engine.build();
        engine.start();
      } catch (err) {
        console.error(err);
        document.body.classList.add('no-webgl');
        engine = null;
      }
    }
    window.deck = new Deck(engine);
    window.engine = engine;
    requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('gl-ready')));
  };

  // textury telefonu a panelů se kreslí písmem, takže musí být načtené
  const fonts = document.fonts
    ? Promise.all([
        document.fonts.load('700 40px "Bricolage Grotesque"'),
        document.fonts.load('400 28px "Bricolage Grotesque"'),
        document.fonts.load('500 34px "JetBrains Mono"'),
      ])
    : Promise.resolve();
  let booted = false;
  const once = () => {
    if (booted) return;
    booted = true;
    boot();
  };
  fonts.then(once, once);
  setTimeout(once, 2500); // pojistka, kdyby se písmo nenačetlo
})();
