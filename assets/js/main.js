/* BMC Food : rendu du contenu, mode allégé, carte filtrable, en-tête adaptatif. */
(function () {
  "use strict";

  const C = window.BMC_CONTENT;
  const M = window.BMC_FRAMES;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fmt = (n) => n.toLocaleString("fr-FR").replace(/ | /g, " ") + " F";
  const params = new URLSearchParams(location.search);

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const conn = navigator.connection || {};
  // Le vol (vidéo ou scènes en relief) tourne aussi sur mobile ; version fixe seulement si mouvement réduit, économie de données ou très peu de mémoire.
  const heavy = !(C.scenes && C.scenes.length);
  const lite =
    params.get("lite") === "1" ||
    (params.get("full") !== "1" &&
      (reduced || conn.saveData === true || (heavy && (navigator.deviceMemory || 8) <= 2)));

  const frameUrl = (sec) => {
    const i = Math.max(0, Math.min(M.count - 1, Math.round((sec / M.duration) * (M.count - 1))));
    return M.pattern.replace("{i}", String(i).padStart(4, "0")) + "?v=" + M.version;
  };

  function chapterHTML(ch, tag) {
    const cta = ch.cta
      ? `<a class="btn btn--amber" href="${ch.cta.href}"${ch.cta.filter ? ` data-goto-filter="${ch.cta.filter}"` : ""}>${ch.cta.label}<span class="btn__arrow" aria-hidden="true">→</span></a>`
      : "";
    return `
      <p class="chapter__eyebrow"><span class="chapter__index">${ch.index}</span>${ch.eyebrow}</p>
      <${tag} class="chapter__title">${ch.title}</${tag}>
      <p class="chapter__text">${ch.text}</p>
      ${cta}`;
  }

  /* ---------- Visite ---------- */
  const flightRoot = $("#visite");
  if (lite) {
    flightRoot.hidden = true;
    const liteRoot = $("#visite-lite");
    liteRoot.hidden = false;
    $("[data-lite]").innerHTML = C.chapters
      .map(
        (ch, k) => `
        <article class="lite__chapter" id="chapitre-${ch.id}">
          <figure class="lite__media"><img src="${ch.image || (k === 0 ? M.poster : frameUrl(ch.poster))}" alt="" ${k ? 'loading="lazy"' : 'fetchpriority="high"'} width="${M.width}" height="${M.height}"></figure>
          <div class="lite__body${k ? " reveal" : ""}">${chapterHTML(ch, k === 0 ? "h1" : "h2")}</div>
        </article>`
      )
      .join("");
  } else {
    $("[data-chapters]").innerHTML = C.chapters
      .map((ch, k) => `<article class="chapter chapter--${ch.align}" data-chapter="${ch.id}" id="chapitre-${ch.id}">${chapterHTML(ch, k === 0 ? "h1" : "h2")}</article>`)
      .join("");
    if (M.placeholder && heavy) $("[data-placeholder]").hidden = false;
  }

  /* ---------- Savoir-faire ---------- */
  $("[data-craft]").innerHTML = C.savoirFaire
    .map((s) => `<li class="craft__item reveal"><span class="craft__n">${s.n}</span><h3 class="craft__t">${s.title}</h3><p>${s.text}</p></li>`)
    .join("");
  const words = C.savoirFaire.map((s) => s.title).concat(["BMC Food"]);
  const run = words.map((w) => `<span>${w}</span><i>✦</i>`).join("");
  $("[data-marquee]").innerHTML = run + run + run;

  /* ---------- Carte ---------- */
  $("[data-menu]").innerHTML = C.menu
    .map(
      (cat) => `
      <section class="cat reveal" data-cat="${cat.id}" aria-labelledby="cat-${cat.id}">
        <header class="cat__head">
          <h3 class="cat__name" id="cat-${cat.id}">${cat.name}</h3>
          <p class="cat__note">${cat.note}</p>
        </header>
        <ul class="cat__list">
          ${cat.items
            .map((it) => {
              const tags = it.tags || [];
              const pills = tags
                .map((t) => `<span class="pill pill--${t}">${{ royal: "Royal", gratine: "Gratiné", xl: "XL", giga: "Giga" }[t]}</span>`)
                .join("");
              return `<li class="item" data-tags="${tags.join(" ")}"><span class="item__name">${it.name}${pills}</span><span class="item__dots" aria-hidden="true"></span><span class="item__price">${fmt(it.price)}</span></li>`;
            })
            .join("")}
        </ul>
      </section>`
    )
    .join("");

  const countEl = $("[data-count]");
  function applyFilter(f) {
    $$("[data-filter]").forEach((b) => {
      const on = b.dataset.filter === f;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on);
    });
    let n = 0;
    $$(".cat").forEach((cat) => {
      let visible = 0;
      $$(".item", cat).forEach((it) => {
        const tags = it.dataset.tags.split(" ");
        const show = f === "all" || f === cat.dataset.cat || (f === "giga" && cat.dataset.cat === "giga") || tags.includes(f);
        it.hidden = !show;
        if (show) visible++;
      });
      cat.hidden = visible === 0;
      n += visible;
    });
    countEl.textContent = n + (n > 1 ? " tacos à la carte" : " tacos");
  }
  $$("[data-filter]").forEach((b) => b.addEventListener("click", () => applyFilter(b.dataset.filter)));
  applyFilter("all");
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-goto-filter]");
    if (a) applyFilter(a.dataset.gotoFilter);
  });

  /* ---------- Infos ---------- */
  const b = C.brand;
  $("[data-address]").innerHTML = "Cité Mixta,<br><em>IDA · Point E</em>";
  $("[data-address-line]").textContent = b.address;
  $("[data-hours]").textContent = b.hours;
  if (b.phones && b.phones.length) {
    $("[data-phones]").innerHTML = b.phones.map((p) => `<li><a href="tel:${p.replace(/\s/g, "")}">${p}</a></li>`).join("");
  } else {
    $("[data-phones-block]").remove();
  }
  $("[data-footnote]").textContent = C.footerNote;
  $("[data-year]").textContent = new Date().getFullYear();

  /* ---------- En-tête lisible sur sections sombres et claires ---------- */
  const nav = $("[data-nav]");
  const themed = $$("[data-theme]");
  const flightSection = $("#visite");
  let lastNavY = window.scrollY;
  function navTheme() {
    // Pendant le vol, l'en-tête s'efface en descendant (pour ne pas cacher les visages) et revient dès qu'on remonte.
    const y = window.scrollY;
    const fr = flightSection && !flightSection.hidden ? flightSection.getBoundingClientRect() : null;
    const inFlight = fr && fr.top <= 0 && fr.bottom > window.innerHeight * 0.5;
    if (inFlight && y > lastNavY + 4 && y > 60) nav.classList.add("is-hidden");
    else if (!inFlight || y < lastNavY - 4) nav.classList.remove("is-hidden");
    nav.classList.toggle("is-over-flight", !!inFlight);
    lastNavY = y;
    const probe = nav.offsetHeight / 2;
    let theme = "dark";
    for (const s of themed) {
      const r = s.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) theme = s.dataset.theme;
    }
    nav.dataset.on = theme;
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
  }
  window.addEventListener("scroll", navTheme, { passive: true });
  navTheme();

  /* ---------- Apparitions au défilement ---------- */
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } }),
      { rootMargin: "0px 0px -10% 0px" }
    );
    $$(".reveal").forEach((el) => io.observe(el));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- Démarrage du vol + écran d'intro ---------- */
  const loader = $(".loader");
  const bar = $(".loader__bar span");
  function done() {
    if (document.documentElement.classList.contains("is-ready")) return;
    document.documentElement.classList.add("is-ready");
    setTimeout(() => loader.remove(), 1200);
  }
  if (lite || reduced) {
    done();
    return;
  }
  const flight = new window.BMCFlight(flightRoot, C, M);
  window.BMC_FLIGHT = flight; // inspection / réglage du rythme depuis la console
  const t0 = performance.now();
  setTimeout(done, 3200); // sécurité si requestAnimationFrame est suspendu (onglet en arrière-plan)
  (function wait() {
    // L'intro attend quelques images (ou 2,6 s au maximum), jamais le chargement complet.
    const p = Math.min(1, flight.progressReady() / 0.08);
    bar.style.transform = "scaleX(" + Math.max(p, (performance.now() - t0) / 2600) + ")";
    if (p >= 1 || performance.now() - t0 > 2600) setTimeout(done, 350);
    else requestAnimationFrame(wait);
  })();
})();
