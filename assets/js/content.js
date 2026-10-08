/*
 * BMC Food: tout le contenu modifiable du site.
 * Modifiez les textes, prix et le rythme du vol ici, sans toucher au reste du code.
 *
 * Rythme du vol (beats) :
 *   vh       = distance de défilement de ce temps, en hauteurs d'écran
 *   from/to  = intervalle du clip maître, en secondes (from === to => image fixe / maintien)
 *   chapter  = id du chapitre de texte affiché pendant ce temps (null = pas de texte, le mouvement prime)
 */
window.BMC_CONTENT = {
  brand: {
    name: "BMC Food",
    tagline: "Tacos · Dakar",
    address: "Cité Mixta, IDA (Point E), Dakar",
    // Numéros repris du menu officiel. Supprimez la liste pour ne plus les afficher.
    phones: ["+221 77 856 13 13", "+221 76 859 75 75"],
    hours: "Horaires à confirmer",
  },

  // Scènes en relief (2,5D) : décor + personne détourée. focus = point de zoom, exit = point de fuite vers la scène suivante.
  // Images générées sur ChatGPT, détourage local. Ajoutez une scène ici pour l'intégrer au vol.
  // Secours 2,5D (désactivé) : renommer en « scenes » pour le réactiver.
  scenes2d: [
    { id: "facade",  bg: "assets/img/scenes/facade.webp",  fg: "assets/img/scenes/facade-fg.webp",  from: 0,  to: 12, focus: [0.47, 0.32],  exit: [0.66, 0.5], parallax: 1 },
    { id: "salle",   bg: "assets/img/scenes/salle.webp",   fg: "assets/img/scenes/salle-fg.webp",   from: 12, to: 24, focus: [0.5, 0.2] ,  exit: [0.5, 0.32], parallax: 1 },
    { id: "cuisine", bg: "assets/img/scenes/cuisine.webp", fg: "assets/img/scenes/cuisine-fg.webp", from: 24, to: 36, focus: [0.52, 0.4],  exit: [0.5, 0.5],  parallax: 0.3, drift: 1.4 },
    { id: "sortie",  bg: "assets/img/scenes/facade.webp",  fg: "assets/img/scenes/facade-fg.webp",  from: 36, to: 45, focus: [0.5, 0.42], reverse: true, last: true, parallax: 0.6 },
  ],

  // Rythme calé sur le vol vidéo (22,05 s) : from/to = secondes du master ; null = traversée sans texte.
  beats: [
    { vh: 0.8, from: 0,     to: 0,     chapter: "arrivee" },     // maintien : titre lisible, Abou devant BMC Food
    { vh: 1.4, from: 0,     to: 3.8,   chapter: "arrivee" },     // Abou salue et invite à entrer
    { vh: 1.2, from: 3.8,   to: 8.5,   chapter: null },          // la caméra le frôle et entre
    { vh: 2.0, from: 8.5,   to: 14.6,  chapter: "salle" },       // l'hôte en costume accueille, bras ouverts
    { vh: 0.8, from: 14.6,  to: 16.2,  chapter: null },          // traversée vers la cuisine
    { vh: 1.6, from: 16.2,  to: 19.6,  chapter: "cuisine" },     // le cuisinier au grill
    { vh: 0.8, from: 19.6,  to: 20.6,  chapter: null },          // sortie par la porte arrière
    { vh: 1.6, from: 20.6,  to: 22.05, chapter: "revelation" },  // montée : corniche et Monument de la Renaissance
    { vh: 1.0, from: 22.05, to: 22.05, chapter: "revelation" },  // maintien final aérien
  ],

  chapters: [
    {
      id: "arrivee",
      index: "01",
      label: "Arrivée",
      eyebrow: "BMC Food · Cité Mixta, Point E",
      title: "Le tacos,<br>version <em>Dakar</em>.",
      text: "Pressé à la plancha, gratiné à la minute, servi brûlant. Entrez, Abou vous attend.",
      cta: { label: "Voir la carte", href: "#carte" },
      align: "left",
      image: "frames/frame-0020.webp",
    },
    {
      id: "salle",
      index: "02",
      label: "La salle",
      eyebrow: "La salle",
      title: "On vous <em>installe</em>,<br>on s'occupe du reste.",
      text: "Un accueil attentif à chaque table : chez BMC, on passe voir si tout va bien. Mixte, viande, poulet… ou Giga, pour les grandes faims.",
      cta: { label: "Découvrir les Giga", href: "#carte", filter: "giga" },
      align: "left",
      image: "frames/frame-0180.webp",
    },
    {
      id: "cuisine",
      index: "03",
      label: "La cuisine",
      eyebrow: "La cuisine",
      title: "Grillé<br><em>à la minute.</em>",
      text: "Chaque tacos se prépare à la commande : la garniture saisie au grill, la galette pressée, le fromage qui file.",
      cta: { label: "Voir les gratinés", href: "#carte", filter: "gratine" },
      align: "right",
      image: "frames/frame-0262.webp",
    },
    {
      id: "revelation",
      index: "04",
      label: "L'adresse",
      eyebrow: "Point E · Dakar",
      title: "De Point E à la Corniche,<br>votre <em>faim</em> a une adresse.",
      text: "BMC Food, Cité Mixta, IDA (Point E), Dakar.",
      cta: { label: "Voir la carte complète", href: "#carte" },
      align: "center",
      image: "frames/frame-0327.webp",
    },
  ],

  // Carte officielle (prix en FCFA), reprise du menu BMC Food.
  menu: [
    {
      id: "mixte",
      name: "Tacos mixte",
      note: "Viande et poulet dans la même galette.",
      items: [
        { name: "Tacos mixte", price: 3000 },
        { name: "Tacos royal", price: 3500, tags: ["royal"] },
        { name: "Tacos jambon", price: 2000 },
        { name: "Tacos mixte jambon", price: 4000 },
        { name: "Tacos mixte gratiné", price: 4000, tags: ["gratine"] },
        { name: "Tacos mixte jambon royal", price: 4500, tags: ["royal"] },
        { name: "Tacos mixte jambon royal gratiné", price: 5500, tags: ["royal", "gratine"] },
      ],
    },
    {
      id: "viande",
      name: "Tacos viande",
      note: "La viande saisie, simple et généreuse.",
      items: [
        { name: "Tacos viande", price: 2000 },
        { name: "Tacos viande royal", price: 2500, tags: ["royal"] },
        { name: "Tacos viande jambon", price: 3000 },
        { name: "Tacos viande jambon royal", price: 3500, tags: ["royal"] },
        { name: "Tacos viande jambon royal gratiné", price: 4500, tags: ["royal", "gratine"] },
        { name: "Tacos viande gratiné", price: 3000, tags: ["gratine"] },
      ],
    },
    {
      id: "poulet",
      name: "Tacos poulet",
      note: "Le poulet doré, en version simple ou gratinée.",
      items: [
        { name: "Tacos poulet", price: 2500 },
        { name: "Tacos poulet gratiné", price: 3500, tags: ["gratine"] },
        { name: "Tacos poulet royal", price: 3000, tags: ["royal"] },
        { name: "Tacos poulet jambon", price: 3500 },
        { name: "Tacos poulet jambon royal", price: 4000, tags: ["royal"] },
        { name: "Tacos poulet jambon royal gratiné", price: 5000, tags: ["royal", "gratine"] },
      ],
    },
    {
      id: "giga",
      name: "Giga tacos",
      note: "Format XL et Giga, pour les grandes faims ou à partager.",
      items: [
        { name: "Tacos viande XL", price: 4000, tags: ["xl"] },
        { name: "Tacos poulet XL", price: 5000, tags: ["xl"] },
        { name: "Tacos mixte XL", price: 6000, tags: ["xl"] },
        { name: "Tacos giga viande", price: 10000, tags: ["giga"] },
        { name: "Tacos giga poulet", price: 12500, tags: ["giga"] },
        { name: "Tacos giga mixte", price: 15000, tags: ["giga"] },
        { name: "Tacos giga au jambon", price: 15000, tags: ["giga"] },
      ],
    },
  ],

  savoirFaire: [
    { n: "01", title: "Pressé", text: "La galette se referme et passe sous la presse : c'est elle qui donne les marques dorées en losange." },
    { n: "02", title: "Grillé", text: "Viande, poulet ou les deux : la garniture est saisie sur la plancha, au moment de la commande." },
    { n: "03", title: "Gratiné", text: "En option sur la carte : une couche de fromage fondu qui file à la première bouchée." },
  ],

  footerNote: "Les images de la visite sont des créations générées par IA, à titre d'illustration : elles ne représentent pas le local réel.",
};
