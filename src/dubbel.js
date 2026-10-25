// Herkennen of een boek al in de lijst staat.

export function kaal(tekst) {
  return (tekst || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// De eerste schrijver, ook als er twee in één veld staan ("Lars Kepler & X" -> "Lars Kepler").
export function eersteAuteur(boek) {
  return (boek.auteurs?.[0] || '').split('&')[0].trim();
}

// Achternaam = laatste woord van de eerste auteur ("Michel van Egmond" -> "egmond").
export function achternaam(boek) {
  return kaal(eersteAuteur(boek).split(/\s+/).pop());
}

// Alleen letters en cijfers, zodat leestekens en hoofdletters niet uitmaken.
function kern(tekst) {
  return kaal(tekst).replace(/[^a-z0-9]/g, '');
}

// Lidwoorden vooraan tellen niet mee: "The Da Vinci Code" = "De Da Vinci Code".
const LIDWOORDEN = /^(de|het|een|the|a|an|der|die|das|ein|eine|le|la|les|l'|el|il)\s+/;

function zonderLidwoord(titel) {
  return kaal(titel).trim().replace(LIDWOORDEN, '');
}

// Titel zonder ondertitel: "Derksen: het verhaal" -> "derksen".
function hoofdtitel(titel) {
  return kern(zonderLidwoord((titel || '').split(/[:(]/)[0]));
}

function isbnKern(isbn) {
  return (isbn || '').replace(/[^0-9x]/gi, '');
}

function zelfdeBoek(a, b) {
  if (isbnKern(a.isbn) && isbnKern(a.isbn) === isbnKern(b.isbn)) return true;
  // Zelfde werk bij Open Library = zelfde boek, ook in een andere taal.
  if (a.werk && a.werk === b.werk) return true;
  const titelGelijk =
    kern(zonderLidwoord(a.titel)) === kern(zonderLidwoord(b.titel)) || hoofdtitel(a.titel) === hoofdtitel(b.titel);
  if (!titelGelijk || !hoofdtitel(a.titel)) return false;
  // Zonder auteur bij een van beide is een gelijke titel genoeg om te waarschuwen.
  const naamA = achternaam(a);
  const naamB = achternaam(b);
  return !naamA || !naamB || naamA === naamB;
}

export function vindDubbel(boek, boeken) {
  return boeken.find((b) => zelfdeBoek(boek, b));
}
