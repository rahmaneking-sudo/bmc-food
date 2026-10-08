/*
 * Moteur du vol : associe le défilement natif aux images de la séquence, temps par temps.
 * - Chronologie par morceaux : chaque temps a son intervalle de défilement (vh) et son intervalle d'images.
 * - Les images compressées (blobs) sont gardées en cache ; seules quelques images décodées
 *   (ImageBitmap) restent en mémoire, les plus anciennes sont libérées (close()).
 * - Priorité à l'image demandée puis à ses voisines dans le sens du défilement ;
 *   requêtes limitées en parallèle, requêtes obsolètes abandonnées, nouvelles tentatives bornées.
 */
(function () {
  "use strict";

  const MAX_PARALLEL = 6;
  const MAX_BITMAPS = 18; // images 1600 px : ~6 Mo décodées chacune, on reste sous ~110 Mo sur mobile
  const MAX_RETRIES = 2;
  const AHEAD = 36;
  const BEHIND = 10;
  const DECODE_AHEAD = 12;
  const DECODE_BEHIND = 4;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function smooth(t) { return t * t * (3 - 2 * t); }

  class FrameStore {
    constructor(manifest, onFrame) {
      this.m = manifest;
      this.onFrame = onFrame;
      this.blobs = new Map();      // index -> Blob
      this.bitmaps = new Map();    // index -> ImageBitmap (ordre = LRU)
      this.decoding = new Map();   // index -> Promise
      this.inflight = new Map();   // index -> AbortController
      this.failures = new Map();   // index -> tentatives
      this.wanted = [];
      this.fillStride = 16;
      this.fillCursor = 0;
    }

    url(i) {
      const pad = String(i).padStart(4, "0");
      return this.m.pattern.replace("{i}", pad) + "?v=" + encodeURIComponent(this.m.version);
    }

    /* Recalcule la file de priorité autour de l'image courante. */
    focus(current, direction) {
      const n = this.m.count;
      const list = [current];
      const fwd = direction >= 0 ? 1 : -1;
      for (let k = 1; k <= AHEAD; k++) list.push(current + k * fwd);
      for (let k = 1; k <= BEHIND; k++) list.push(current - k * fwd);
      this.wanted = list.filter((i) => i >= 0 && i < n);
      this.current = current;
      // Ne décode que la proximité immédiate (moins que la taille du cache, pour ne pas évincer l'image courante).
      for (let k = -DECODE_BEHIND; k <= DECODE_AHEAD; k++) {
        const j = current + k * fwd;
        if (j >= 0 && j < n && this.blobs.has(j)) this.decode(j);
      }

      // Abandonne les téléchargements trop éloignés de la zone utile.
      const keep = new Set(this.wanted);
      for (const [i, ctrl] of this.inflight) {
        if (!keep.has(i) && Math.abs(i - current) > AHEAD * 2) {
          ctrl.abort();
          this.inflight.delete(i);
        }
      }
      this.pump();
    }

    /* Remplissage de fond progressif : 1 image sur 16, puis 8, 4, 2, 1. */
    nextFill() {
      const n = this.m.count;
      while (this.fillStride >= 1) {
        while (this.fillCursor < n) {
          const i = this.fillCursor;
          this.fillCursor += this.fillStride;
          if (!this.blobs.has(i) && !this.inflight.has(i) && (this.failures.get(i) || 0) <= MAX_RETRIES) return i;
        }
        this.fillStride = this.fillStride / 2;
        this.fillCursor = 0;
        if (this.fillStride < 1) break;
      }
      return -1;
    }

    pump() {
      while (this.inflight.size < MAX_PARALLEL) {
        let next = this.wanted.find((i) => !this.blobs.has(i) && !this.inflight.has(i) && (this.failures.get(i) || 0) <= MAX_RETRIES);
        if (next === undefined) next = this.nextFill();
        if (next < 0 || next === undefined) return;
        this.fetch(next);
      }
    }

    /* Sur http(s) : fetch + Blob. En file:// (zip ouvert en double-clic) fetch est bloqué : repli sur Image(). */
    load(url, signal) {
      if (location.protocol.startsWith("http")) {
        return fetch(url, { signal }).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); });
      }
      return new Promise((resolve, reject) => {
        const img = new Image();
        signal.addEventListener("abort", () => { img.src = ""; reject(new DOMException("aborted", "AbortError")); });
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("image"));
        img.src = url;
      });
    }

    fetch(i) {
      const ctrl = new AbortController();
      this.inflight.set(i, ctrl);
      this.load(this.url(i), ctrl.signal)
        .then((blob) => {
          this.blobs.set(i, blob);
          this.failures.delete(i);
          if (Math.abs(i - this.current) <= DECODE_AHEAD) this.decode(i);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          const tries = (this.failures.get(i) || 0) + 1;
          this.failures.set(i, tries);
          if (tries <= MAX_RETRIES) setTimeout(() => this.pump(), 400 * tries);
        })
        .finally(() => {
          if (this.inflight.get(i) === ctrl) this.inflight.delete(i);
          this.pump();
        });
    }

    decode(i) {
      if (this.bitmaps.has(i) || this.decoding.has(i) || !this.blobs.has(i)) return this.decoding.get(i);
      const p = createImageBitmap(this.blobs.get(i))
        .then((bmp) => {
          this.bitmaps.set(i, bmp);
          this.evict();
          this.onFrame(i);
        })
        .catch(() => {})
        .finally(() => this.decoding.delete(i));
      this.decoding.set(i, p);
      return p;
    }

    evict() {
      while (this.bitmaps.size > MAX_BITMAPS) {
        const oldest = this.bitmaps.keys().next().value;
        const bmp = this.bitmaps.get(oldest);
        this.bitmaps.delete(oldest);
        if (bmp && bmp.close) bmp.close();
      }
    }

    /* Renvoie l'image décodée la plus proche disponible (et marque l'usage LRU). */
    nearest(i) {
      if (this.bitmaps.has(i)) {
        const b = this.bitmaps.get(i);
        this.bitmaps.delete(i);
        this.bitmaps.set(i, b);
        return { index: i, bmp: b };
      }
      if (this.blobs.has(i)) this.decode(i);
      for (let d = 1; d < 48; d++) {
        for (const j of [i - d, i + d]) {
          if (this.bitmaps.has(j)) return { index: j, bmp: this.bitmaps.get(j) };
        }
      }
      return null;
    }

    loadedRatio() { return this.blobs.size / this.m.count; }
  }

  class Flight {
    constructor(root, content, manifest) {
      this.root = root;
      this.c = content;
      this.m = manifest;
      this.stage = root.querySelector(".flight__stage");
      this.canvas = root.querySelector("canvas");
      this.ctx = this.canvas.getContext("2d", { alpha: false });
      this.poster = new Image();
      this.poster.src = manifest.poster;
      this.poster.onload = () => this.draw(true);
      this.chapters = Array.from(root.querySelectorAll("[data-chapter]"));
      this.hudIndex = root.querySelector("[data-hud-index]");
      this.hudLabel = root.querySelector("[data-hud-label]");
      this.hudTime = root.querySelector("[data-hud-time]");
      this.hudBar = root.querySelector("[data-hud-bar]");
      // Mode « scènes en relief » (2,5D) si content.scenes existe ; sinon séquence d'images vidéo.
      this.layers = Array.isArray(content.scenes) && content.scenes.length > 0;
      if (this.layers) {
        this.canvas.hidden = true;
        this.buildLayers();
      } else {
        this.store = new FrameStore(manifest, (i) => { if (Math.abs(i - this.frame) < 3) this.draw(true); });
      }
      this.frame = 0;
      this.drawn = -1;
      this.lastY = window.scrollY;
      this.buildTimeline();
      this.resize();
      window.addEventListener("resize", () => this.resize(), { passive: true });
      window.addEventListener("scroll", () => this.request(), { passive: true });
      this.update();
    }

    /* Prépare la chronologie : position de départ (en vh) de chaque temps et plage de chaque chapitre. */
    buildTimeline() {
      let at = 0;
      this.beats = this.c.beats.map((b) => {
        const beat = Object.assign({}, b, { start: at, end: at + b.vh });
        at += b.vh;
        return beat;
      });
      this.totalVh = at;
      this.ranges = {};
      for (const b of this.beats) {
        if (!b.chapter) continue;
        const r = this.ranges[b.chapter] || (this.ranges[b.chapter] = { start: b.start, end: b.end });
        r.start = Math.min(r.start, b.start);
        r.end = Math.max(r.end, b.end);
      }
      // Hauteur de la section = défilement actif épinglé + un écran pour la scène visible.
      this.root.style.height = (this.totalVh + 1) * 100 + "vh";
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.stage.clientWidth;
      const h = this.stage.clientHeight;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.top = this.root.getBoundingClientRect().top + window.scrollY;
      this.draw(true);
      this.update();
    }

    request() {
      if (document.hidden) { this.update(); return; }
      if (this.raf) return;
      this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); });
    }

    /* Position de défilement active, en hauteurs d'écran, depuis le début de la section. */
    scrolledVh() {
      const active = this.root.offsetHeight - window.innerHeight;
      const y = clamp(window.scrollY - this.top, 0, active);
      return (y / window.innerHeight);
    }

    update() {
      const s = clamp(this.scrolledVh(), 0, this.totalVh);
      const dir = window.scrollY >= this.lastY ? 1 : -1;
      this.lastY = window.scrollY;

      const beat = this.beats.find((b) => s < b.end) || this.beats[this.beats.length - 1];
      const local = beat.vh ? clamp((s - beat.start) / beat.vh, 0, 1) : 1;
      const t = beat.from + (beat.to - beat.from) * local;
      this.time = t;
      if (this.layers) {
        this.renderLayers(t);
      } else {
        this.frame = clamp(Math.round((t / this.m.duration) * (this.m.count - 1)), 0, this.m.count - 1);
        this.store.focus(this.frame, dir);
        this.draw(false);
      }
      this.updateText(s);
      this.updateHud(s, beat);
    }

    /* --- Scènes en relief : décor + personne détourée, chacun avec sa propre vitesse de rapprochement. --- */
    buildLayers() {
      const box = document.createElement("div");
      box.className = "flight__layers";
      box.setAttribute("aria-hidden", "true");
      this.sceneEls = this.c.scenes.map((sc, k) => {
        const el = document.createElement("div");
        el.className = "layer-scene";
        const origin = (sc.focus || [0.5, 0.5]).map((v) => v * 100 + "%").join(" ");
        const bg = new Image();
        bg.className = "layer-scene__bg";
        bg.src = sc.bg;
        bg.alt = "";
        bg.decoding = "async";
        if (k > 0) bg.loading = "lazy";
        bg.style.transformOrigin = origin;
        el.appendChild(bg);
        let fg = null;
        if (sc.fg) {
          fg = new Image();
          fg.className = "layer-scene__fg";
          fg.src = sc.fg;
          fg.alt = "";
          fg.decoding = "async";
          fg.style.transformOrigin = origin;
          el.appendChild(fg);
        }
        box.appendChild(el);
        return { sc, el, bg, fg };
      });
      this.stage.insertBefore(box, this.stage.querySelector(".flight__shade"));
    }

    renderLayers(t) {
      const ease = (x) => x * x * (3 - 2 * x);
      // Écran vertical : l'image est déjà recadrée par « cover », on zoome moins pour garder les visages.
      const portrait = window.innerHeight > window.innerWidth;
      const zoomK = portrait ? 0.55 : 1;
      const parK = portrait ? 0.3 : 0.55;
      for (const L of this.sceneEls) {
        const sc = L.sc;
        const span = sc.to - sc.from;
        const p = (t - sc.from) / span;
        // Fenêtre de visibilité : la scène suivante commence pendant la « traversée » de la précédente.
        const inDur = sc.fadeIn != null ? sc.fadeIn : 0.14;
        const outDur = sc.fadeOut != null ? sc.fadeOut : 0.18;
        if (p < -inDur || p > 1) { if (L.el.style.visibility !== "hidden") L.el.style.visibility = "hidden"; continue; }
        L.el.style.visibility = "visible";
        const q = clamp(p, 0, 1);
        const amp = (sc.push != null ? sc.push : 0.22) * zoomK;
        // Caméra : poussée lente (ou recul pour la scène de sortie), légère dérive latérale façon drone.
        let s = sc.reverse ? 1.04 + 0.51 * zoomK * (1 - ease(q)) : 1.06 + amp * q;
        let ty = sc.reverse ? (1 - ease(q)) * -6 : 0;
        const tx = Math.sin(q * Math.PI) * (sc.drift != null ? sc.drift : -1.6);
        let op = 1;
        // Entrée : la scène arrive légèrement plus grande et se fond.
        if (p < inDur && sc.from > 0) {
          const k = clamp((p + inDur) / inDur, 0, 1);
          op = ease(k);
          s *= 1 + 0.12 * (1 - k);
        }
        // Sortie : on « traverse » vers le point de fuite (porte, fond de salle) puis fondu.
        if (!sc.last && p > 1 - outDur) {
          const k = clamp((p - (1 - outDur)) / outDur, 0, 1);
          s *= 1 + 1.4 * k * k;
          op = Math.min(op, 1 - ease(k));
        }
        L.el.style.opacity = op.toFixed(3);
        // Le point de zoom glisse du sujet vers le point de fuite pendant la traversée.
        const f = sc.focus || [0.5, 0.5];
        const e = sc.exit || f;
        const k = !sc.last && p > 1 - outDur ? ease(clamp((p - (1 - outDur)) / outDur, 0, 1)) : 0;
        const o = (f[0] + (e[0] - f[0]) * k) * 100 + "% " + (f[1] + (e[1] - f[1]) * k) * 100 + "%";
        L.bg.style.transformOrigin = o;
        if (L.fg) L.fg.style.transformOrigin = o;
        L.bg.style.transform = "translate3d(" + tx.toFixed(2) + "%," + ty.toFixed(2) + "%,0) scale(" + s.toFixed(4) + ")";
        if (L.fg) {
          // La personne est plus proche : elle grossit plus vite que le décor (effet de profondeur).
          const par = sc.parallax != null ? sc.parallax : 1;
          const fs = 1 + (s - 1) * (1 + parK * par);
          L.fg.style.transform = "translate3d(" + (tx * (1 + 0.6 * par)).toFixed(2) + "%," + ty.toFixed(2) + "%,0) scale(" + fs.toFixed(4) + ")";
        }
      }
    }

    draw(force) {
      if (this.layers) return;
      const hit = this.store.nearest(this.frame);
      const src = hit ? hit.bmp : (this.poster.complete && this.poster.naturalWidth ? this.poster : null);
      const key = hit ? hit.index : -2;
      if (!src || (!force && key === this.drawn)) return;
      this.drawn = key;
      const cw = this.canvas.width, ch = this.canvas.height;
      const iw = src.width, ih = src.height;
      const scale = Math.max(cw / iw, ch / ih);
      const dw = iw * scale, dh = ih * scale;
      // Agrandissement de meilleure qualité (le réglage par défaut des navigateurs est « low »).
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = "high";
      this.ctx.drawImage(src, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }

    /* Le texte apparaît, se maintient puis disparaît dans la plage de son chapitre. */
    updateText(s) {
      const first = this.c.chapters[0].id;
      const last = this.c.chapters[this.c.chapters.length - 1].id;
      for (const el of this.chapters) {
        const id = el.dataset.chapter;
        const r = this.ranges[id];
        let o = 0;
        if (r) {
          const span = r.end - r.start;
          const fade = Math.min(0.45, span * 0.22);
          const inP = id === first ? 1 : clamp((s - r.start) / fade, 0, 1);
          const outP = id === last ? 1 : clamp((r.end - s) / fade, 0, 1);
          o = s < r.start - 0.001 || s > r.end + 0.001 ? 0 : Math.min(inP, outP);
          if (id === first && s <= r.start) o = 1;
        }
        const e = smooth(o);
        el.style.opacity = e.toFixed(3);
        el.style.transform = "translate3d(0," + ((1 - e) * 28).toFixed(1) + "px,0)";
        const visible = e > 0.04;
        if (visible !== !el.inert) {
          el.inert = !visible;
          el.setAttribute("aria-hidden", visible ? "false" : "true");
        }
      }
    }

    updateHud(s, beat) {
      const ch = beat.chapter && this.c.chapters.find((c) => c.id === beat.chapter);
      if (this.hudIndex && ch) this.hudIndex.textContent = ch.index;
      if (this.hudLabel) this.hudLabel.textContent = ch ? ch.label : "En vol";
      if (this.hudTime) {
        const sec = Math.floor(this.time);
        this.hudTime.textContent = "00:" + String(sec).padStart(2, "0");
      }
      if (this.hudBar) this.hudBar.style.transform = "scaleX(" + (s / this.totalVh).toFixed(4) + ")";
    }

    progressReady() {
      if (this.layers) {
        const first = this.sceneEls[0];
        return first.bg.complete && (!first.fg || first.fg.complete) ? 1 : 0;
      }
      return this.store.loadedRatio();
    }
  }

  window.BMCFlight = Flight;
})();
