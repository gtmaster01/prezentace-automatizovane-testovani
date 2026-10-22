/* ==========================================================================
   AKTY — 3D scéna pro každý slide
   Každý akt má „přítomnost“ p (0 → 1 při příchodu, 1 → 0 při odchodu),
   ze které počítá vlastní nástup i odchod. Díky tomu jde přeskakovat
   slidy libovolně rychle a nic se nezasekne.
   ========================================================================== */

class Act {
  constructor(engine) {
    this.e = engine;
    this.group = new THREE.Group();
    this.group.visible = false;
    engine.scene.add(this.group);
    this.p = 0;
    this.target = 0;
    this.age = 0;
    this.step = 0;
    this.mode = null;
    this.dir = 1;
  }
  enter(step, mode, dir) {
    this.target = 1;
    this.wait = 0.32; // nejdřív nechat odejít předchozí scénu
    this.age = 0;
    this.step = step;
    this.mode = mode;
    this.dir = dir;
    this.onEnter();
  }
  leave() {
    this.target = 0;
  }
  change(step, mode, dir) {
    const prevStep = this.step, prevMode = this.mode;
    this.step = step;
    this.mode = mode;
    this.dir = dir;
    this.onChange(prevStep, prevMode);
  }
  onEnter() {}
  onChange() {}
  shot() {
    return { pos: [0, 0, 9], target: [0, 0, 0] };
  }
  phonePose() {
    return null;
  }
  palette() {
    return 'night';
  }
  tick(dt, t) {
    if (this.target === 1 && this.wait > 0) this.wait -= dt;
    else this.p = this.target > this.p ? Math.min(1, this.p + dt / 1.0) : Math.max(0, this.p - dt / 0.55);
    this.group.visible = this.p > 0.001;
    if (!this.group.visible) return;
    this.age += dt;
    this.update(dt, t);
  }
  update() {}
}

/* --- 1. TITUL: telefon, který testuje robot, a dva prstence kolem --- */
class TitleAct extends Act {
  constructor(e) {
    super(e);
    // prstence obíhají ZA telefonem, aby nikdy nepřekřížily displej
    this.r1 = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.006, 8, 220), addMat('#6ea8ff', 2.0, 0.85));
    this.r1.rotation.set(0.95, 0.35, 0);
    this.r2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.004, 8, 240), addMat('#ffb547', 1.6, 0.55));
    this.r2.rotation.set(1.15, -0.45, 0.3);
    this.dots = [];
    for (const [ring, R, col, n] of [[this.r1, 2.05, '#a9caff', 3], [this.r2, 2.6, '#ffd08a', 2]]) {
      for (let i = 0; i < n; i++) {
        const d = glowSprite(col, 1.6, 0.3, 1);
        d.userData = { R, a0: (i / n) * Math.PI * 2 };
        ring.add(d);
        this.dots.push(d);
      }
    }
    this.r1.position.z = -1.85;
    this.r2.position.z = -2.55;
    this.group.add(this.r1, this.r2);
    this.fades = [this.r1.material, this.r2.material, ...this.dots.map((d) => d.material)];
    this.base = this.fades.map((m) => m.opacity);
  }
  phonePose() {
    return { pos: [0, 0, 0], rot: [0.06, -0.42, 0.03], scale: 1.22, mode: 'flow' };
  }
  shot() {
    return { pos: [0.4, 0.25, 7.4], target: [-1.55, 0.05, 0] };
  }
  update(dt, t) {
    const p = ease.outCubic(this.p);
    this.group.scale.setScalar(0.7 + 0.3 * p);
    this.r1.rotation.z = t * 0.1;
    this.r2.rotation.z = -t * 0.07;
    for (const d of this.dots) {
      const a = d.userData.a0 + t * 0.35;
      d.position.set(Math.cos(a) * d.userData.R, Math.sin(a) * d.userData.R, 0);
    }
    this.fades.forEach((m, i) => (m.opacity = this.base[i] * p));
  }
}

/* --- 2. PROČ: cena chyby roste od návrhu po produkci --- */
class BarsAct extends Act {
  constructor(e) {
    super(e);
    this.group.position.set(0.95, -1.62, 0);
    const H = [0.5, 1.0, 1.9, 3.45], X = [-1.8, -0.6, 0.6, 1.8];
    const C = ['#4f7dff', '#8f84ff', '#ffb547', '#ff5468'];
    this.bars = H.map((h, i) => {
      const geo = new THREE.RoundedBoxGeometry(0.74, h, 0.74, 3, 0.05);
      geo.translate(0, h / 2, 0);
      const col = new THREE.Color(C[i]);
      const mat = new THREE.MeshStandardMaterial({
        color: col.clone().multiplyScalar(0.35),
        emissive: col,
        emissiveIntensity: 0.55,
        roughness: 0.32,
        metalness: 0.25,
        transparent: true,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.x = X[i];
      const cap = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), addMat(C[i], 2.4, 0.9));
      cap.rotation.x = -Math.PI / 2;
      cap.position.y = h + 0.004;
      const halo = glowSprite(C[i], 1.0, 1.1, 0.3);
      halo.position.y = h + 0.08;
      m.add(cap, halo);
      this.group.add(m);
      return { m, mat, cap, halo, h, x: X[i] };
    });
    this.grid = makeGrid(16, '#4c6bff', 0.5, 7);
    this.group.add(this.grid);
    e.takeLabels('bars').forEach((el, i) => {
      const b = this.bars[i];
      e.addLabel(el, this, (v) => v.set(b.x, -0.36, 0.55).applyMatrix4(this.group.matrixWorld));
    });
  }
  shot() {
    const o = Math.sin(this.age * 0.12) * 0.7;
    return { pos: [2.4 + o, 1.25, 9.9], target: [-1.65, 0.3, 0] };
  }
  update(dt, t) {
    const p = ease.outCubic(this.p);
    this.bars.forEach((b, i) => {
      const g = ease.outBack(inv(0.25 + i * 0.22, 1.05 + i * 0.22, this.age));
      b.m.scale.y = Math.max(0.002, g * p);
      b.mat.opacity = p;
      b.cap.material.opacity = g > 0.01 ? 0.9 * p : 0;
      b.halo.material.opacity = 0.35 * p * g;
    });
    // produkce bliká jako alarm
    const last = this.bars[3];
    const alarm = 0.5 + 0.5 * Math.sin(t * 5.5);
    const glitch = Math.random() < 0.04 ? 0.8 : 0;
    last.mat.emissiveIntensity = 0.55 + alarm * 0.55 + glitch;
    last.halo.material.opacity = (0.25 + alarm * 0.35) * p * inv(1.6, 2.2, this.age);
    this.grid.material.uniforms.uAmt.value = p;
  }
}

/* --- 3 + 4. ZEĎ 500 SCÉNÁŘŮ: člověk jede po jednom, robot ji projede vlnou --- */
class WallAct extends Act {
  constructor(e) {
    super(e);
    const COLS = 25, ROWS = 20, N = COLS * ROWS;
    Object.assign(this, { COLS, ROWS, N });
    const geo = new THREE.RoundedBoxGeometry(0.17, 0.12, 0.018, 2, 0.012);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ transparent: true }), N);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    const R = 14, dA = 0.205 / 14, rnd = mulberry32(42);
    this.tiles = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const a = (c - (COLS - 1) / 2) * dA;
        this.tiles.push({ x: Math.sin(a) * R, y: ((ROWS - 1) / 2 - r) * 0.165, z: (1 - Math.cos(a)) * R, ry: -a, c, r, j: rnd() });
      }
    }
    this.fail = new Set();
    while (this.fail.size < 7) this.fail.add(Math.floor(rnd() * N));
    this.C = {
      idle: new THREE.Color('#1a2550'),
      idle2: new THREE.Color('#25356e'),
      human: new THREE.Color('#ffb547').multiplyScalar(1.7),
      done: new THREE.Color('#2b8a60'),
      scan: new THREE.Color('#9cc2ff').multiplyScalar(1.45),
      pass: new THREE.Color('#2ec27e').multiplyScalar(0.72),
      fail: new THREE.Color('#ff5468').multiplyScalar(1.9),
    };
    this.prev = new Float32Array(N * 3);
    this.cur = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.mesh.setColorAt(i, this.C.idle);
      this.C.idle.toArray(this.cur, i * 3);
    }
    this.o = new THREE.Object3D();
    this.c = new THREE.Color();
    this.c2 = new THREE.Color();
    this.c3 = new THREE.Color();
    this.group.add(this.mesh);
    this.group.position.set(2.95, 0.1, 0);
    this.group.rotation.y = 0.22; // pravý okraj ustupuje do hloubky
    this.modeAge = 0;
  }
  onEnter() {
    this.modeAge = 0;
    this.prev.set(this.cur);
  }
  onChange(prevStep, prevMode) {
    if (prevMode !== this.mode) {
      this.modeAge = 0;
      this.prev.set(this.cur);
    }
  }
  shot() {
    return this.mode === 'robot'
      ? { pos: [0.45, 0.3, 10.0], target: [0.2, 0.05, 0] }
      : { pos: [0.2, 0.2, 10.6], target: [0, 0, 0] };
  }
  update(dt, t) {
    this.modeAge += dt;
    const { C, o, c, c2, c3 } = this;
    const p = this.p, ma = this.modeAge;
    const blend = inv(0, 0.5, ma);
    const manualK = (ma - 0.8) * 1.6; // člověk: necelé dva scénáře za sekundu
    const cyc = ma % 10; // robot: projede celou zeď, chvíli drží výsledek, znovu
    for (let i = 0; i < this.N; i++) {
      const tl = this.tiles[i];
      const s = ease.outCubic(clamp(p * 1.9 - (tl.c / this.COLS) * 0.9, 0, 1));
      let flip = 0, sc = 1;
      c2.copy(C.idle).lerp(C.idle2, tl.j * 0.6);
      if (this.mode === 'robot') {
        const at = 0.5 + tl.c * 0.055 + tl.r * 0.03 + tl.j * 0.12;
        const q = inv(at, at + 0.34, cyc);
        flip = ease.inOutCubic(q) * Math.PI;
        if (q <= 0) c.copy(c2);
        else if (q < 1) c.copy(C.scan);
        else if (this.fail.has(i)) c.copy(C.fail).multiplyScalar(0.75 + 0.35 * Math.sin(t * 6 + i));
        else c.copy(C.pass);
        c.lerp(c2, inv(8.8, 9.8, cyc));
      } else if (i < manualK - 1) {
        c.copy(C.done);
      } else if (i < manualK) {
        c.copy(C.human);
        sc = 1.25 + 0.08 * Math.sin(t * 10);
      } else {
        c.copy(c2);
      }
      if (blend < 1) {
        c3.fromArray(this.prev, i * 3);
        c.copy(c3.lerp(c, blend));
      }
      c.toArray(this.cur, i * 3);
      o.position.set(tl.x, tl.y, tl.z);
      o.rotation.set(flip, tl.ry, 0, 'YXZ');
      o.scale.setScalar(Math.max(0.001, s * sc));
      o.updateMatrix();
      this.mesh.setMatrixAt(i, o.matrix);
      this.mesh.setColorAt(i, c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.material.opacity = Math.min(1, p * 1.5);
  }
}

/* --- 5. JAK TO FUNGUJE: test → Appium → telefon → výsledek --- */
function codePanelTexture() {
  const cv = document.createElement('canvas');
  cv.width = 760;
  cv.height = 520;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(8, 13, 36, 0.94)';
  c.beginPath();
  c.roundRect(4, 4, 752, 512, 34);
  c.fill();
  c.strokeStyle = 'rgba(110,168,255,0.55)';
  c.lineWidth = 3;
  c.stroke();
  ['#ff5468', '#ffb547', '#3be38b'].forEach((col, i) => {
    c.globalAlpha = 0.8;
    c.fillStyle = col;
    c.beginPath();
    c.arc(46 + i * 30, 46, 9, 0, Math.PI * 2);
    c.fill();
  });
  c.globalAlpha = 1;
  c.font = '500 26px "JetBrains Mono", monospace';
  c.fillStyle = '#7c87b6';
  c.fillText('PaymentTest.kt', 150, 55);
  const lines = [
    [['@Test', '#c9d2f5']],
    [['fun ', '#c9d2f5'], ['sendPayment', '#a8c6ff'], ['() {', '#7c87b6']],
    [['  runStep(', '#a8c6ff'], ['"Otevřu platbu"', '#ffb547'], [')', '#a8c6ff']],
    [['  runStep(', '#a8c6ff'], ['"Zadám 100 Kč"', '#ffb547'], [')', '#a8c6ff']],
    [['  runStep(', '#a8c6ff'], ['"Odešlu"', '#ffb547'], [')', '#a8c6ff']],
    [['}', '#7c87b6']],
  ];
  c.font = '500 34px "JetBrains Mono", monospace';
  lines.forEach((parts, i) => {
    let x = 44;
    const y = 128 + i * 60;
    for (const [s, col] of parts) {
      c.fillStyle = col;
      c.fillText(s, x, y);
      x += c.measureText(s).width;
    }
  });
  return canvasTexture(cv);
}

function resultTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 600;
  const c = cv.getContext('2d');
  c.fillStyle = 'rgba(8, 13, 36, 0.94)';
  c.beginPath();
  c.roundRect(4, 4, 592, 592, 40);
  c.fill();
  c.strokeStyle = 'rgba(59,227,139,0.55)';
  c.lineWidth = 3;
  c.stroke();
  c.fillStyle = 'rgba(59,227,139,0.16)';
  c.beginPath();
  c.arc(300, 186, 92, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#3be38b';
  c.lineWidth = 9;
  c.stroke();
  c.lineWidth = 14;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(255, 188);
  c.lineTo(287, 220);
  c.lineTo(348, 156);
  c.stroke();
  c.font = '700 54px "Bricolage Grotesque", sans-serif';
  c.textAlign = 'center';
  c.fillStyle = '#eef2ff';
  c.fillText('Prošlo', 300, 346);
  c.font = '500 26px "JetBrains Mono", monospace';
  c.textAlign = 'left';
  ['krok 1   0,8 s', 'krok 2   2,1 s', 'krok 3   1,3 s', 'krok 4   0,4 s'].forEach((s, i) => {
    const y = 414 + i * 44;
    c.strokeStyle = '#3be38b';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(148, y - 9);
    c.lineTo(158, y + 1);
    c.lineTo(176, y - 19);
    c.stroke();
    c.fillStyle = '#b6bfe4';
    c.fillText(s, 198, y);
  });
  return canvasTexture(cv);
}

class PipelineAct extends Act {
  constructor(e) {
    super(e);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const S = (this.S = [V(-4.3, 0.15, 0), V(-1.45, 0.15, 0.35), V(1.45, 0.15, 0.35), V(4.3, 0.15, 0)]);
    this.group.position.set(0, -0.3, 0);
    const mid = (a, b, dy) => a.clone().lerp(b, 0.5).add(V(0, dy, 0.25));
    this.curve = new THREE.CatmullRomCurve3(
      [S[0], mid(S[0], S[1], 0.5), S[1], mid(S[1], S[2], -0.5), S[2], mid(S[2], S[3], 0.5), S[3]],
      false,
      'centripetal'
    );
    this.uS = S.map((s) => closestU(this.curve, s));
    this.lineU = { uAmt: { value: 0 }, uB: { value: 0 }, uCol: { value: new THREE.Color('#5a74d6') } };
    const line = new THREE.Mesh(
      new THREE.TubeGeometry(this.curve, 400, 0.01, 6, false),
      new THREE.ShaderMaterial({
        uniforms: this.lineU,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          varying float vU;
          void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt, uB;
          uniform vec3 uCol;
          varying float vU;
          void main() {
            // za poslední odkrytou stanicí cesta jen tuší, kudy to půjde dál
            float vis = mix(0.16, 1.0, 1.0 - smoothstep(uB - 0.01, uB, vU));
            float dash = 0.5 + 0.5 * step(0.5, fract(vU * 90.0));
            gl_FragColor = vec4(uCol * dash, vis * uAmt * 0.85);
          }`,
      })
    );
    this.group.add(line);

    // 1 test: panel s kódem
    const g0 = new THREE.Group();
    g0.position.copy(S[0]);
    const code = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3), new THREE.MeshBasicMaterial({ map: codePanelTexture(), transparent: true, depthWrite: false }));
    code.rotation.y = 0.32;
    const g0glow = glowSprite('#3f6dff', 0.6, 3.2, 0.5);
    g0glow.position.z = -0.3;
    g0.add(g0glow, code);

    // 2 Appium: gyroskop, „tlumočník“ mezi kódem a telefonem
    const g1 = new THREE.Group();
    g1.position.copy(S[1]);
    this.core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.3, 1),
      new THREE.MeshStandardMaterial({ color: '#1b2f78', emissive: '#4f7dff', emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.3, flatShading: true })
    );
    this.rings = [0.56, 0.68, 0.8].map((r, i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.011, 8, 128), addMat(i === 1 ? '#ffb547' : '#6ea8ff', i === 1 ? 1.3 : 1.7, 0.9));
      m.rotation.set(i * 1.1, i * 0.7, 0);
      g1.add(m);
      return m;
    });
    g1.add(glowSprite('#4f7dff', 1, 2.4, 0.6), this.core);

    // 3 telefon: místo drží PhoneRig (phonePose), skupina slouží pro popisek
    const g2 = new THREE.Group();
    g2.position.copy(S[2]);

    // 4 výsledek
    const g3 = new THREE.Group();
    g3.position.copy(S[3]);
    const res = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.55), new THREE.MeshBasicMaterial({ map: resultTexture(), transparent: true, depthWrite: false }));
    res.rotation.y = -0.32;
    this.resGlow = glowSprite('#3be38b', 1.4, 3.4, 0);
    this.resGlow.position.z = -0.3;
    g3.add(this.resGlow, res);

    this.st = [g0, g1, g2, g3];
    this.group.add(g0, g1, g2, g3);
    this.revealAt = [0, Infinity, Infinity, Infinity];
    this.sc = [0, 0, 0, 0];
    this.lineB = 0;
    this.flash = 0;
    this.pulses = Array.from({ length: 10 }, () => {
      const s = glowSprite('#8cb8ff', 2.6, 0.5, 0);
      s.visible = false;
      this.group.add(s);
      return s;
    });
    e.takeLabels('pipeline').forEach((el, i) => {
      const g = this.st[i];
      g.label = e.addLabel(el, this, (v) => v.set(0, i === 2 ? -0.98 : -1.02, 0).applyMatrix4(this.group.matrixWorld).add(g.position));
      g.label.vis = 0;
    });
  }
  onEnter() {
    this.revealAt = [0, 1, 2, 3].map((i) => (i <= this.step ? 0.35 + i * 0.25 : Infinity));
    this.prevFT = this.e.phone.flowT;
  }
  onChange() {
    for (let i = 0; i < 4; i++) {
      if (i <= this.step && this.revealAt[i] === Infinity) this.revealAt[i] = this.age + 0.05;
      if (i > this.step) this.revealAt[i] = Infinity;
    }
  }
  phonePose() {
    if (this.step < 2) return null;
    const w = this.S[2].clone().add(this.group.position);
    return { pos: [w.x, w.y - 0.04, w.z], rot: [0, -0.1, 0], scale: 0.72, mode: 'flow', restart: true };
  }
  shot() {
    return { pos: [0, 0.65, 12.4], target: [0, -0.2, 0] };
  }
  update(dt, t) {
    const p = ease.outCubic(this.p);
    let last = 0;
    this.st.forEach((g, i) => {
      const shown = this.revealAt[i] !== Infinity;
      if (shown) {
        this.sc[i] = ease.outBack(inv(this.revealAt[i], this.revealAt[i] + 0.7, this.age));
        if (this.age > this.revealAt[i]) last = i;
      } else {
        this.sc[i] = damp(this.sc[i], 0, 8, dt);
      }
      g.scale.setScalar(Math.max(0.001, this.sc[i] * p));
      if (g.label) g.label.vis = clamp(this.sc[i], 0, 1);
    });
    this.lineB = damp(this.lineB, this.uS[last] + (last === 3 ? 0.02 : 0), 3, dt);
    this.lineU.uB.value = this.lineB;
    this.lineU.uAmt.value = p;
    this.rings.forEach((r, i) => {
      r.rotation.x += dt * (0.6 + i * 0.25);
      r.rotation.y += dt * (0.4 - i * 0.15);
    });
    this.core.rotation.y += dt * 0.5;
    this.core.rotation.x += dt * 0.2;

    // impulzy jedou s klepnutími telefonu: dorazí přesně ve chvíli klepnutí
    const ft = this.e.phone.flowT, pf = this.prevFT ?? ft;
    this.prevFT = ft;
    if (this.step >= 1 && this.p > 0.9) {
      for (const tap of TAPS) {
        const m = (tap.t - 0.95 + FLOW_LEN) % FLOW_LEN;
        if (crossed(pf, ft, m)) this.spawn(0, this.step >= 2 ? 2 : 1, this.step >= 2 ? 0.95 : 0.5, '#8cb8ff', false);
      }
      if (this.step >= 3 && crossed(pf, ft, 6.95)) this.spawn(2, 3, 0.55, '#3be38b', true);
    }
    for (const s of this.pulses) {
      if (!s.visible) continue;
      s.life += dt / s.dur;
      if (s.life >= 1) {
        s.visible = false;
        if (s.flash) this.flash = 1;
        continue;
      }
      this.curve.getPointAt(lerp(this.uS[s.a], this.uS[s.b], ease.inOutSine(s.life)), s.position);
      s.material.opacity = Math.min(1, s.life * 6) * p;
    }
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.resGlow.material.opacity = this.step >= 3 ? (0.15 + this.flash * 0.9) * p : 0;
  }
  spawn(a, b, dur, col, flash) {
    const s = this.pulses.find((x) => !x.visible);
    if (!s) return;
    Object.assign(s, { visible: true, life: 0, a, b, dur, flash });
    s.material.color.set(col).multiplyScalar(2.6);
  }
}

/* --- 6. JAK VYPADÁ TEST: telefon vpravo, kód vlevo (HTML) --- */
class CodeAct extends Act {
  constructor(e) {
    super(e);
    this.glow = glowSprite('#3f6dff', 0.8, 6.5, 0);
    this.glow.position.set(2.75, 0, -0.8);
    this.group.add(this.glow);
  }
  phonePose() {
    return { pos: [2.75, -0.05, 0.5], rot: [0.02, -0.2, 0], scale: 1.1, mode: 'flow', restart: 'always' };
  }
  shot() {
    return { pos: [0.15, 0.1, 8.5], target: [0, 0, 0] };
  }
  update() {
    this.glow.material.opacity = 0.45 * ease.outCubic(this.p);
  }
}

/* --- 7. UKÁZKA: jen prstence za skutečným videem (HTML) --- */
class VideoAct extends Act {
  constructor(e) {
    super(e);
    this.halo = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.006, 8, 220), addMat('#6ea8ff', 1.8, 0.7));
    this.halo2 = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.004, 8, 220), addMat('#ffb547', 1.5, 0.45));
    this.glow = glowSprite('#3d64ff', 0.9, 8, 0.5);
    this.group.add(this.glow, this.halo, this.halo2);
    this.group.position.set(3.05, 0, -1.4);
    this.mats = [this.halo.material, this.halo2.material, this.glow.material];
    this.base = this.mats.map((m) => m.opacity);
  }
  shot() {
    return { pos: [0, 0.1, 9], target: [0, 0, 0] };
  }
  update(dt, t) {
    const p = ease.outCubic(this.p);
    this.halo.rotation.set(0.25 + Math.sin(t * 0.3) * 0.08, 0.35, t * 0.15);
    this.halo2.rotation.set(-0.3, -0.25, -t * 0.1);
    this.group.scale.setScalar(0.8 + 0.2 * p);
    this.mats.forEach((m, i) => (m.opacity = this.base[i] * p));
  }
}

/* --- 8. NOČNÍ SMĚNA: farma telefonů, zrychlená noc, ranní report --- */
class FarmAct extends Act {
  constructor(e) {
    super(e);
    const ph = e.phone, ROWS = 3, COLS = 8, N = ROWS * COLS;
    this.N = N;
    this.bodies = new THREE.InstancedMesh(ph.bodyGeo, ph.bodyMat, N);
    this.screens = new THREE.InstancedMesh(ph.screenGeo.clone().translate(0, 0, ph.screenZ), new THREE.MeshBasicMaterial(), N);
    const barGeo = new THREE.PlaneGeometry(1, 1);
    barGeo.translate(0.5, 0, 0);
    this.bars = new THREE.InstancedMesh(barGeo, new THREE.MeshBasicMaterial(), N);
    this.barZ = ph.screenZ + 0.004;
    this.slots = [];
    const S = 0.43, dx = 0.62, dy = 1.22;
    const shelfMat = new THREE.MeshStandardMaterial({ color: '#141b36', roughness: 0.45, metalness: 0.6 });
    const farm = (this.farm = new THREE.Group());
    for (let r = 0; r < ROWS; r++) {
      const y = (1 - r) * dy;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(COLS * dx + 0.5, 0.05, 0.75), shelfMat);
      shelf.position.set(0, y - 0.47, 0);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(COLS * dx + 0.5, 0.012, 0.012), addMat('#4f7dff', 1.6, 0.8));
      edge.position.set(0, y - 0.445, 0.38);
      farm.add(shelf, edge);
      for (let c = 0; c < COLS; c++) {
        this.slots.push({ x: (c - (COLS - 1) / 2) * dx, y, s: S, c, state: 'idle', prog: 0, dur: 1, res: 1, hold: 0 });
      }
    }
    this.C = {
      idle: new THREE.Color('#0d1430'),
      run: new THREE.Color('#3d6dff').multiplyScalar(1.05),
      pass: new THREE.Color('#3be38b').multiplyScalar(0.9),
      fail: new THREE.Color('#ff5468').multiplyScalar(1.5),
      bar: new THREE.Color('#9cc2ff').multiplyScalar(1.6),
    };
    for (let i = 0; i < N; i++) {
      this.screens.setColorAt(i, this.C.idle);
      this.bars.setColorAt(i, this.C.bar);
    }
    for (const m of [this.bodies, this.screens, this.bars]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      farm.add(m);
    }
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(0.75, 48, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e2e8ff').multiplyScalar(1.25), transparent: true }));
    this.moonGlow = glowSprite('#9db4ff', 0.7, 4, 0.3);
    const moonG = new THREE.Group();
    moonG.add(this.moonGlow, this.moon);
    moonG.position.set(-2.5, 9.8, -30); // nad nadpisem, mimo police i text
    farm.position.set(2.0, 0.8, 0);
    farm.rotation.y = 0.35; // police ustupují doprava do tmy
    farm.scale.setScalar(0.72);
    this.group.add(farm, moonG);
    this.m4 = new THREE.Matrix4();
    this.m4b = new THREE.Matrix4();
    this.q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0, 0));
    this.v = new THREE.Vector3();
    this.sv = new THREE.Vector3();
    this.col = new THREE.Color();
    this.rnd = mulberry32(5);
    this.done = false;
  }
  onEnter() {
    this.done = false;
    this.rnd = mulberry32(5);
    for (const s of this.slots) Object.assign(s, { state: 'idle', prog: 0, hold: 0, res: 1 });
  }
  palette() {
    return this.age > 10 ? 'dawn' : 'night';
  }
  shot() {
    const d = Math.min(this.age, 16) * 0.025;
    return { pos: [0.8 - d, 0.6, 9.4], target: [-0.6 - d * 0.4, 0.2, 0] };
  }
  update(dt, t) {
    const p = ease.outCubic(this.p);
    const night = this.age > 0.8 && this.age < 9.8; // 23:00 až 06:00
    if (this.age >= 9.8) this.done = true;
    const { C, col } = this;
    this.slots.forEach((s, i) => {
      if (s.state === 'idle' && night && this.rnd() < dt * 2.5) {
        Object.assign(s, { state: 'run', prog: 0, dur: 0.8 + this.rnd() * 1.6 });
      } else if (s.state === 'run') {
        s.prog += dt / s.dur;
        if (s.prog >= 1) Object.assign(s, { state: 'res', res: this.rnd() < 0.06 ? -1 : 1, hold: 0 });
      } else if (s.state === 'res') {
        s.hold += dt;
        if (s.hold > 0.45 && night) Object.assign(s, { state: 'run', prog: 0, dur: 0.8 + this.rnd() * 1.6 });
      }
      if (s.state === 'run') col.copy(C.run).multiplyScalar(0.75 + 0.25 * Math.sin(t * 20 + i));
      else if (s.state === 'res' && s.res < 0) col.copy(C.fail).multiplyScalar(0.8 + 0.3 * Math.sin(t * 6 + i));
      else if (s.state === 'res') col.copy(C.pass);
      else col.copy(C.idle);
      const sc = s.s * Math.max(0.002, ease.outBack(clamp(p * 1.6 - (s.c / 8) * 0.6, 0, 1)));
      this.m4.compose(this.v.set(s.x, s.y, 0), this.q, this.sv.setScalar(sc));
      this.bodies.setMatrixAt(i, this.m4);
      this.screens.setMatrixAt(i, this.m4);
      this.screens.setColorAt(i, col);
      const w = s.state === 'run' ? s.prog : 0;
      this.m4b.makeScale(Math.max(0.0001, w * 0.7), 0.035, 1).setPosition(-0.35, -0.82, this.barZ);
      this.m4b.premultiply(this.m4);
      this.bars.setMatrixAt(i, this.m4b);
    });
    for (const m of [this.bodies, this.screens, this.bars]) m.instanceMatrix.needsUpdate = true;
    this.screens.instanceColor.needsUpdate = true;
    this.moon.material.opacity = p;
    this.moonGlow.material.opacity = 0.3 * p;
  }
}

/* --- 9. DEN TESTERA: ciferník 24 h, slunce jede podle kroků --- */
class DayAct extends Act {
  constructor(e) {
    super(e);
    this.H = [8, 9, 10.5, 13, 15, 22];
    this.R = 1.95;
    const d = (this.dial = new THREE.Group());
    d.rotation.x = -1.05;
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(this.R, 0.012, 8, 256), addMat('#7f97ff', 1.3, 0.7));
    d.add(this.ring);
    this.ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), new THREE.MeshBasicMaterial({ color: '#8fa3ff', transparent: true, opacity: 0.6 }), 24);
    const o = new THREE.Object3D();
    for (let h = 0; h < 24; h++) {
      const a = this.ang(h);
      o.position.set(Math.cos(a) * (this.R + 0.14), Math.sin(a) * (this.R + 0.14), 0);
      o.rotation.set(0, 0, a - Math.PI / 2);
      o.scale.set(1, h % 6 === 0 ? 2 : 1, 1);
      o.updateMatrix();
      this.ticks.setMatrixAt(h, o.matrix);
    }
    d.add(this.ticks);
    this.marks = this.H.map((h, i) => {
      const m = glowSprite(i === 5 ? '#6ea8ff' : '#ffb547', 1.6, 0.42, 0.9);
      const a = this.ang(h);
      m.position.set(Math.cos(a) * this.R, Math.sin(a) * this.R, 0);
      d.add(m);
      return m;
    });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 16), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true }));
    this.sunGlow = glowSprite('#ffc27a', 1.1, 1.15, 0.85);
    this.sunG = new THREE.Group();
    this.sunG.add(this.sunGlow, this.sun);
    d.add(this.sunG);
    this.group.add(d);
    this.group.position.set(1.5, -0.25, 0);
    this.a = this.ang(8);
    this.sunCol = new THREE.Color();
    this.cDay = new THREE.Color('#fff2d6');
    this.cDusk = new THREE.Color('#ff9a4a');
    this.cNight = new THREE.Color('#bcd0ff');
    this._w = new THREE.Vector3();
  }
  /** Poledne nahoře, půlnoc dole. */
  ang(h) {
    return Math.PI / 2 - ((h - 12) / 24) * Math.PI * 2;
  }
  onEnter() {
    this.a = this.ang(this.dir < 0 ? this.H[this.step] : 6); // vpřed: slunce teprve vychází
  }
  palette() {
    const h = this.H[this.step];
    return h < 8.5 ? 'sunrise' : h < 12 ? 'morning' : h < 14 ? 'noon' : h < 18 ? 'afternoon' : 'night';
  }
  shot() {
    return { pos: [0.6, 1.45, 9.7], target: [-1.35, 0.05, 0] };
  }
  update(dt, t) {
    const p = ease.outCubic(this.p);
    this.a = damp(this.a, this.ang(this.H[this.step]), 2.2, dt);
    this.sunG.position.set(Math.cos(this.a) * this.R, Math.sin(this.a) * this.R, 0);
    const hour = 12 + ((Math.PI / 2 - this.a) / (Math.PI * 2)) * 24;
    this.sunCol.copy(this.cDusk).lerp(this.cDay, clamp(1 - Math.abs(hour - 13) / 6, 0, 1));
    this.sunCol.lerp(this.cNight, inv(19, 21, hour));
    this.sun.material.color.copy(this.sunCol).multiplyScalar(1.9);
    this.sun.material.opacity = p;
    this.sunGlow.material.color.copy(this.sunCol).multiplyScalar(1.0);
    this.sunGlow.material.opacity = 0.85 * p;
    this.group.scale.setScalar(0.85 + 0.15 * p);
    this.ring.material.opacity = 0.7 * p;
    this.ticks.material.opacity = 0.6 * p;
    this.marks.forEach((m, i) => (m.material.opacity = (i === this.step ? 1 : 0.55) * p));
    this.sun.getWorldPosition(this._w);
    this.e.setSun(this._w, this.sunCol);
  }
}

/* --- 10. JAK ZAČÍT: čtyři schody, světélko po nich vyskáče nahoru --- */
class StairsAct extends Act {
  constructor(e) {
    super(e);
    this.H = [0.45, 0.9, 1.35, 1.8];
    this.X = [0, 1.15, 2.3, 3.45];
    this.blocks = this.H.map((h, i) => {
      const geo = new THREE.RoundedBoxGeometry(1.06, h, 1.0, 3, 0.05);
      geo.translate(0, h / 2, 0);
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: '#131b3c', emissive: '#2a44b8', emissiveIntensity: 0.22, roughness: 0.42, metalness: 0.35, transparent: true })
      );
      m.position.x = this.X[i];
      const top = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.94), addMat('#ffb547', 1.4, 0));
      top.rotation.x = -Math.PI / 2;
      top.position.y = h + 0.004;
      m.add(top);
      this.group.add(m);
      return { m, top, h, lit: 0 };
    });
    this.grid = makeGrid(14, '#4c6bff', 0.5, 6.5);
    this.group.add(this.grid);
    this.orb = new THREE.Group();
    this.orbGlow = glowSprite('#ffb547', 1.6, 1.3, 0.9);
    this.orbCore = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd08a').multiplyScalar(2.4), transparent: true }));
    this.orb.add(this.orbGlow, this.orbCore);
    this.group.add(this.orb);
    this.burst = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96), addMat('#ffb547', 2, 0));
    this.burst.rotation.x = -Math.PI / 2;
    this.group.add(this.burst);
    this.group.position.set(0.0, -1.5, 0.3);
    this.group.rotation.y = 0.3; // schody stoupají doprava a do hloubky
    this.group.scale.setScalar(0.72);
    this.start = new THREE.Vector3(-1.25, 0.14, 0.1);
    this.tops = this.H.map((h, i) => new THREE.Vector3(this.X[i], h + 0.15, 0));
    e.takeLabels('stairs').forEach((el, i) => {
      const b = this.blocks[i];
      e.addLabel(el, this, (v) => v.set(this.X[i], b.h * 0.5 * b.m.scale.y, 0.52).applyMatrix4(this.group.matrixWorld));
    });
  }
  shot() {
    return { pos: [1.3, 1.5, 9.8], target: [-1.85, 0.2, 0] };
  }
  update(dt, t) {
    const p = ease.outCubic(this.p), A = this.age;
    this.blocks.forEach((b, i) => {
      const k = ease.outBack(inv(0.5 + i * 0.34, 1.2 + i * 0.34, A));
      b.m.scale.y = Math.max(0.002, k * p);
      b.m.material.opacity = p;
      b.lit = damp(b.lit, A > 2.4 + i * 0.55 ? 1 : 0, 5, dt);
      b.top.material.opacity = 0.75 * b.lit * p;
    });
    // skoky: start → schod 1 → … → schod 4
    let pos = this.start;
    for (let i = 0; i < 4; i++) {
      const t0 = 1.9 + i * 0.55;
      if (A < t0) break;
      const from = i === 0 ? this.start : this.tops[i - 1];
      const q = inv(t0, t0 + 0.5, A);
      if (q < 1) {
        pos = from.clone().lerp(this.tops[i], ease.inOutSine(q));
        pos.y += Math.sin(q * Math.PI) * 0.6;
        break;
      }
      pos = this.tops[i];
    }
    this.orb.position.copy(pos);
    if (A > 4.1) this.orb.position.y += Math.sin(t * 2.2) * 0.06;
    this.orbGlow.material.opacity = 0.9 * p;
    this.orbCore.material.opacity = p;
    const k = inv(4.05, 5.3, A);
    this.burst.position.copy(this.tops[3]).add(new THREE.Vector3(0, -0.14, 0));
    this.burst.scale.setScalar(0.3 + ease.outCubic(k) * 2.4);
    this.burst.material.opacity = k > 0 && k < 1 ? (1 - k) * 0.9 * p : 0;
    this.grid.material.uniforms.uAmt.value = p;
  }
}

/* --- 11. DÍKY: telefon s fajfkou a vlny jako tep --- */
class FinaleAct extends Act {
  constructor(e) {
    super(e);
    this.rings = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.006, 8, 200), addMat(i === 1 ? '#3be38b' : '#6ea8ff', 2, 0));
      m.rotation.set(0.15, -0.3, 0);
      this.group.add(m);
      return m;
    });
    const N = 320, rnd = mulberry32(9), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2, r = 1.7 + rnd() * 1.4;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (rnd() - 0.5) * 0.5;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.pts = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        map: glowTexture(),
        color: new THREE.Color('#9db4ff').multiplyScalar(1.8),
        size: 0.07,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.orbit = new THREE.Group();
    this.orbit.add(this.pts);
    this.orbit.rotation.set(0.35, 0, -0.25);
    this.group.add(this.orbit);
    this.group.position.set(0, 0, -0.3);
  }
  phonePose() {
    return { pos: [0, 0, 0], rot: [0.05, -0.32, 0.02], scale: 1.2, mode: 'final' };
  }
  shot() {
    return { pos: [0.4, 0.25, 7.4], target: [-1.55, 0.05, 0] };
  }
  update(dt, t) {
    const p = ease.outCubic(this.p);
    this.rings.forEach((r, i) => {
      const q = ((t + i * 0.9) % 2.7) / 2.7;
      r.scale.setScalar(1.3 + q * 2.6);
      r.material.opacity = (1 - q) ** 2 * 0.8 * p;
    });
    this.orbit.rotation.y = t * 0.12;
    this.pts.material.opacity = 0.9 * p;
  }
}
