// Een boek delen via het deelmenu (WhatsApp, Berichten, LinkedIn, mail).

function eersteZin(tekst, max = 200) {
  const schoon = (tekst || '').replace(/\s+/g, ' ').trim();
  if (!schoon) return '';
  const zin = schoon.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? schoon;
  return zin.length > max ? `${zin.slice(0, max - 1).trimEnd()}…` : zin;
}

// De tekst hangt af van de status: een gelezen boek krijgt sterren en een zin uit de recensie.
export function deelTekst(boek, recensie = boek.recensie) {
  const auteurs = (boek.auteurs ?? []).join(' & ');
  const wat = auteurs ? `${boek.titel} van ${auteurs}` : boek.titel;
  const regels = [];
  if (boek.status === 'Gelezen') regels.push(`Gelezen: ${wat}`);
  else if (boek.status === 'Bezig') regels.push(`Ik lees nu: ${wat}`);
  else if (boek.status === 'Wil ik lezen') regels.push(`Op mijn leeslijst: ${wat}`);
  else regels.push(wat);
  if (boek.status === 'Gelezen' && boek.sterren) regels.push('★'.repeat(boek.sterren) + '☆'.repeat(5 - boek.sterren));
  const zin = boek.status === 'Gelezen' ? eersteZin(recensie) : '';
  if (zin) regels.push(`"${zin}"`);
  return regels.join('\n');
}

// Geeft 'gedeeld', 'gekopieerd' of 'geannuleerd'.
export async function deelBoek(tekst) {
  if (navigator.share) {
    try {
      await navigator.share({ text: tekst });
      return 'gedeeld';
    } catch (e) {
      if (e.name === 'AbortError') return 'geannuleerd';
    }
  }
  await navigator.clipboard.writeText(tekst);
  return 'gekopieerd';
}

