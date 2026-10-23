// Herkennen of een boek al in de lijst staat.

export function kaal(tekst) {
  return (tekst || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Achternaam = laatste woord van de eerste auteur ("Michel van Egmond" -> "egmond").
export function achternaam(boek) {
  const naam = (boek.auteurs?.[0] || '').split('&')[0].trim();
  return kaal(naam.split(/\s+/).pop());
}

// Alleen letters en cijfers, zodat leestekens en hoofdletters niet uitmaken.
function kern(tekst) {
  return kaal(tekst).replace(/[^a-z0-9]/g, '');
}

// Titel zonder ondertitel: "Derksen: het verhaal" -> "derksen".
function hoofdtitel(titel) {
  return kern((titel || '').split(/[:(]/)[0]);
}

function isbnKern(isbn) {
  return (isbn || '').replace(/[^0-9x]/gi, '');
}

function zelfdeBoek(a, b) {
  if (isbnKern(a.isbn) && isbnKern(a.isbn) === isbnKern(b.isbn)) return true;
  const titelGelijk = kern(a.titel) === kern(b.titel) || hoofdtitel(a.titel) === hoofdtitel(b.titel);
  if (!titelGelijk || !hoofdtitel(a.titel)) return false;
  // Zonder auteur bij een van beide is een gelijke titel genoeg om te waarschuwen.
  const naamA = achternaam(a);
  const naamB = achternaam(b);
  return !naamA || !naamB || naamA === naamB;
}

export function vindDubbel(boek, boeken) {
  return boeken.find((b) => zelfdeBoek(boek, b));
}
