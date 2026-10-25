// Hulp bij een recensie: de app maakt een opdracht voor Claude, de tekst wordt teruggeplakt.
// Gratis via de Claude-app; de app zelf praat met geen enkele AI-dienst.

export const STEEKWOORDEN = [
  'Spannend',
  'Ontroerend',
  'Leerzaam',
  'Grappig',
  'Inspirerend',
  'Rauw en eerlijk',
  'Herkenbaar',
  'Goed geschreven',
  'Verrassend einde',
  'Traag begin',
  'Te lang',
  'Voorspelbaar',
];

export const LENGTES = { kort: 'twee of drie zinnen', lang: 'één alinea van vijf tot zeven zinnen' };

export function recensieOpdracht({ boek, woorden = [], eigen = '', lengte = 'kort' }) {
  const auteurs = (boek.auteurs ?? []).join(' & ');
  const regels = [
    `Schrijf een korte recensie in het Nederlands van het boek "${boek.titel}"${auteurs ? ` van ${auteurs}` : ''}.`,
    'Schrijf in de ik-vorm, persoonlijk, warm en eerlijk, zoals een lezer die het aan een vriend vertelt. Geen spoilers, geen clichés, geen samenvatting van het verhaal.',
    `Lengte: ${LENGTES[lengte] ?? LENGTES.kort}.`,
  ];
  if (boek.sterren) regels.push(`Mijn oordeel: ${boek.sterren} van de 5 sterren.`);
  if (woorden.length) regels.push(`Wat het boek voor mij was: ${woorden.join(', ').toLowerCase()}.`);
  if (eigen.trim()) regels.push(`Mijn eigen woorden: ${eigen.trim()}`);
  if (boek.recensie?.trim()) regels.push(`Wat ik zelf al schreef (gebruik dit als basis): ${boek.recensie.trim()}`);
  regels.push('Geef alleen de recensie, zonder titel, inleiding of uitleg.');
  return regels.join('\n');
}

// Opent de Claude-app (of claude.ai) met de opdracht al ingevuld.
export function claudeAdres(opdracht) {
  return `https://claude.ai/new?q=${encodeURIComponent(opdracht)}`;
}
