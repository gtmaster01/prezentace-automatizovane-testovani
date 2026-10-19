/* ==========================================================================
   ENGINE — renderer, kamera, obloha, prach, postprocessing a popisky
   Každý slide má svůj „akt“ (acts.js). Engine mezi nimi plynule přeletí
   kamerou a přebarví oblohu; akty se samy vynoří a zmizí.
   ========================================================================== */

/** Nálady oblohy. Den testera (slide 10) mezi nimi přechází podle hodin. */
const PALETTES = {
  night: { top: '#020309', mid: '#070d2c', bottom: '#010206', glow: '#1a2870', glowAmt: 0.42, sunAmt: 0, stars: 1 },
  // svítání na konci noční směny: jen teplý pruh u obzoru, nebe zůstává tmavé
  dawn: { top: '#02040e', mid: '#0d0d29', bottom: '#020206', glow: '#d08a55', glowAmt: 0.16, sunAmt: 0, stars: 0.6 },
  // den testera: slunce na ciferníku, obloha jen jemně mění tón (text musí zůstat čitelný)
  sunrise: { top: '#03050f', mid: '#120e2c', bottom: '#020206', glow: '#cc7a4c', glowAmt: 0.17, sunAmt: 0.35, stars: 0.5 },
  morning: { top: '#030715', mid: '#0f1f4a', bottom: '#02040c', glow: '#4c78c8', glowAmt: 0.24, sunAmt: 0.32, stars: 0.25 },
  noon: { top: '#040a1d', mid: '#13265a', bottom: '#030612', glow: '#5f8ad6', glowAmt: 0.22, sunAmt: 0.32, stars: 0.1 },
  afternoon: { top: '#03060f', mid: '#191439', bottom: '#020308', glow: '#c8824e', glowAmt: 0.18, sunAmt: 0.32, stars: 0.3 },
};

class Engine {
  constructor(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer = renderer;
    this.pr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(this.pr);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 500);
    this.camPos = new THREE.Vector3(0.4, 0.25, 7.4);
    this.camTarget = new THREE.Vector3(-1.55, 0.05, 0);
    this.camPosGoal = this.camPos.clone();
    this.camTargetGoal = this.camTarget.clone();
    this.camPosVel = new THREE.Vector3();
    this.camTargetVel = new THREE.Vector3();

    this.t = 0;
    this.acts = {};
    this.actList = [];
    this.current = null;
    this.labels = [];
    this.labelLayer = document.getElementById('labels');
    this._v = new THREE.Vector3();

    // Odlesky pro kovové a lesklé povrchy (telefon, police)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new THREE.RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    room.dispose?.();
    pmrem.dispose();

    this.buildLights();
    this.buildSky();
    this.buildDust();
    this.buildComposer();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  /* --- světla: chladné hlavní, teplé a modré kontra zezadu --- */
  buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x8ea6ff, 0x080b1c, 0.7));
    const key = new THREE.DirectionalLight(0xe9eeff, 2.0);
    key.position.set(4, 6, 8);
    const warm = new THREE.DirectionalLight(0xffa860, 1.8);
    warm.position.set(-7, 2.5, -4);
    const cool = new THREE.DirectionalLight(0x5b86ff, 2.2);
    cool.position.set(7, -1.5, -5);
    s.add(key, warm, cool);
  }

  /* --- obloha: gradient se září u obzoru a volitelným sluncem + hvězdy --- */
  buildSky() {
    const u = (this.skyU = {
      uTop: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uGlowAmt: { value: 0.5 },
      uSun: { value: new THREE.Color('#ffd9a8') },
      uSunAmt: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.4, 0.3, -1).normalize() },
    });
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop, uMid, uBottom, uGlow, uSun, uSunDir;
        uniform float uGlowAmt, uSunAmt;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uMid, uTop, smoothstep(-0.02, 0.62, h));
          col = mix(col, uBottom, smoothstep(-0.05, -0.5, h));
          col += uGlow * exp(-pow((h + 0.17) * 6.5, 2.0)) * uGlowAmt; // záře u obzoru, pod středem obrazu
          float s = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSun * (pow(s, 160.0) * 0.8 + pow(s, 40.0) * 0.08) * uSunAmt;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), mat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // hvězdy: dítě oblohy, takže jsou „v nekonečnu“ a kamera je nedožene
    const N = 900;
    const rnd = mulberry32(3);
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const th = rnd() * Math.PI * 2;
      const y = rnd() * 0.92 + 0.04;
      const r = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(th) * r * 150;
      pos[i * 3 + 1] = y * 150 - 12;
      pos[i * 3 + 2] = Math.sin(th) * r * 150;
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.starU = { uTime: { value: 0 }, uPR: { value: this.pr }, uAmt: { value: 1 } };
    const stars = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.starU,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aSeed;
          uniform float uTime, uPR;
          varying float vA;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (1.2 + aSeed * aSeed * 2.4) * uPR;
            vA = (0.3 + 0.7 * aSeed) * (0.6 + 0.4 * sin(uTime * (0.4 + aSeed * 1.8) + aSeed * 60.0));
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt;
          varying float vA;
          void main() {
            float a = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
            gl_FragColor = vec4(vec3(0.82, 0.88, 1.0), a * vA * uAmt);
          }`,
      })
    );
    stars.renderOrder = -9;
    stars.frustumCulled = false;
    this.sky.add(stars);

    this.pal = this.makePal(PALETTES.night);
    this.palGoal = this.makePal(PALETTES.night);
    this.palName = 'night';
  }

  makePal(p) {
    return {
      top: new THREE.Color(p.top),
      mid: new THREE.Color(p.mid),
      bottom: new THREE.Color(p.bottom),
      glow: new THREE.Color(p.glow),
      glowAmt: p.glowAmt,
      sunAmt: p.sunAmt,
      stars: p.stars,
    };
  }

  setPalette(name) {
    if (name === this.palName || !PALETTES[name]) return;
    this.palName = name;
    this.palGoal = this.makePal(PALETTES[name]);
  }

  /** Den testera posílá polohu slunce, aby obloha zářila na správném místě. */
  setSun(worldPos, color) {
    this.skyU.uSunDir.value.copy(worldPos).sub(this.camera.position).normalize();
    this.skyU.uSun.value.copy(color);
  }

  updatePalette(dt) {
    const k = 1 - Math.exp(-2.2 * dt);
    const a = this.pal, b = this.palGoal;
    for (const key of ['top', 'mid', 'bottom', 'glow']) a[key].lerp(b[key], k);
    for (const key of ['glowAmt', 'sunAmt', 'stars']) a[key] = lerp(a[key], b[key], k);
    const u = this.skyU;
    u.uTop.value.copy(a.top);
    u.uMid.value.copy(a.mid);
    u.uBottom.value.copy(a.bottom);
    u.uGlow.value.copy(a.glow);
    u.uGlowAmt.value = a.glowAmt;
    u.uSunAmt.value = a.sunAmt;
    this.starU.uAmt.value = a.stars;
  }

  /* --- prach ve vzduchu: dává scéně hloubku a pohyb i v klidu --- */
  buildDust() {
    const N = 1300;
    const rnd = mulberry32(11);
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd() - 0.5) * 46;
      pos[i * 3 + 1] = (rnd() - 0.5) * 26;
      pos[i * 3 + 2] = -34 + rnd() * 42;
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.dustU = {
      uTime: { value: 0 },
      uPR: { value: this.pr },
      uSize: { value: 46 },
      uColor: { value: new THREE.Color('#9db4ff') },
      uAmt: { value: 0.85 },
    };
    const dust = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.dustU,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aSeed;
          uniform float uTime, uPR, uSize;
          varying float vA;
          void main() {
            vec3 p = position;
            float s = aSeed * 6.2831;
            p.x += sin(uTime * 0.11 + s) * 0.7;
            p.y += sin(uTime * 0.08 + s * 1.7) * 0.5;
            p.z += cos(uTime * 0.06 + s * 2.3) * 0.6;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            float d = -mv.z;
            gl_PointSize = uSize * uPR * (0.3 + aSeed * aSeed * 1.1) / max(d, 0.5);
            float tw = 0.55 + 0.45 * sin(uTime * (0.5 + aSeed * 1.5) + s * 3.0);
            vA = tw * smoothstep(40.0, 12.0, d) * smoothstep(1.0, 4.0, d);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uAmt;
          varying float vA;
          void main() {
            float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
            gl_FragColor = vec4(uColor, a * a * vA * uAmt);
          }`,
      })
    );
    dust.frustumCulled = false;
    this.scene.add(dust);
  }

  /* --- postprocessing: MSAA → bloom → tone mapping → vinětace a zrno --- */
  buildComposer() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new THREE.EffectComposer(this.renderer, rt);
    this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
    this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.55, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new THREE.OutputPass());
    this.grade = new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 1 }, uGrain: { value: 0.02 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uTime, uVig, uGrain;
        varying vec2 vUv;
        float hash(vec2 p) {
          p = fract(p * vec2(443.897, 441.423));
          p += dot(p, p.yx + 19.19);
          return fract((p.x + p.y) * p.x);
        }
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          vec2 q = vUv - 0.5;
          q.x *= 1.3;
          c.rgb *= 1.0 - smoothstep(0.38, 1.0, length(q)) * 0.55 * uVig;
          c.rgb += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 113.0) - 0.5) * uGrain;
          gl_FragColor = c;
        }`,
    });
    this.composer.addPass(this.grade);
  }

  /* Pevná vodorovná výseč: na užší obrazovce (4:3, 16:10) se zvětší svislé
     zorné pole, aby scéna seděla s textem na jevišti 16:9. */
  resize() {
    const w = innerWidth, h = innerHeight, a = w / h;
    this.W = w;
    this.H = h;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pr);
    this.composer.setSize(w, h);
    const REF = 16 / 9, base = 35;
    const t = Math.tan(THREE.MathUtils.degToRad(base / 2));
    this.camera.aspect = a;
    this.camera.fov = a >= REF ? base : THREE.MathUtils.radToDeg(2 * Math.atan((t * REF) / a));
    this.camera.updateProjectionMatrix();
    this.dustU.uPR.value = this.pr;
    this.starU.uPR.value = this.pr;
  }

  /* --- akty a telefon --- */
  build() {
    this.phone = new PhoneRig(this);
    const defs = {
      title: TitleAct,
      bars: BarsAct,
      wall: WallAct,
      timeline: TimelineAct,
      pipeline: PipelineAct,
      code: CodeAct,
      video: VideoAct,
      farm: FarmAct,
      day: DayAct,
      stairs: StairsAct,
      finale: FinaleAct,
    };
    for (const [name, Act] of Object.entries(defs)) {
      const act = new Act(this);
      act.name = name;
      this.acts[name] = act;
      this.actList.push(act);
    }
  }

  /** Volá Deck při každé změně slidu nebo kroku. */
  showSlide(ds, step, dir) {
    const act = this.acts[ds.act];
    if (!act) return;
    if (act !== this.current) {
      if (this.current) this.current.leave();
      this.current = act;
      act.enter(step, ds.mode || null, dir);
    } else {
      act.change(step, ds.mode || null, dir);
    }
    this.phone.setPose(act.phonePose());
  }

  /* --- popisky v HTML, které jedou s body ve 3D --- */
  takeLabels(actName) {
    const slide = document.querySelector(`.slide[data-act="${actName}"]`);
    return slide ? [...slide.querySelectorAll('.anchors > *')] : [];
  }

  addLabel(el, act, getPos) {
    this.labelLayer.appendChild(el);
    const label = { el, act, getPos, vis: 1, shown: false };
    this.labels.push(label);
    return label;
  }

  updateLabels() {
    const v = this._v;
    for (const L of this.labels) {
      const a = L.act.p * L.vis;
      if (a < 0.005) {
        if (L.shown) {
          L.el.style.opacity = '0';
          L.shown = false;
        }
        continue;
      }
      L.getPos(v);
      v.project(this.camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * this.W;
      const y = (-v.y * 0.5 + 0.5) * this.H;
      L.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      L.el.style.opacity = a.toFixed(3);
      L.shown = true;
    }
  }

  /* --- smyčka --- */
  start() {
    this.last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      try {
        this.frame(now);
      } catch (err) {
        if (!this._err) console.error(err);
        this._err = true;
      }
    };
    requestAnimationFrame(loop);
  }

  frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.t += dt;
    const t = this.t;

    const cur = this.current;
    if (cur) {
      const s = cur.shot();
      this.camPosGoal.fromArray(s.pos);
      this.camTargetGoal.fromArray(s.target);
      this.setPalette(cur.palette());
    }
    smoothDamp(this.camPos, this.camPosGoal, this.camPosVel, 0.95, dt);
    smoothDamp(this.camTarget, this.camTargetGoal, this.camTargetVel, 0.95, dt);
    const sw = 0.05; // jemné „dýchání“ kamery
    this.camera.position.set(
      this.camPos.x + Math.sin(t * 0.21) * sw,
      this.camPos.y + Math.sin(t * 0.17 + 1) * sw * 0.6,
      this.camPos.z + Math.sin(t * 0.13) * sw * 0.5
    );
    this.camera.lookAt(this.camTarget);
    this.camera.updateMatrixWorld();
    this.sky.position.copy(this.camera.position);
    this.updatePalette(dt);
    this.dustU.uTime.value = t;
    this.starU.uTime.value = t;

    for (const act of this.actList) act.tick(dt, t);
    this.phone.tick(dt, t);
    this.scene.updateMatrixWorld();
    this.updateLabels();

    this.grade.uniforms.uTime.value = t;
    this.composer.render(dt);
    this.governor(dt);
  }

  /** Slabý počítač: nejdřív snížit rozlišení, pak vypnout bloom. */
  governor(dt) {
    if (navigator.webdriver || this.t < 3) return;
    this.gAcc = (this.gAcc || 0) + dt;
    this.gN = (this.gN || 0) + 1;
    if (this.gAcc < 2) return;
    const avg = this.gAcc / this.gN;
    this.gAcc = 0;
    this.gN = 0;
    if (avg > 1 / 34) {
      if (this.pr > 1) {
        this.pr = Math.max(1, this.pr - 0.5);
        this.resize();
      } else if (this.bloom.enabled) {
        this.bloom.enabled = false;
      }
    }
  }
}

/* ==========================================================================
   SDÍLENÉ STAVEBNÍ KAMENY PRO AKTY
   ========================================================================== */

/** Svítící materiál (sčítá se se scénou, bloom ho rozzáří). */
function addMat(hex, k = 1, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(hex).multiplyScalar(k),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.22, 'rgba(255,255,255,0.5)');
  gr.addColorStop(0.55, 'rgba(255,255,255,0.1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

function glowSprite(hex, k, size, opacity = 1) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color: new THREE.Color(hex).multiplyScalar(k),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  s.scale.setScalar(size);
  return s;
}

/** Podlaha z jemné mřížky, která do stran mizí. */
function makeGrid(size, hex, cell = 0.5, radius = 6) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(hex) },
      uAmt: { value: 1 },
      uCell: { value: cell },
      uR: { value: radius },
    },
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAmt, uCell, uR;
      varying vec2 vP;
      void main() {
        vec2 q = vP / uCell;
        vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        float fade = 1.0 - smoothstep(uR * 0.2, uR, length(vP));
        gl_FragColor = vec4(uColor, line * fade * 0.42 * uAmt);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Parametr u (0..1, podle délky) bodu křivky nejblíž k p. */
function closestU(curve, p, n = 800) {
  let best = 0, bd = Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, v);
    const d = v.distanceToSquared(p);
    if (d < bd) {
      bd = d;
      best = i / n;
    }
  }
  return best;
}

function canvasTexture(cv, aniso = 8) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
