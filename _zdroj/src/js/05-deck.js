/* ==========================================================================
   DECK — přepínání slidů a kroků, klávesy, video, poznámky a časomíra
   Funguje i bez 3D (engine = null): texty, video i poznámky jedou dál.
   ========================================================================== */

class Deck {
  constructor(engine) {
    this.e = engine;
    this.slides = [...document.querySelectorAll('.slide')];
    this.n = this.slides.length;
    this.i = -1;
    this.step = 0;
    this.slideAge = 0;
    this.plan = this.slides.map((s) => +s.dataset.time || 60);
    this.timerStart = null;
    this.counter = document.getElementById('counter');
    this.progress = document.getElementById('progress');
    this.tapEl = document.getElementById('tap');
    this.codeLines = [...document.querySelectorAll('#codeBlock [data-flow]')];
    this.verdict = document.getElementById('verdict');
    this.clock = document.getElementById('farmClock');
    this.farmSlide = document.getElementById('farmSlide');
    this.videoSlide = document.getElementById('videoSlide');

    this.setupKeys();
    this.setupPointer();
    this.setupVideo();
    const [i, s] = this.fromHash();
    this.go(i, s, 1);

    let last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  stepsOf(i) {
    return Math.max(1, +this.slides[i].dataset.steps || 1);
  }

  next() {
    this.startTimer();
    if (this.step < this.stepsOf(this.i) - 1) this.setStep(this.step + 1, 1);
    else if (this.i < this.n - 1) this.go(this.i + 1, 0, 1);
  }

  prev() {
    if (this.step > 0) this.setStep(this.step - 1, -1);
    else if (this.i > 0) this.go(this.i - 1, this.stepsOf(this.i - 1) - 1, -1);
  }

  go(i, step, dir) {
    i = clamp(i, 0, this.n - 1);
    const prev = this.slides[this.i];
    const next = this.slides[i];
    if (prev !== next) {
      if (prev) {
        prev.classList.remove('is-active', 'is-done');
        prev.classList.add('is-leaving');
        clearTimeout(prev._leave);
        prev._leave = setTimeout(() => prev.classList.remove('is-leaving'), 800);
        this.onLeave(prev);
        this.tap();
      }
      clearTimeout(next._leave);
      next.classList.remove('is-leaving', 'is-active', 'is-done');
      void next.offsetWidth; // vynutí přepočet, aby se nástupové animace pustily znovu
      next.classList.add('is-active');
      this.slideAge = 0;
    }
    this.i = i;
    this.step = clamp(step, 0, this.stepsOf(i) - 1);
    this.applyStep();
    if (this.e) this.e.showSlide(next.dataset, this.step, dir);
    if (prev !== next) this.onEnter(next);
    this.updateHud();
  }

  setStep(step, dir) {
    this.step = step;
    this.applyStep();
    if (this.e) this.e.showSlide(this.slides[this.i].dataset, step, dir);
    this.updateHud();
  }

  /** Prvky s data-step dostanou is-current / is-past podle aktuálního kroku. */
  applyStep() {
    this.slides[this.i].querySelectorAll('[data-step]').forEach((el) => {
      const k = +el.dataset.step;
      el.classList.toggle('is-current', k === this.step);
      el.classList.toggle('is-past', k < this.step);
    });
  }

  onEnter(slide) {
    slide.querySelectorAll('[data-count]').forEach((el) => {
      if (el.closest('.report')) return; // report se rozpočítá až ráno
      const holder = el.closest('.reveal');
      const d = holder ? parseFloat(getComputedStyle(holder).getPropertyValue('--d')) || 0 : 0;
      this.countUp(el, 440 + d * 85);
    });
    if (slide === this.videoSlide) this.playVideo(true);
    if (slide === this.farmSlide) this.clock.textContent = '23:00';
  }

  onLeave(slide) {
    if (slide === this.videoSlide) this.video.pause();
  }

  countUp(el, delay) {
    const to = +el.dataset.count, dur = 1300, t0 = performance.now() + delay;
    el.textContent = '0';
    const tick = (now) => {
      const k = ease.outExpo(clamp((now - t0) / dur, 0, 1));
      el.textContent = Math.round(to * k).toLocaleString('cs-CZ');
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  tap() {
    const el = this.tapEl;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
  }

  /* --- průběžné věci navázané na čas --- */
  frame(dt) {
    this.slideAge += dt;
    const slide = this.slides[this.i];
    if (slide.dataset.act === 'code') this.syncCode();
    if (slide === this.farmSlide) this.syncFarm(slide);
    if (document.body.classList.contains('show-notes')) this.renderNotesMeta(false);
  }

  /** Zvýraznění řádků kódu podle toho, co právě dělá telefon vpravo. */
  syncCode() {
    const ft = this.e ? this.e.phone.flowT : (performance.now() / 1000) % FLOW_LEN;
    const step = FLOW_STEPS.findIndex(([a, b]) => ft >= a && ft < b);
    const done = ft >= FLOW_DONE;
    this.codeLines.forEach((ln, i) => {
      ln.classList.toggle('is-run', i === step);
      ln.classList.toggle('is-ok', done || (step >= 0 && i < step));
    });
    this.verdict.classList.toggle('is-on', done);
  }

  /** Zrychlená noc 23:00 → 06:00, ráno vyjede report. */
  syncFarm(slide) {
    const age = this.e ? this.e.acts.farm.age : this.slideAge;
    const k = clamp((age - 0.8) / 9, 0, 1);
    const mins = 23 * 60 + Math.round(k * 84) * 5;
    const hh = Math.floor(mins / 60) % 24, mm = mins % 60;
    this.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (age >= 9.8 && !slide.classList.contains('is-done')) {
      slide.classList.add('is-done');
      slide.querySelectorAll('.report [data-count]').forEach((el, j) => this.countUp(el, 250 + j * 150));
    }
  }

  /* --- HUD: číslo slidu, tečky kroků, průběh --- */
  updateHud() {
    const steps = this.stepsOf(this.i);
    const num = `${String(this.i + 1).padStart(2, '0')} / ${String(this.n).padStart(2, '0')}`;
    let dots = '';
    if (steps > 1) {
      dots = '<span class="dots">';
      for (let k = 0; k < steps; k++) dots += `<i class="${k <= this.step ? 'on' : ''}"></i>`;
      dots += '</span>';
    }
    this.counter.innerHTML = `<span>${num}</span>${dots}`;
    this.progress.style.width = `${((this.i + (this.step + 1) / steps) / this.n) * 100}%`;
    try {
      history.replaceState(null, '', `#${this.i + 1}${this.step ? '.' + (this.step + 1) : ''}`);
    } catch (err) {
      /* file:// v některých prohlížečích */
    }
    if (document.body.classList.contains('show-notes')) this.renderNotes();
  }

  fromHash() {
    const m = /^#(\d+)(?:\.(\d+))?$/.exec(location.hash);
    if (!m) return [0, 0];
    return [clamp(+m[1] - 1, 0, this.n - 1), Math.max(0, (+m[2] || 1) - 1)];
  }

  /* --- ovládání --- */
  setupKeys() {
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const onVideo = this.slides[this.i] === this.videoSlide;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(k)) {
        e.preventDefault();
        this.next();
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) {
        e.preventDefault();
        this.prev();
      } else if (k === 'Home') {
        e.preventDefault();
        this.go(0, 0, -1);
      } else if (k === 'End') {
        e.preventDefault();
        this.go(this.n - 1, 0, 1);
      } else if (k === 'f' || k === 'F') {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.().catch(() => {});
      } else if (k === 'n' || k === 'N') {
        document.body.classList.toggle('show-notes');
        this.renderNotes();
      } else if (k === 'b' || k === 'B' || k === '.') {
        document.body.classList.toggle('is-black');
      } else if (k === 'h' || k === 'H' || k === '?') {
        document.body.classList.toggle('show-help');
      } else if (k === 'Escape') {
        document.body.classList.remove('show-help', 'is-black');
      } else if ((k === 'p' || k === 'P' || k === 'k' || k === 'K') && onVideo) {
        this.toggleVideo();
      } else if ((k === 'r' || k === 'R') && onVideo) {
        this.playVideo(true);
      } else if (k === 't' || k === 'T') {
        this.timerStart = performance.now();
        this.renderNotesMeta(true);
      }
    });
  }

  setupPointer() {
    document.querySelectorAll('[data-nav]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        b.blur();
        if (b.dataset.nav === 'next') this.next();
        else this.prev();
      })
    );
    let hide;
    addEventListener('mousemove', () => {
      document.body.classList.add('show-ui');
      clearTimeout(hide);
      hide = setTimeout(() => document.body.classList.remove('show-ui'), 2200);
    });
    let x0 = null, y0 = null;
    addEventListener('touchstart', (e) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
    }, { passive: true });
    addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) this.next();
        else this.prev();
      }
      x0 = null;
    });
  }

  /* --- video z praxe ---
     Zkouší video/ukazka.mp4 (a pár dalších přípon) vedle prezentace.
     Když nic nenajde, ukáže v telefonu návod. Video jde i přetáhnout myší. */
  setupVideo() {
    const v = (this.video = document.getElementById('demoVideo'));
    const dev = (this.device = document.getElementById('device'));
    const sources = ['video/ukazka.mp4', 'video/ukazka.webm', 'video/ukazka.mov', 'video/ukazka.m4v', 'ukazka.mp4'];
    let si = 0;
    const tryNext = () => {
      if (si < sources.length) {
        v.src = sources[si++];
        v.load();
      }
    };
    v.addEventListener('error', () => {
      if (!this.userVideo) tryNext();
    });
    v.addEventListener('loadedmetadata', () => {
      const ar = v.videoWidth / v.videoHeight || 0.46;
      dev.style.setProperty('--ar', ar.toFixed(4));
      const land = ar > 1.05;
      dev.classList.toggle('is-landscape', land);
      this.videoSlide.classList.toggle('is-landscape', land);
      dev.classList.add('has-video');
      if (this.slides[this.i] === this.videoSlide) this.playVideo(true);
    });
    dev.addEventListener('click', () => this.toggleVideo());
    tryNext();

    addEventListener('dragover', (e) => {
      e.preventDefault();
      dev.classList.add('is-drop');
    });
    addEventListener('dragleave', (e) => {
      if (!e.relatedTarget) dev.classList.remove('is-drop');
    });
    addEventListener('drop', (e) => {
      e.preventDefault();
      dev.classList.remove('is-drop');
      const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(x.name));
      if (!f) return;
      this.userVideo = true;
      v.src = URL.createObjectURL(f);
      v.load();
      const idx = this.slides.indexOf(this.videoSlide);
      if (this.i !== idx) this.go(idx, 0, 1);
    });
  }

  playVideo(restart) {
    if (!this.device.classList.contains('has-video')) return;
    if (restart) this.video.currentTime = 0;
    this.device.classList.remove('is-paused');
    this.video.play().catch(() => {});
  }

  toggleVideo() {
    if (!this.device.classList.contains('has-video')) return;
    if (this.video.paused) this.playVideo(false);
    else {
      this.video.pause();
      this.device.classList.add('is-paused');
    }
  }

  /* --- poznámky pro řečníka a časomíra (klávesa N) --- */
  startTimer() {
    if (!this.timerStart) this.timerStart = performance.now();
  }

  renderNotes() {
    const notes = this.slides[this.i].querySelector('.notes');
    document.getElementById('npBody').innerHTML = notes ? notes.innerHTML : '';
    this.renderNotesMeta(true);
  }

  renderNotesMeta(force) {
    const now = performance.now();
    if (!force && now - (this._nm || 0) < 250) return;
    this._nm = now;
    const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const start = this.plan.slice(0, this.i).reduce((a, b) => a + b, 0);
    const end = start + this.plan[this.i];
    const total = this.plan.reduce((a, b) => a + b, 0);
    const el = this.timerStart ? (now - this.timerStart) / 1000 : 0;
    const late = el > end + 15;
    document.getElementById('npMeta').innerHTML =
      `<span>Slide <b>${this.i + 1} z ${this.n}</b></span>` +
      `<span>Na tenhle slide <b>${fmt(this.plan[this.i])}</b></span>` +
      `<span>Podle plánu <b>${fmt(start)} až ${fmt(end)}</b></span>` +
      `<span class="${late ? 'late' : 'ok'}">Uplynulo <b>${fmt(el)}</b> z ${fmt(total)}</span>` +
      (this.timerStart ? '' : '<span>Časomíra se spustí prvním posunem dál.</span>');
  }
}
