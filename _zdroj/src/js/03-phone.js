/* ==========================================================================
   TELEFON — 3D model a simulovaná bankovní aplikace na displeji
   Displej je 2D canvas (návrh v souřadnicích 600 × 1290) použitý jako
   textura. Celý průchod testem je čistá funkce času t ∈ <0, FLOW_LEN),
   takže se s ním dá synchronizovat kód na slidu 6 i impulzy na slidu 5.
   ========================================================================== */

const FLOW_LEN = 9.6;
/** Klepnutí robota: čas a místo na displeji. */
const TAPS = [
  { t: 1.25, x: 100, y: 600 }, // dlaždice „Platba“
  { t: 2.3, x: 300, y: 316 }, // pole „Na účet“
  { t: 3.9, x: 300, y: 486 }, // pole „Částka“
  { t: 5.05, x: 300, y: 1136 }, // „Odeslat platbu“
  { t: 8.15, x: 300, y: 1136 }, // „Hotovo“
];
/** Kroky testu (shodné s runStep na slidu 6): [začátek, konec). */
const FLOW_STEPS = [
  [0.6, 1.8],
  [1.8, 4.6],
  [4.6, 5.95],
  [5.95, 7.6],
];
const FLOW_DONE = 7.6;
const ACCOUNT = '123456789/0300';
/** Dráha „prstu“ robota: [čas, x, y, viditelnost]. */
const FINGER = [
  [0.0, 560, 1360, 0], [0.55, 400, 860, 1], [1.12, 100, 600, 1], [1.5, 100, 600, 1],
  [2.05, 300, 316, 1], [3.45, 300, 316, 1], [3.8, 300, 486, 1], [4.5, 300, 486, 1],
  [4.92, 300, 1136, 1], [5.3, 300, 1136, 1], [5.9, 480, 960, 0], [7.5, 480, 960, 0],
  [7.98, 300, 1136, 1], [8.4, 300, 1136, 1], [9.05, 560, 1360, 0], [9.6, 560, 1360, 0],
];

const APP = {
  bg: '#0a1124',
  card: '#141d3a',
  card2: '#1b2649',
  line: 'rgba(150,170,255,0.16)',
  text: '#eef2ff',
  muted: '#8f9bc8',
  blue: '#3f7bff',
  green: '#33d985',
};
const APP_FONT = '"Bricolage Grotesque", "Segoe UI", sans-serif';

class PhoneScreen {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 500;
    this.canvas.height = 1075;
    this.ctx = this.canvas.getContext('2d');
    this.texture = canvasTexture(this.canvas);
  }

  /* --- kreslicí pomůcky --- */
  font(w, s) {
    this.ctx.font = `${w} ${s}px ${APP_FONT}`;
  }
  text(str, x, y, w, s, color, align = 'left') {
    const c = this.ctx;
    this.font(w, s);
    c.fillStyle = color;
    c.textAlign = align;
    c.fillText(str, x, y);
  }
  rr(x, y, w, h, r, fill, stroke, lw = 2) {
    const c = this.ctx;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }
  circle(x, y, r, fill) {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  }
  /** Fajfka kreslená postupně (p = 0..1). */
  check(cx, cy, p, scale = 1, color = APP.green, lw = 12) {
    if (p <= 0) return;
    const c = this.ctx;
    const P = [[-58, 2], [-16, 44], [62, -42]];
    const L1 = Math.hypot(42, 42), L2 = Math.hypot(78, 86);
    const d = p * (L1 + L2);
    c.save();
    c.translate(cx, cy);
    c.scale(scale, scale);
    c.strokeStyle = color;
    c.lineWidth = lw / scale;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(P[0][0], P[0][1]);
    if (d <= L1) {
      const k = d / L1;
      c.lineTo(lerp(P[0][0], P[1][0], k), lerp(P[0][1], P[1][1], k));
    } else {
      const k = (d - L1) / L2;
      c.lineTo(P[1][0], P[1][1]);
      c.lineTo(lerp(P[1][0], P[2][0], k), lerp(P[1][1], P[2][1], k));
    }
    c.stroke();
    c.restore();
  }

  /** Překreslí displej; mode = 'flow' (běžící test) nebo 'final' (závěr). */
  draw(mode, t) {
    const c = this.ctx;
    c.setTransform(500 / 600, 0, 0, 500 / 600, 0, 0);
    c.globalAlpha = 1;
    c.textBaseline = 'alphabetic';
    if (mode === 'final') this.drawFinal(t);
    else this.drawFlow(t);
    this.drawStatus();
    this.texture.needsUpdate = true;
  }

  drawFlow(t) {
    const c = this.ctx;
    const toForm = ease.inOutCubic(inv(1.3, 1.72, t));
    const toOk = ease.outCubic(inv(5.92, 6.3, t));
    const back = ease.inOutCubic(inv(8.22, 8.62, t));
    if (t < 5.92) {
      // domovská obrazovka → formulář (formulář přijede zprava)
      if (toForm < 1) {
        c.save();
        c.translate(-toForm * 180, 0);
        this.drawHome(t);
        c.restore();
      }
      if (toForm > 0) {
        c.save();
        c.translate((1 - toForm) * 600, 0);
        c.shadowColor = 'rgba(0,0,0,0.6)';
        c.shadowBlur = 40;
        c.fillStyle = APP.bg;
        c.fillRect(0, 0, 600, 1290);
        c.shadowBlur = 0;
        this.drawForm(t);
        c.restore();
      }
    } else if (t < 8.22) {
      // formulář → potvrzení
      if (toOk < 1) this.drawForm(t);
      c.save();
      c.globalAlpha = toOk;
      this.drawSuccess(t);
      c.restore();
    } else {
      // potvrzení → zpět domů
      this.drawSuccess(t);
      c.save();
      c.globalAlpha = back;
      c.translate(0, (1 - back) * 50);
      this.drawHome(t);
      c.restore();
    }
    this.drawFinger(t);
  }

  drawHome(t) {
    const c = this.ctx;
    c.fillStyle = APP.bg;
    c.fillRect(0, 0, 600, 1290);
    this.text('Dobrý den', 48, 172, 700, 46, APP.text);
    this.text('Vítejte zpět', 48, 214, 400, 27, APP.muted);
    this.circle(528, 160, 38, APP.card2);
    this.circle(528, 148, 12, '#6f7fb6');
    c.beginPath();
    c.arc(528, 184, 21, Math.PI, 0);
    c.fill();

    // karta účtu
    const g = c.createLinearGradient(40, 250, 560, 490);
    g.addColorStop(0, '#2f5cff');
    g.addColorStop(1, '#1597c9');
    this.rr(40, 252, 520, 236, 34, g);
    c.save();
    c.beginPath();
    c.roundRect(40, 252, 520, 236, 34);
    c.clip();
    this.circle(530, 262, 140, 'rgba(255,255,255,0.08)');
    this.circle(470, 512, 110, 'rgba(255,255,255,0.06)');
    c.restore();
    this.text('Běžný účet', 76, 316, 500, 27, 'rgba(255,255,255,0.8)');
    this.text('24 580,00 Kč', 76, 398, 700, 58, '#ffffff');
    this.text('CZ65 0800 •••• 4821', 76, 450, 400, 25, 'rgba(255,255,255,0.72)');

    // rychlé akce; „Platba“ se při klepnutí lehce zmáčkne
    const press = 1 - 0.06 * Math.max(0, 1 - Math.abs(t - 1.27) / 0.12);
    ['Platba', 'Účty', 'Karty', 'Více'].forEach((name, i) => {
      const x = 40 + i * 133, y = 530, w = 121, h = 140;
      c.save();
      if (i === 0) {
        c.translate(x + w / 2, y + h / 2);
        c.scale(press, press);
        c.translate(-(x + w / 2), -(y + h / 2));
      }
      this.rr(x, y, w, h, 28, i === 0 ? APP.blue : APP.card);
      this.icon(i, x + w / 2, y + 54);
      this.text(name, x + w / 2, y + 114, 600, 23, i === 0 ? '#ffffff' : APP.text, 'center');
      c.restore();
    });

    this.text('Poslední pohyby', 48, 760, 650, 30, APP.text);
    const rows = [
      ['Kavárna U Rohu', 'dnes', '−89 Kč', 'K'],
      ['Výplata', 'včera', '+32 000 Kč', 'V'],
      ['Nájem', '1. 10.', '−12 500 Kč', 'N'],
      ['Potraviny', '30. 9.', '−640 Kč', 'P'],
    ];
    rows.forEach(([name, date, amount, letter], i) => {
      const y = 800 + i * 106;
      this.circle(84, y + 48, 32, APP.card2);
      this.text(letter, 84, y + 58, 650, 26, APP.muted, 'center');
      this.text(name, 136, y + 42, 600, 27, APP.text);
      this.text(date, 136, y + 78, 400, 23, APP.muted);
      this.text(amount, 556, y + 56, 650, 27, amount.startsWith('+') ? APP.green : APP.text, 'right');
      if (i < rows.length - 1) {
        c.fillStyle = APP.line;
        c.fillRect(136, y + 100, 420, 1.5);
      }
    });
  }

  icon(i, x, y) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.strokeStyle = c.fillStyle = i === 0 ? '#ffffff' : '#9fb0e6';
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    if (i === 0) {
      c.moveTo(-12, 12);
      c.lineTo(12, -12);
      c.moveTo(-4, -12);
      c.lineTo(12, -12);
      c.lineTo(12, 4);
      c.stroke();
    } else if (i === 1) {
      for (const yy of [-10, 0, 10]) {
        c.moveTo(-14, yy);
        c.lineTo(14, yy);
      }
      c.stroke();
    } else if (i === 2) {
      c.roundRect(-17, -12, 34, 24, 5);
      c.moveTo(-17, -3);
      c.lineTo(17, -3);
      c.stroke();
    } else {
      for (const xx of [-12, 0, 12]) {
        c.moveTo(xx + 3, 0);
        c.arc(xx, 0, 3, 0, Math.PI * 2);
      }
      c.fill();
    }
    c.restore();
  }

  drawForm(t) {
    const c = this.ctx;
    c.fillStyle = APP.bg;
    c.fillRect(0, 0, 600, 1290);
    c.strokeStyle = APP.text;
    c.lineWidth = 4.5;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(66, 146);
    c.lineTo(50, 162);
    c.lineTo(66, 178);
    c.stroke();
    this.text('Nová platba', 92, 176, 700, 40, APP.text);

    const accN = Math.floor(clamp((t - 2.4) / 0.9, 0, 1) * ACCOUNT.length);
    const amtN = Math.floor(clamp((t - 4.0) / 0.42, 0, 1) * 3);
    const blink = Math.floor(t * 3) % 2 === 0;
    this.field('Na účet', 250, ACCOUNT.slice(0, accN), t >= 2.3 && t < 3.9, blink, 'Číslo účtu / kód banky');
    this.field('Částka', 420, '100'.slice(0, amtN), t >= 3.9 && t < 5.05, blink, '0', 'Kč');
    this.field('Zpráva pro příjemce', 590, '', false, false, 'Nepovinné');
    this.text('Platba odejde ihned.', 48, 760, 400, 24, APP.muted);

    const sending = t >= 5.05 && t < 5.95;
    const press = 1 - 0.04 * Math.max(0, 1 - Math.abs(t - 5.07) / 0.12);
    c.save();
    c.translate(300, 1136);
    c.scale(press, press);
    c.translate(-300, -1136);
    this.rr(40, 1080, 520, 112, 30, APP.blue);
    if (sending) {
      const a = t * 9;
      c.strokeStyle = '#ffffff';
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(300, 1136, 22, a, a + Math.PI * 1.4);
      c.stroke();
    } else {
      this.text('Odeslat platbu', 300, 1148, 700, 32, '#ffffff', 'center');
    }
    c.restore();
  }

  field(label, y, value, focused, blink, placeholder, suffix) {
    const c = this.ctx;
    this.text(label, 48, y, 500, 24, APP.muted);
    this.rr(40, y + 18, 520, 96, 22, APP.card, focused ? APP.blue : APP.line, focused ? 3 : 1.5);
    if (value) this.text(value, 70, y + 80, 600, 34, APP.text);
    else this.text(placeholder, 70, y + 80, 400, 32, 'rgba(143,155,200,0.5)');
    if (suffix) this.text(suffix, 530, y + 80, 600, 32, APP.muted, 'right');
    if (focused && blink) {
      this.font(600, 34);
      const w = value ? c.measureText(value).width : 0;
      c.fillStyle = APP.blue;
      c.fillRect(72 + w, y + 46, 3, 44);
    }
  }

  drawSuccess(t) {
    const c = this.ctx;
    const ts = t - 5.92;
    c.fillStyle = APP.bg;
    c.fillRect(0, 0, 600, 1290);
    const g = c.createRadialGradient(300, 470, 20, 300, 470, 320);
    g.addColorStop(0, 'rgba(51,217,133,0.2)');
    g.addColorStop(1, 'rgba(51,217,133,0)');
    c.fillStyle = g;
    c.fillRect(0, 150, 600, 640);

    const s = Math.max(0.001, ease.outBack(inv(0, 0.5, ts)));
    c.save();
    c.translate(300, 470);
    c.scale(s, s);
    this.circle(0, 0, 118, 'rgba(51,217,133,0.14)');
    c.strokeStyle = APP.green;
    c.lineWidth = 9;
    c.stroke();
    c.restore();
    this.check(300, 470, inv(0.18, 0.6, ts));

    this.text('Platba odeslána', 300, 690, 700, 48, APP.text, 'center');
    this.text('100,00 Kč', 300, 752, 600, 36, APP.text, 'center');
    this.text('na účet ' + ACCOUNT, 300, 800, 400, 26, APP.muted, 'center');
    this.rr(40, 1080, 520, 112, 30, APP.card2);
    this.text('Hotovo', 300, 1148, 700, 32, APP.text, 'center');

    // Kontrola výsledku: test „přečte“ text a potvrdí ho (krok 4)
    const k = inv(6.55, 6.75, t) * (1 - inv(7.45, 7.65, t));
    if (k > 0) {
      const ok = t >= 7.0;
      const col = ok ? APP.green : '#6ea8ff';
      c.save();
      c.globalAlpha *= k;
      c.setLineDash(ok ? [] : [12, 9]);
      c.lineDashOffset = -t * 40;
      this.rr(96, 638, 408, 72, 16, null, col, 3.5);
      c.setLineDash([]);
      this.rr(206, 590, 188, 44, 22, col);
      if (ok) {
        this.check(240, 612, 1, 0.17, '#06101f', 4.5);
        this.text('ověřeno', 316, 621, 650, 24, '#06101f', 'center');
      } else {
        this.text('kontroluji', 300, 621, 650, 24, '#06101f', 'center');
      }
      c.restore();
    }
  }

  drawFinal(t) {
    const c = this.ctx;
    c.fillStyle = APP.bg;
    c.fillRect(0, 0, 600, 1290);
    const g = c.createRadialGradient(300, 520, 30, 300, 520, 380);
    g.addColorStop(0, 'rgba(51,217,133,0.24)');
    g.addColorStop(1, 'rgba(51,217,133,0)');
    c.fillStyle = g;
    c.fillRect(0, 140, 600, 760);
    const q = (t % 2.2) / 2.2;
    c.strokeStyle = `rgba(51,217,133,${0.5 * (1 - q)})`;
    c.lineWidth = 4;
    c.beginPath();
    c.arc(300, 520, 130 + q * 120, 0, Math.PI * 2);
    c.stroke();
    this.circle(300, 520, 130, 'rgba(51,217,133,0.15)');
    c.strokeStyle = APP.green;
    c.lineWidth = 10;
    c.stroke();
    this.check(300, 520, 1, 1.1);
    this.text('Hotovo', 300, 760, 700, 58, APP.text, 'center');
    this.text('11 z 11 slidů prošlo', 300, 818, 400, 28, APP.muted, 'center');
  }

  drawStatus() {
    const c = this.ctx;
    c.globalAlpha = 1;
    this.text('9:41', 64, 62, 650, 28, APP.text);
    this.rr(222, 26, 156, 44, 22, '#000000');
    c.fillStyle = APP.text;
    for (let i = 0; i < 4; i++) c.fillRect(448 + i * 9, 58 - 6 - i * 4, 6, 6 + i * 4);
    c.strokeStyle = APP.text;
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(495, 40, 42, 21, 6);
    c.stroke();
    c.fillRect(499, 44, 30, 13);
    c.fillRect(539, 46, 3, 9);
  }

  /** „Prst“ robota: modrý kruh, při klepnutí se zmáčkne a vyšle vlnu. */
  drawFinger(t) {
    const [x, y, a] = keyframes(FINGER, t);
    if (a <= 0.01) return;
    const c = this.ctx;
    let press = 0, ring = -1;
    for (const tap of TAPS) {
      const d = t - tap.t;
      if (d > -0.1 && d < 0.14) press = Math.max(press, 1 - Math.abs(d - 0.02) / 0.12);
      if (d >= 0 && d < 0.6) ring = d / 0.6;
    }
    c.save();
    c.globalAlpha = a;
    if (ring >= 0) {
      c.strokeStyle = `rgba(150,190,255,${0.9 * (1 - ring)})`;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(x, y, 38 + ring * 85, 0, Math.PI * 2);
      c.stroke();
    }
    const r = 36 - press * 7;
    c.shadowColor = 'rgba(110,168,255,0.9)';
    c.shadowBlur = 26;
    c.fillStyle = `rgba(110,168,255,${0.22 + press * 0.25})`;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(170,200,255,0.95)';
    c.lineWidth = 4;
    c.stroke();
    c.restore();
  }
}

/** Obdélník se zaoblenými rohy jako THREE.Shape (střed v počátku). */
function roundedRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** ShapeGeometry má UV v jednotkách scény; přepočet na 0..1 přes celý displej. */
function remapUV(geo, w, h) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  uv.needsUpdate = true;
}

/** 3D telefon, který si akty „půjčují“ a posílají mu cílovou polohu. */
class PhoneRig {
  constructor(engine) {
    this.e = engine;
    const W = 1.0, H = 2.06, R = 0.15, D = 0.06, BEV = 0.028;
    this.bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(W, H, R), {
      depth: D,
      bevelEnabled: true,
      bevelThickness: BEV,
      bevelSize: BEV,
      bevelSegments: 6,
      curveSegments: 24,
    });
    this.bodyGeo.center();
    this.bodyMat = new THREE.MeshPhysicalMaterial({
      color: '#2a3352',
      metalness: 0.85,
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
    });
    const body = new THREE.Mesh(this.bodyGeo, this.bodyMat);

    const front = new THREE.Mesh(
      new THREE.ShapeGeometry(roundedRectShape(W + 0.01, H + 0.01, R), 24),
      new THREE.MeshPhysicalMaterial({ color: '#03050b', roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 })
    );
    front.position.z = D / 2 + BEV + 0.0012;

    this.SW = W - 0.075;
    this.SH = H - 0.075;
    this.screenGeo = new THREE.ShapeGeometry(roundedRectShape(this.SW, this.SH, R - 0.035), 24);
    remapUV(this.screenGeo, this.SW, this.SH);
    this.screen = new PhoneScreen();
    const screen = new THREE.Mesh(
      this.screenGeo,
      new THREE.MeshBasicMaterial({ map: this.screen.texture, color: new THREE.Color(0.9, 0.9, 0.9) })
    );
    this.screenZ = front.position.z + 0.0015;
    screen.position.z = this.screenZ;

    const btnGeo = new THREE.RoundedBoxGeometry(0.026, 0.26, 0.05, 2, 0.011);
    const b1 = new THREE.Mesh(btnGeo, this.bodyMat);
    b1.position.set(W / 2 + BEV + 0.006, 0.36, 0);
    const b2 = new THREE.Mesh(btnGeo, this.bodyMat);
    b2.scale.y = 0.6;
    b2.position.set(-(W / 2 + BEV + 0.006), 0.5, 0);
    const b3 = b2.clone();
    b3.position.y = 0.3;

    this.glow = glowSprite('#4f7dff', 0.7, 1, 0.32);
    this.glow.scale.set(4.2, 5.2, 1);
    this.glow.position.z = -0.6;

    this.pivot = new THREE.Group();
    this.pivot.add(this.glow, body, front, screen, b1, b2, b3);

    // vlny klepnutí nad displejem (bloom z nich udělá záblesk)
    this.ripples = Array.from({ length: 5 }, () => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 64), addMat('#7fb0ff', 2.4, 0));
      m.visible = false;
      m.life = 1;
      this.pivot.add(m);
      return m;
    });

    this.group = new THREE.Group();
    this.group.add(this.pivot);
    engine.scene.add(this.group);

    this.pos = new THREE.Vector3(0, -1, -1);
    this.parked = true;
    this.posGoal = this.pos.clone();
    this.posVel = new THREE.Vector3();
    this.rot = new THREE.Vector3();
    this.rotGoal = new THREE.Vector3();
    this.rotVel = new THREE.Vector3();
    this.s = 0.001;
    this.sGoal = 0.001;
    this.mode = 'flow';
    this.flowT = 0;
    this.prevFlowT = 0;
    this.drawT = -1;
  }

  /** pose = { pos, rot, scale, mode, restart } nebo null = zmenšit a odklidit. */
  setPose(p) {
    if (!p) {
      // odejít: zmenšit a vzdálit (neproletět přes další scénu)
      this.parked = true;
      this.posGoal.set(this.posGoal.x + 0.4, this.posGoal.y - 1.2, this.posGoal.z - 2);
      this.sGoal = 0.001;
      return;
    }
    const appearing = this.parked && this.s < 0.05;
    if (appearing) {
      // příchod odnikud: vyroste kousek pod cílovou polohou
      this.pos.set(p.pos[0], p.pos[1] - 0.9, p.pos[2] - 1.2);
      this.posVel.set(0, 0, 0);
      this.rot.fromArray(p.rot);
    }
    this.parked = false;
    this.posGoal.fromArray(p.pos);
    this.rotGoal.fromArray(p.rot);
    this.sGoal = p.scale;
    if (p.mode !== this.mode) {
      this.mode = p.mode;
      this.drawT = -1;
    }
    // test od začátku: vždy (slide 6), nebo jen když telefon zrovna přilétá
    if (p.restart === 'always' || (p.restart && appearing)) this.flowT = 0;
  }

  get flowStep() {
    return FLOW_STEPS.findIndex(([a, b]) => this.flowT >= a && this.flowT < b);
  }

  tick(dt, t) {
    // hodiny testu běží pořád (slide 5 posílá impulzy i bez telefonu)
    this.prevFlowT = this.flowT;
    this.flowT = (this.flowT + dt) % FLOW_LEN;

    smoothDamp(this.pos, this.posGoal, this.posVel, 0.85, dt);
    smoothDamp(this.rot, this.rotGoal, this.rotVel, 0.85, dt);
    this.s = damp(this.s, this.sGoal, this.parked ? 7 : 4.5, dt);
    this.group.visible = this.s > 0.02;
    if (!this.group.visible) return;
    this.group.position.copy(this.pos);
    this.group.rotation.set(this.rot.x, this.rot.y, this.rot.z);
    this.group.scale.setScalar(this.s);
    this.pivot.position.y = Math.sin(t * 0.9) * 0.045;
    this.pivot.rotation.set(Math.sin(t * 0.5) * 0.02, Math.sin(t * 0.43) * 0.05, Math.sin(t * 0.61) * 0.012);

    if (this.mode === 'flow') {
      for (const tap of TAPS) if (crossed(this.prevFlowT, this.flowT, tap.t)) this.ripple(tap);
    }
    for (const r of this.ripples) {
      if (!r.visible) continue;
      r.life += dt / 0.75;
      if (r.life >= 1) {
        r.visible = false;
        continue;
      }
      r.scale.setScalar(0.035 + ease.outCubic(r.life) * 0.2);
      r.material.opacity = (1 - r.life) ** 1.5;
    }

    if (t - this.drawT > 1 / 30) {
      this.drawT = t;
      this.screen.draw(this.mode, this.mode === 'flow' ? this.flowT : t);
    }
  }

  ripple(tap) {
    const r = this.ripples.find((m) => !m.visible) || this.ripples[0];
    r.visible = true;
    r.life = 0;
    r.position.set((tap.x / 600 - 0.5) * this.SW, (0.5 - tap.y / 1290) * this.SH, this.screenZ + 0.004);
  }
}
