import './style.css';
import {
  alleBoeken,
  boekToevoegen,
  haalBoek,
  boekBijwerken,
  boekVerwijderen,
  boekTerugzetten,
  boekenImporteren,
  boekenAanvullen,
  CATEGORIEEN,
  vraagBlijvendeOpslag,
  vulWerkenAan,
  zetKoboOm,
  STATUSSEN,
  statusNaam,
  haalProfiel,
  bewaarProfiel,
  haalProfielFoto,
  bewaarProfielFoto,
} from './db.js';
import {
  zoekBoeken,
  verkleinFoto,
  zoekWerk,
  zoekOpIsbn,
  testBronnen,
  GoogleWeigert,
  zoekCover,
  zoekCoverKeuzes,
  bewaarbareCover,
  googleStand,
  googleWeerOm,
  vierkanteFoto,
  googleAfbeeldingenUrl,
  coverUitKlembord,
} from './zoeken.js';
import { startScanner, geldigIsbn13 } from './scanner.js';
import { kaal, achternaam, vindDubbel } from './dubbel.js';
import { koboZoekUrl } from './kobo.js';
import { raadCategorie } from './categorie.js';
import { deelTekst, deelBoek } from './delen.js';
import { haalNieuws, ordenNieuws, overMijnSchrijver } from './nieuws.js';
import { STEEKWOORDEN, recensieOpdracht, claudeAdres } from './recensie.js';
import { berekenStatistieken, huidigeMaand, geldigeStartmaand } from './statistieken.js';
import { veilig, veiligeUrl } from './veilig.js';
import { tipsUitArchief, verversTips, zetTipReactie } from './tips.js';
import {
  maakBackupBestand,
  bewaarBackup,
  laatsteBackup,
  dagenSindsBackup,
  moetHerinneren,
  herinnerLater,
  leesBackup,
  zetBackupTerug,
} from './backup.js';
import { leesExcel, planImport } from './importeren.js';
import { maakExcel, deelBestand } from './exporteren.js';
import {
  verrijkAlles,
  opVoortgang,
  aantalTeVerrijken,
  zonderCoverOpnieuw,
  coverTelling,
  coverStand,
  legCoversVast,
  synopsisTelling,
} from './verrijken.js';

const app = document.getElementById('app');

// Service worker: zorgt dat de app ook zonder internet opent.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}

vraagBlijvendeOpslag();
zetKoboOm()
  .then(() => vulWerkenAan(zoekWerk))
  .then(verrijkAlles);

// Voortgang van het ophalen van covers tonen waar dat kan.
opVoortgang(({ soort = 'covers', klaar, totaal, gestopt, wacht, laatsteFout, googleOp }) => {
  const naam = soort === 'synopsis' ? 'Synopsis' : 'Covers en gegevens';
  const code = laatsteFout ? ` (Google: fout ${laatsteFout})` : '';
  const el = document.getElementById('verrijk-status');
  if (el) {
    el.textContent =
      klaar < totaal
        ? googleOp
          ? `${naam} ophalen gaat morgen verder (${klaar} van ${totaal}): Google beantwoordt maar een beperkt aantal vragen per dag, en zoeken naar nieuwe boeken gaat voor.`
          : gestopt
          ? `${naam} ophalen gepauzeerd (${klaar} van ${totaal})${code}: een bron weigert even. Het gaat later vanzelf verder.`
          : wacht
            ? `${naam} ophalen: ${klaar} van ${totaal}. Google vraagt om even te wachten${code}; over ${wacht} seconden verder…`
            : `${naam} ophalen: ${klaar} van ${totaal}…${soort === 'covers' ? ' Daarna volgt de synopsis.' : ''}`
        : '';
    el.hidden = !el.textContent;
  }
  if (klaar === totaal && totaal > 0) {
    melding(soort === 'synopsis' ? 'Synopsis ophalen is klaar' : 'Covers zoeken is klaar');
    // Lijst bijwerken als die open staat en er niet getypt wordt.
    if (soort === 'covers' && (location.hash === '' || location.hash === '#/')) {
      if (document.activeElement?.id !== 'lijst-zoek') {
        const y = window.scrollY;
        toonLijst().then(() => window.scrollTo(0, y));
      }
    }
  }
});
window.addEventListener('online', verrijkAlles);

// --- Hulpjes ---

function auteurTekst(boek) {
  return boek.auteurs?.length ? boek.auteurs.join(', ') : 'Onbekende auteur';
}

// Cover als <img>, of een rustig vlak met de beginletter als er geen cover is.
// Tijdelijke adressen van covers op het toestel; de lijst ververst die van zichzelf
// vaak (bij typen), dus die houden we apart van de rest van het scherm.
const coverLinks = new Set();
const lijstLinks = new Set();

function coverSrc(boek, links = coverLinks) {
  if (boek.cover instanceof Blob) {
    const src = URL.createObjectURL(boek.cover);
    links.add(src);
    return src;
  }
  return veiligeUrl(boek.coverUrl);
}

function coverHtml(boek, klasse, links = coverLinks) {
  const src = coverSrc(boek, links);
  const letter = veilig((boek.titel || '?').charAt(0));
  // Laadt een cover niet (bijvoorbeeld offline bij een Google-cover), dan het vlak met de beginletter.
  if (src) {
    return `<img class="${klasse}" src="${veilig(src)}" alt="" loading="lazy" data-letter="${letter}" data-bij-fout="letter" />`;
  }
  return `<div class="${klasse} geen-cover">${letter}</div>`;
}

function sterrenTekst(aantal) {
  return aantal ? '★'.repeat(aantal) + '☆'.repeat(5 - aantal) : '';
}

// Leesdata zijn 'jjjj-mm-dd', of 'jjjj-mm' als alleen de maand bekend is.
function datumTekst(iso) {
  const alleenMaand = iso.length === 7;
  return new Date(`${alleenMaand ? `${iso}-15` : iso}T12:00:00`).toLocaleDateString('nl-NL', {
    ...(alleenMaand ? {} : { day: 'numeric' }),
    month: 'long',
    year: 'numeric',
  });
}

function vandaag() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Laadt een plaatje niet: een cover wordt het vlak met de beginletter, een keuze verdwijnt.
// (Eén luisteraar voor de hele pagina in plaats van onerror in de HTML; dat is veiliger.)
document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    // Een kapotte cover niet bewaard houden, zodat hij de volgende keer opnieuw wordt gehaald.
    if (img.src.startsWith('https://')) navigator.serviceWorker?.controller?.postMessage({ coverWeg: img.src });
    if (img.dataset.bijFout === 'letter') {
      const vlak = document.createElement('div');
      vlak.className = `${img.className} geen-cover`;
      vlak.textContent = img.dataset.letter;
      img.replaceWith(vlak);
    } else if (img.dataset.bijFout === 'weg') {
      img.closest('.keuze-cover')?.remove();
    }
  },
  true
);

function ruimOp(links) {
  links.forEach((url) => URL.revokeObjectURL(url));
  links.clear();
}

function ruimCoversOp() {
  ruimOp(coverLinks);
  ruimOp(lijstLinks);
}

// Korte melding onderin, eventueel met een knop (zoals 'Ongedaan maken').
function melding(tekst, knop) {
  const el = document.getElementById('melding');
  el.textContent = tekst;
  if (knop) {
    const b = Object.assign(document.createElement('button'), { textContent: knop.tekst });
    b.addEventListener('click', () => {
      el.classList.remove('zichtbaar');
      knop.actie();
    });
    el.append(b);
  }
  el.classList.toggle('met-knop', Boolean(knop));
  el.classList.add('zichtbaar');
  clearTimeout(melding.timer);
  melding.timer = setTimeout(() => el.classList.remove('zichtbaar'), knop ? 5000 : 2500);
}

// --- Lijst ---

const SORTERINGEN = {
  toegevoegd: 'Laatst toegevoegd',
  titel: 'Titel',
  auteur: 'Auteur',
  gelezen: 'Laatst gelezen',
  sterren: 'Sterren',
};

// Tabjes bovenaan de lijst, zoals in een nieuwsapp.
const TABS = ['Alles', 'Bezig', 'Gelezen', 'Wil ik lezen'];

// Waar het boek is: voor de labels in de lijst, de knoppen bij een boek en de Toon-keuze.
// De sleutel 'kobo' blijft voor Wacht op Kobo Plus, zodat een bewaarde keuze blijft werken.
const BEZIT = {
  kobo: { veld: 'koboWacht', naam: 'Wacht op Kobo Plus' },
  gedownload: { veld: 'koboGedownload', naam: 'Gedownload in Kobo' },
  papier: { veld: 'papierGekocht', naam: 'Papieren boek gekocht' },
};

// Zoekterm, tab en sortering blijven bewaard als je een boek opent en terugkomt.
let zoekterm = '';
let sortering = 'toegevoegd';
let tab = 'Alles';
// '' = alles, anders een categorie of 'kobo' (Wacht op Kobo Plus).
let toon = '';
try {
  sortering = localStorage.getItem('sortering') || sortering;
  tab = localStorage.getItem('tab') || tab;
  if (!TABS.includes(tab)) tab = 'Alles';
  toon = localStorage.getItem('toon') || toon;
} catch {
  // Zonder opslag gewoon de standaard.
}
// Een bewaarde keuze die niet meer bestaat, valt terug op alles.
if (toon && !['geen', ...Object.keys(BEZIT), ...CATEGORIEEN].includes(toon)) toon = '';

function laatsteLeesdatum(boek) {
  return boek.leesdata?.length ? boek.leesdata[boek.leesdata.length - 1] : '';
}

function sorteer(boeken) {
  const opTitel = (a, b) => kaal(a.titel).localeCompare(kaal(b.titel), 'nl');
  const regels = {
    toegevoegd: (a, b) => b.toegevoegdOp.localeCompare(a.toegevoegdOp),
    titel: opTitel,
    auteur: (a, b) => achternaam(a).localeCompare(achternaam(b), 'nl') || opTitel(a, b),
    // Boeken zonder datum of sterren achteraan.
    gelezen: (a, b) => laatsteLeesdatum(b).localeCompare(laatsteLeesdatum(a)) || opTitel(a, b),
    sterren: (a, b) => (b.sterren || 0) - (a.sterren || 0) || opTitel(a, b),
  };
  return [...boeken].sort(regels[sortering] || regels.toegevoegd);
}

function filter(boeken) {
  const woorden = kaal(zoekterm).split(/\s+/).filter(Boolean);
  const inTab = boeken.filter(
    (b) =>
      (tab === 'Alles' || b.status === tab) &&
      (!toon || (BEZIT[toon] ? b[BEZIT[toon].veld] : toon === 'geen' ? !b.categorie : b.categorie === toon))
  );
  if (!woorden.length) return inTab;
  return inTab.filter((b) => {
    const tekst = kaal(`${b.titel} ${(b.auteurs || []).join(' ')} ${b.isbn}`);
    return woorden.every((w) => tekst.includes(w));
  });
}

function boekRegel(b) {
  return `
    <li class="veeg" data-id="${b.id}">
      <button class="veeg-actie" tabindex="-1">Verwijder</button>
      <a class="boek" href="#/boek/${b.id}">
      ${coverHtml(b, 'cover-klein', lijstLinks)}
      <div class="boek-tekst">
        <span class="regel">
          <span class="status status-${STATUSSEN.indexOf(b.status)}">${veilig(statusNaam(b.status))}</span>
          ${Object.values(BEZIT).filter((x) => b[x.veld]).map((x) => `<span class="status kobo">· ${x.naam}</span>`).join('')}
          ${categorieStip(b.categorie)}
          ${b.sterren ? `<span class="sterren-klein" aria-label="${b.sterren} sterren">${sterrenTekst(b.sterren)}</span>` : ''}
        </span>
        <strong>${veilig(b.titel)}</strong>
        <span>${veilig(auteurTekst(b))}</span>
      </div>
    </a></li>`;
}

// Naar links vegen toont een rode knop, zoals in Apple Mail.
const VEEG_BREEDTE = 96;

function maakVeegbaar(lijst, onVerwijder) {
  let open = null;
  let start = null;
  let frame = 0;

  const zet = (li, x, animeer) => {
    const a = li.querySelector('.boek');
    li.classList.add('veegt');
    a.style.transition = animeer ? 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    a.style.transform = x ? `translate3d(${x}px, 0, 0)` : '';
    // Dicht geschoven: knop en extra laag weer weg zodra de beweging klaar is.
    if (!x) {
      clearTimeout(li.veegTimer);
      li.veegTimer = setTimeout(() => {
        if (!a.style.transform) li.classList.remove('veegt');
      }, animeer ? 350 : 0);
    }
  };
  const sluit = () => {
    if (open) zet(open, 0, true);
    open = null;
  };
  // Voorbij de knop gaat het zwaarder, zoals een elastiek.
  const elastiek = (x) => (x >= -VEEG_BREEDTE ? x : -VEEG_BREEDTE + (x + VEEG_BREEDTE) * 0.3);

  lijst.addEventListener('touchstart', (e) => {
    const li = e.target.closest('.veeg');
    if (!li || e.target.closest('.veeg-actie')) return;
    if (open && open !== li) sluit();
    const t = e.touches[0];
    start = { li, x: t.clientX, y: t.clientY, basis: open === li ? -VEEG_BREEDTE : 0, richting: null, laatste: [] };
  }, { passive: true });

  lijst.addEventListener('touchmove', (e) => {
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Pas beslissen na een paar pixels: vegen opzij of gewoon scrollen.
    if (!start.richting) {
      if (Math.abs(dx) + Math.abs(dy) < 10) return;
      start.richting = Math.abs(dx) > Math.abs(dy) ? 'opzij' : 'scroll';
      // Vanaf hier meten, zodat de regel niet verspringt.
      start.x = t.clientX;
    }
    if (start.richting !== 'opzij') return;
    e.preventDefault();
    start.laatste.push({ x: t.clientX, t: e.timeStamp });
    if (start.laatste.length > 5) start.laatste.shift();
    const x = elastiek(Math.min(0, start.basis + t.clientX - start.x));
    const li = start.li;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => zet(li, x, false));
  }, { passive: false });

  // Onderbroken (bijvoorbeeld door een melding): regel netjes dichtschuiven.
  lijst.addEventListener('touchcancel', () => {
    if (start?.li) zet(start.li, start.basis, true);
    start = null;
  });

  lijst.addEventListener('touchend', (e) => {
    if (!start) return;
    if (start.richting === 'opzij') {
      cancelAnimationFrame(frame);
      const x = start.basis + (e.changedTouches[0].clientX - start.x);
      // Snelheid van de laatste beweging: een snelle veeg telt ook als hij kort is.
      const p = start.laatste;
      const snelheid = p.length > 1 ? (p[p.length - 1].x - p[0].x) / Math.max(1, p[p.length - 1].t - p[0].t) : 0;
      const openen = snelheid < -0.4 || (snelheid <= 0.4 && x < -VEEG_BREEDTE / 2);
      zet(start.li, openen ? -VEEG_BREEDTE : 0, true);
      open = openen ? start.li : open === start.li ? null : open;
      // Na vegen geen boek openen.
      const li = start.li;
      li.dataset.geveegd = 'ja';
      setTimeout(() => delete li.dataset.geveegd, 400);
    }
    start = null;
  });

  lijst.addEventListener('click', (e) => {
    const li = e.target.closest('.veeg');
    if (!li) return;
    if (e.target.closest('.veeg-actie')) {
      open = null;
      onVerwijder(li);
      return;
    }
    // Tik op een open regel (of net geveegd): dichtschuiven in plaats van openen.
    if (li.dataset.geveegd || open === li) {
      e.preventDefault();
      sluit();
    }
  });
}

// --- Startscherm: zoals de voorpagina van een nieuwsapp ---

function groet(naam) {
  const uur = new Date().getHours();
  const tijd = uur < 6 ? 'Goedenacht' : uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';
  const deel = naam ? `${tijd}, ${naam}` : tijd;
  const datum = new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  return { deel, datum };
}

function heldHtml(b) {
  const src = coverSrc(b);
  return `
    <a class="held" href="#/boek/${b.id}">
      ${src ? `<div class="held-achtergrond" data-achtergrond="${veilig(src)}"></div>` : ''}
      ${coverHtml(b, 'held-cover')}
      <div class="held-tekst">
        <span class="status status-1">${veilig(statusNaam(b.status))}</span>
        <strong>${veilig(b.titel)}</strong>
        <span>${veilig(auteurTekst(b))}</span>
        ${b.opmerking ? `<span class="zacht">${veilig(b.opmerking)}</span>` : ''}
      </div>
    </a>`;
}

function rijHtml(titel, boeken, naarTab) {
  if (!boeken.length) return '';
  return `
    <section class="rij">
      <div class="rij-kop">
        <h2>${titel}</h2>
        <button class="link-knop" data-naar-tab="${naarTab}">Alles ›</button>
      </div>
      <div class="rij-covers">
        ${boeken
          .map(
            (b) => `
          <a class="rij-boek" href="#/boek/${b.id}">
            ${coverHtml(b, 'rij-cover')}
            <span class="rij-titel">${veilig(b.titel)}</span>
            ${b.sterren ? `<span class="sterren-klein">${'★'.repeat(b.sterren)}</span>` : ''}
          </a>`
          )
          .join('')}
      </div>
    </section>`;
}

function startHtml(boeken, naam) {
  const { deel, datum } = groet(naam);
  const nu = boeken.filter((b) => b.status === 'Bezig');
  const gelezen = boeken
    .filter((b) => b.status === 'Gelezen')
    .sort((a, b) => laatsteLeesdatum(b).localeCompare(laatsteLeesdatum(a)) || b.toegevoegdOp.localeCompare(a.toegevoegdOp))
    .slice(0, 12);
  const wil = boeken
    .filter((b) => b.status === 'Wil ik lezen')
    .sort((a, b) => b.toegevoegdOp.localeCompare(a.toegevoegdOp))
    .slice(0, 12);
  return `
    <section class="start">
      <p class="groet">${veilig(deel)}<span>${datum}</span></p>
      ${
        nu.length
          ? `<div class="helden${nu.length > 1 ? ' meer' : ''}">${nu.map(heldHtml).join('')}</div>`
          : `<div class="held leeg-held">
               <div class="held-tekst">
                 <span class="status">Aan het lezen</span>
                 <strong>Wat ga je hierna lezen?</strong>
                 <span>Open een boek en kies <b>Aan het lezen</b>, dan staat het hier.</span>
               </div>
             </div>`
      }
      ${rijHtml('Onlangs gelezen', gelezen, 'Gelezen')}
      <section class="nieuws" id="nieuws-rij" hidden></section>
      ${rijHtml('Wil ik lezen', wil, 'Wil ik lezen')}
      <section class="rij" id="tips-rij" hidden></section>
    </section>`;
}

async function toonLijst() {
  const nr = schermNr;
  ruimCoversOp();
  const [boeken, profiel, foto] = await Promise.all([alleBoeken(), haalProfiel(), profielFotoAdres()]);
  // Intussen naar een ander scherm gegaan? Dan dit scherm niet meer tekenen.
  if (nr !== schermNr) return;
  app.innerHTML = `
    <header class="woordmerk">
      <h1>Boeken</h1>
      <a class="profiel-icoon${foto ? ' met-foto' : ''}" href="#/profiel" aria-label="Mijn profiel">${
        foto
          ? `<img src="${veilig(foto)}" alt="" />`
          : profiel.naam
            ? veilig(profiel.naam.charAt(0).toUpperCase())
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z" /></svg>'
      }</a>
    </header>
    ${boeken.length ? startHtml(boeken, profiel.naam) : ''}
    ${
      boeken.length
        ? `<h2 class="lijst-kop" id="lijst-kop">Al je boeken</h2>
           <nav class="tabs" id="tabs">${TABS.map(
            (t) => `<button class="tab${t === tab ? ' actief' : ''}" data-tab="${t}">${statusNaam(t)}</button>`
          ).join('')}</nav>`
        : ''
    }
    ${inSafari() ? safariHtml() : ''}
    ${boeken.length && moetHerinneren() ? herinneringHtml() : ''}
    <p class="verrijk-status" id="verrijk-status" hidden></p>
    ${
      boeken.length
        ? `<div class="lijst-bediening">
             <input id="lijst-zoek" type="search" placeholder="Zoek op titel, auteur of ISBN" value="${veilig(zoekterm)}" autocomplete="off" enterkeyhint="search" />
             <div class="lijst-regel">
               <label class="sorteer">Sorteer
                 <select id="sorteer">
                   ${Object.entries(SORTERINGEN)
                     .map(([k, v]) => `<option value="${k}"${k === sortering ? ' selected' : ''}>${v}</option>`)
                     .join('')}
                 </select>
               </label>
               <label class="sorteer">Toon
                 <select id="toon">
                   <option value="">Alles</option>
                   ${CATEGORIEEN.map((c) => `<option value="${veilig(c)}"${c === toon ? ' selected' : ''}>${veilig(c)}</option>`).join('')}
                   <option value="geen"${toon === 'geen' ? ' selected' : ''}>Nog geen categorie</option>
                   ${Object.entries(BEZIT).map(([k, x]) => `<option value="${k}"${toon === k ? ' selected' : ''}>${x.naam}</option>`).join('')}
                 </select>
               </label>
               <span class="aantal" id="aantal"></span>
             </div>
           </div>
           <ul class="lijst" id="lijst"></ul>`
        : `<p class="leeg">Nog geen boeken.<br />Tik onderin op <b>Toevoegen</b> om je eerste boek toe te voegen.</p>`
    }
  `;
  if (!boeken.length) return;

  document.getElementById('later')?.addEventListener('click', () => {
    herinnerLater();
    document.querySelector('.herinnering').remove();
  });

  const teken = () => {
    ruimOp(lijstLinks);
    const zichtbaar = sorteer(filter(boeken));
    document.getElementById('lijst').innerHTML = zichtbaar.length
      ? zichtbaar.map(boekRegel).join('')
      : `<li class="leeg">${zoekterm ? `Geen boek gevonden voor "${veilig(zoekterm)}".` : toon ? 'Geen boeken met deze keuze.' : `Nog geen boeken bij ${veilig(statusNaam(tab))}.`}</li>`;
    document.getElementById('aantal').textContent = zichtbaar.length === 1 ? '1 boek' : `${zichtbaar.length} boeken`;
  };

  const kiesTab = (nieuw) => {
    tab = nieuw;
    try {
      localStorage.setItem('tab', tab);
    } catch {
      // Niet erg.
    }
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('actief', t.dataset.tab === tab));
    teken();
  };
  document.getElementById('tabs').addEventListener('click', (e) => {
    const knop = e.target.closest('.tab');
    if (knop) kiesTab(knop.dataset.tab);
  });
  // 'Alles ›' bij een rij op het startscherm: naar die tab in de lijst eronder.
  document.querySelectorAll('[data-achtergrond]').forEach((el) => {
    el.style.backgroundImage = `url(${JSON.stringify(el.dataset.achtergrond)})`;
  });
  // Tips en nieuws komen van buiten; gaat daar iets mis, dan blijft de lijst gewoon werken.
  await toonTipsRij(boeken).catch(() => {});
  toonNieuws(boeken).catch(() => {});
  if (nr !== schermNr) return;
  document.querySelector('.start')?.addEventListener('click', (e) => {
    const knop = e.target.closest('[data-naar-tab]');
    if (!knop) return;
    kiesTab(knop.dataset.naarTab);
    document.getElementById('lijst-kop').scrollIntoView({ behavior: 'smooth' });
  });
  teken();

  const zetAantal = () => {
    const zichtbaar = filter(boeken).length;
    document.getElementById('aantal').textContent = zichtbaar === 1 ? '1 boek' : `${zichtbaar} boeken`;
  };
  maakVeegbaar(document.getElementById('lijst'), async (li) => {
    const id = Number(li.dataset.id);
    // De nieuwste versie bewaren voor 'Ongedaan maken' (met covers en synopsis van daarnet).
    const boek = (await haalBoek(id)) ?? boeken.find((b) => b.id === id);
    if (!boek) return;
    await boekVerwijderen(id);
    const plek = boeken.findIndex((b) => b.id === id);
    if (plek !== -1) boeken.splice(plek, 1);
    li.classList.add('weg');
    setTimeout(() => li.remove(), 250);
    zetAantal();
    melding(`"${boek.titel}" verwijderd`, {
      tekst: 'Ongedaan maken',
      actie: async () => {
        await boekTerugzetten(boek);
        // Staat de lijst nog open, dan bijwerken; anders ziet de gebruiker hem straks vanzelf.
        if (!document.getElementById('lijst')) return;
        boeken.push(boek);
        zetAantal();
        teken();
      },
    });
  });

  document.getElementById('lijst-zoek').addEventListener('input', (e) => {
    zoekterm = e.target.value;
    teken();
  });
  document.getElementById('lijst-zoek').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });
  document.getElementById('toon').addEventListener('change', (e) => {
    toon = e.target.value;
    try {
      localStorage.setItem('toon', toon);
    } catch {
      // Niet erg; dan geldt de keuze alleen nu.
    }
    teken();
  });
  document.getElementById('sorteer').addEventListener('change', (e) => {
    sortering = e.target.value;
    try {
      localStorage.setItem('sortering', sortering);
    } catch {
      // Niet erg; dan geldt de keuze alleen nu.
    }
    teken();
  });
}

// Op de iPhone hebben Safari en de app op het beginscherm elk hun eigen opslag.
function inSafari() {
  const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const losseApp = navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  return iPhone && !losseApp;
}

function safariHtml() {
  return `
    <div class="herinnering safari">
      <p><strong>Je gebruikt de app nu in Safari.</strong> Safari en de app op je beginscherm bewaren elk hun eigen boeken. Open de app vanaf je beginscherm.</p>
    </div>`;
}

function herinneringHtml() {
  const dagen = dagenSindsBackup();
  const tekst =
    dagen === null
      ? 'Je hebt nog geen backup van je boeken.'
      : `Je laatste backup is ${dagen} dagen oud.`;
  return `
    <div class="herinnering">
      <p>${tekst}</p>
      <div class="herinnering-knoppen">
        <a href="#/instellingen">Backup maken</a>
        <button class="link-knop" id="later">Later</button>
      </div>
    </div>`;
}

// --- Instellingen ---

function backupTekst() {
  const laatste = laatsteBackup();
  if (!laatste) return 'Nog geen backup gemaakt.';
  const dagen = dagenSindsBackup();
  const wanneer = dagen === 0 ? 'vandaag' : dagen === 1 ? 'gisteren' : `${dagen} dagen geleden`;
  return `Laatste backup: ${laatste.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })} (${wanneer}).`;
}

// Licht of donker. Het wisselen zelf gebeurt in thema.js, dat al laadt vóór de app.
const WEERGAVEN = { avond: "Donker 's avonds", iphone: 'Zoals mijn iPhone', licht: 'Altijd licht', donker: 'Altijd donker' };

function weergave() {
  try {
    return localStorage.getItem('weergave') || 'avond';
  } catch {
    return 'avond';
  }
}

// Uitleg in gewone taal: hoe de app werkt, waar je gegevens staan, wat wel en niet kan.
function overDezeAppHtml() {
  return `
    <section class="blok over-app">
      <h2>Over deze app</h2>
      <details>
        <summary>Waar staan mijn gegevens?</summary>
        <p>Alles wat je invult staat alleen op deze telefoon, in de app op je beginscherm: je boeken, covers, sterren, recensies, je profiel en je foto. Er is geen account en geen server. Niemand anders kan erbij, ook Claude niet.</p>
        <p>Safari en de app op je beginscherm bewaren elk hun eigen gegevens. Gebruik daarom altijd de app op je beginscherm.</p>
        <p>Een backup is één bestand met alles erin. Jij bepaalt waar het staat, bijvoorbeeld in iCloud Drive. Verlies je je telefoon, dan zet je met dat bestand alles terug.</p>
        <p>Naar een andere telefoon: maak een backup, zet de app op het beginscherm van de nieuwe telefoon, open hem vanaf het beginscherm en kies Backup terugzetten. Bij Backup zie je wat er meegaat. Covers die alleen als internetadres bestaan, kun je daar eerst als plaatje vastleggen.</p>
      </details>
      <details>
        <summary>Wat gaat er over internet?</summary>
        <p>Bij zoeken en toevoegen vraagt de app gegevens op bij Open Library, Google Books en de Koninklijke Bibliotheek: alleen de titel, auteur of ISBN waarnaar je zoekt. Je lijst, sterren en recensies gaan nooit mee.</p>
        <p>De boekentips komen uit een openbare lijst op de site van de app. Die wordt elke zaterdagochtend vernieuwd door een geplande taak van Claude. Wat je met een tip doet, blijft op je telefoon.</p>
        <p>Het boekennieuws komt, net als de tips, uit een openbare lijst die elke zaterdag wordt vernieuwd. Of een bericht over een schrijver uit je lijst gaat, bekijkt de app op je telefoon zelf.</p>
        <p>Delen gaat alleen als jij op Deel tikt, en dan via het gewone deelmenu van je iPhone.</p>
        <p>Hulp van Claude bij een recensie: pas als jij op Open Claude tikt, gaan de titel, je sterren, je steekwoorden en wat je zelf al schreef naar je eigen Claude-account. De app praat zelf met geen enkele AI-dienst.</p>
      </details>
      <details>
        <summary>Hoe werkt het ophalen van covers en synopsis?</summary>
        <p>Na een import of bij nieuwe boeken zoekt de app op de achtergrond covers, gegevens en een korte synopsis. Dat gaat alleen door zolang de app open is.</p>
        <p>Google Books beantwoordt 1.000 vragen per dag. Het werk op de achtergrond gebruikt er hooguit 600, zodat zoeken altijd blijft werken. Is het op, dan gaat het de volgende ochtend vanaf 9:00 of 10:00 verder.</p>
        <p>Covers van Open Library worden als plaatje op je telefoon bewaard. Covers van Google bewaart de app zo goed als het gaat, zodat ze snel verschijnen.</p>
        <p>Geen cover gevonden? Via Covers zelf nalopen zoek je per boek in Google Afbeeldingen, kopieer je het plaatje en plak je het in de app. Automatisch de eerste hit van Google gebruiken kan niet: Google biedt daar geen gratis koppeling meer voor.</p>
      </details>
      <details>
        <summary>Hoe leren de tips?</summary>
        <p>Elke week komen er 16 tips; je ziet er 8 tegelijk. Kies je Wil ik lezen of Al gelezen, dan komen tips uit die categorie hoger. Niet voor mij laat ze zakken. Je vijfsterrenboeken tellen een beetje mee.</p>
        <p>Wil je dat de tips zelf beter worden, deel dan af en toe een backup met Claude in een sessie. Dan wordt je lezersprofiel voor de wekelijkse taak bijgewerkt.</p>
      </details>
      <details>
        <summary>Wat kan de app niet?</summary>
        <p>Er is geen koppeling met je Kobo of Kobo Plus: daar biedt Kobo geen mogelijkheid voor. Wel kun je een boek markeren als Wacht op Kobo Plus en het met één tik opzoeken bij Kobo.</p>
        <p>Er is geen automatische backup naar de cloud: een backup maak je zelf. Na 14 dagen herinnert de app je eraan.</p>
        <p>Je boeken staan niet op meerdere apparaten tegelijk. Op een nieuwe telefoon zet je een backup terug.</p>
      </details>
      <details>
        <summary>Waarom is het zo gebouwd?</summary>
        <p>De app is een webapp op je beginscherm: geen App Store en geen kosten. Hij werkt ook zonder internet. Je gegevens blijven van jou, en de app gebruikt alleen gratis bronnen.</p>
      </details>
    </section>`;
}

// Wie al boeken heeft, maakt eerst een backup (vandaag of gisteren) voor een import.
function backupNodig(aantal) {
  const dagen = dagenSindsBackup();
  return aantal > 0 && (dagen === null || dagen > 1);
}

async function toonInstellingen() {
  const nr = schermNr;
  ruimCoversOp();
  const aantal = (await alleBoeken()).length;
  if (nr !== schermNr) return;
  app.innerHTML = `
    <header class="kop">
      <a class="terug" href="#/">‹ Boeken</a>
      <h1>Instellingen</h1>
    </header>

    <section class="blok">
      <h2>Backup</h2>
      <p>Je boeken staan alleen op deze telefoon. Bewaar regelmatig een backup in iCloud Drive: kies in het deelmenu <b>Bewaar in Bestanden</b>.</p>
      <p class="zacht" id="backup-status">${backupTekst()}</p>
      <button class="hoofdknop" id="backup-maken"${aantal ? '' : ' disabled'}>Backup maken</button>
      <label class="tweede-knop bestand-knop">Backup terugzetten
        <input type="file" id="backup-bestand" accept="application/json,.json" hidden />
      </label>
      <div id="terugzet-vak"></div>
      <div class="verhuis" id="verhuis"></div>
    </section>

    <section class="blok">
      <h2>Excel-lijst importeren</h2>
      <p>Kies een Excel-bestand (.xlsx) met de kolommen Auteur en Titel, en eventueel Gelezen (maand), Sterren en Opmerking. Je ziet eerst wat er wordt toegevoegd.</p>
      ${
        backupNodig(aantal)
          ? '<p class="zacht">Maak eerst hierboven een backup. Dan kun je na de import altijd terug.</p>'
          : `<label class="tweede-knop bestand-knop">Kies Excel-bestand
               <input type="file" id="excel-bestand" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden />
             </label>`
      }
      <div id="import-vak"></div>
    </section>

    <section class="blok">
      <h2>Excel-export</h2>
      <p>Je hele lijst als Excel-bestand, met sterren, leesdata en recensies. Handig om te bewaren, te delen of op je laptop te bekijken.</p>
      <button class="tweede-knop" id="export"${aantal ? '' : ' disabled'}>Maak Excel-bestand</button>
    </section>

    <section class="blok">
      <h2>Covers en synopsis</h2>
      <p id="cover-telling" class="zacht">&nbsp;</p>
      <p id="synopsis-telling" class="zacht"></p>
      <p class="verrijk-status" id="verrijk-status" hidden></p>
      <button class="tweede-knop" id="covers-opnieuw" hidden>Zoek opnieuw naar ontbrekende covers</button>
      <a class="tweede-knop" id="covers-nalopen" href="#/covers" hidden>Covers zelf nalopen</a>
      <button class="link-knop" id="bronnen-test">Test de verbinding met de boekenbronnen</button>
      <p class="zacht" id="bronnen-uitslag"></p>
    </section>

    <section class="blok">
      <h2>Weergave</h2>
      <div class="keuzes" id="weergave">
        ${Object.entries(WEERGAVEN)
          .map(([k, naam]) => `<button class="keuze${k === weergave() ? ' actief' : ''}" data-weergave="${k}">${naam}</button>`)
          .join('')}
      </div>
      <p class="zacht klein">Donker 's avonds: van 20:00 tot 7:00 donker, en altijd als je iPhone op donker staat.</p>
    </section>

    ${overDezeAppHtml()}

    <p class="versie">Versie van ${__VERSIE__}</p>
  `;

  // Stap 1: bestand klaarmaken. Stap 2: bewaren. iOS wil dat het deelmenu
  // direct na een tik opent, daarom twee tikken in plaats van één.
  const maakKnop = document.getElementById('backup-maken');
  let bestand = null;
  maakKnop.addEventListener('click', async () => {
    if (!bestand) {
      maakKnop.disabled = true;
      maakKnop.textContent = 'Backup klaarmaken…';
      bestand = await maakBackupBestand();
      maakKnop.disabled = false;
      maakKnop.textContent = `Bewaar backup (${aantal} ${aantal === 1 ? 'boek' : 'boeken'})`;
      return;
    }
    try {
      if (await bewaarBackup(bestand)) {
        // Volgende keer weer een verse backup maken.
        bestand = null;
        maakKnop.textContent = 'Backup maken';
        document.getElementById('backup-status').textContent = backupTekst();
        melding('Backup bewaard');
      }
    } catch {
      melding('Bewaren lukte niet. Probeer het nog eens.');
    }
  });

  toonVerhuis();

  document.getElementById('weergave').addEventListener('click', (e) => {
    const knop = e.target.closest('[data-weergave]');
    if (!knop) return;
    try {
      localStorage.setItem('weergave', knop.dataset.weergave);
    } catch {
      // Niet erg; dan geldt de keuze alleen nu.
    }
    window.boekenThema?.toepassen();
    document.querySelectorAll('#weergave .keuze').forEach((k) => k.classList.toggle('actief', k === knop));
  });

  const telling = await coverTelling();
  const zonder = telling.totaal - telling.met;
  document.getElementById('cover-telling').textContent = telling.totaal
    ? `${telling.met} van de ${telling.totaal} boeken hebben een cover.`
    : 'Nog geen boeken.';
  const syn = await synopsisTelling();
  document.getElementById('synopsis-telling').textContent = syn.totaal
    ? `${syn.met} van de ${syn.totaal} boeken hebben een synopsis${
        syn.open ? ` (nog ${syn.open} te zoeken${(await aantalTeVerrijken()) ? '; begint zodra de covers klaar zijn' : ''})` : ''
      }.`
    : '';
  const opnieuw = document.getElementById('covers-opnieuw');
  opnieuw.hidden = !zonder;
  // Nalopen: boeken zonder cover en covers die alleen via internet bestaan.
  const stand = await coverStand();
  const nalopen = document.getElementById('covers-nalopen');
  nalopen.hidden = !(stand.geen + stand.internet);
  nalopen.textContent = `Covers zelf nalopen (${stand.geen + stand.internet})`;
  opnieuw.textContent = `Zoek opnieuw naar ontbrekende covers (${zonder})`;
  opnieuw.addEventListener('click', async () => {
    opnieuw.disabled = true;
    const n = await zonderCoverOpnieuw();
    const el = document.getElementById('verrijk-status');
    el.textContent = `Bezig met ${n} boeken…`;
    el.hidden = false;
  });

  // Net als bij de backup: eerst klaarmaken, dan delen (iOS opent het deelmenu alleen direct na een tik).
  const exportKnop = document.getElementById('export');
  let excel = null;
  exportKnop.addEventListener('click', async () => {
    if (!excel) {
      exportKnop.disabled = true;
      exportKnop.textContent = 'Excel-bestand maken…';
      try {
        excel = await maakExcel();
      } catch {
        exportKnop.disabled = false;
        exportKnop.textContent = 'Maak Excel-bestand';
        melding('Excel-bestand maken lukte niet. Probeer het nog eens.');
        return;
      }
      exportKnop.disabled = false;
      exportKnop.className = 'hoofdknop';
      exportKnop.textContent = `Deel Excel-bestand (${excel.aantal} boeken)`;
      return;
    }
    try {
      await deelBestand(excel.bestand);
    } catch {
      melding('Delen lukte niet. Probeer het nog eens.');
    }
  });

  document.getElementById('bronnen-test').addEventListener('click', async () => {
    const uitslag = document.getElementById('bronnen-uitslag');
    uitslag.textContent = 'Testen…';
    const { openLibrary, google } = await testBronnen();
    const regel = (naam, r) =>
      r.ok
        ? `${naam}: werkt`
        : `${naam}: werkt niet${
            r.daglimiet
              ? ` (daglimiet bereikt, weer beschikbaar om ${googleWeerOm().toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })})`
              : r.status === 429
                ? ' (even te druk, probeer het zo nog eens)'
                : r.status === 403 ? ' (sleutel geweigerd)' : r.status ? ` (fout ${r.status})` : ' (geen verbinding)'
          }`;
    uitslag.textContent = `${regel('Open Library', openLibrary)}. ${regel('Google Books', google)}. Vandaag ${googleStand().gebruikt} van de 1.000 Google-vragen gebruikt.`;
  });

  const verrijkOpen = await aantalTeVerrijken();
  if (verrijkOpen) {
    const el = document.getElementById('verrijk-status');
    el.textContent = `Nog ${verrijkOpen} boeken zonder opgehaalde cover. Dit gaat vanzelf verder zolang de app open is.`;
    el.hidden = false;
  }

  document.getElementById('excel-bestand')?.addEventListener('change', async (e) => {
    const gekozen = e.target.files?.[0];
    e.target.value = '';
    if (!gekozen) return;
    const vak = document.getElementById('import-vak');
    vak.innerHTML = '<p class="bezig">Bestand lezen…</p>';
    let plan;
    try {
      plan = planImport(await leesExcel(gekozen), await alleBoeken());
    } catch (fout) {
      vak.innerHTML = `<div class="waarschuwing"><p>${veilig(fout.message)}</p></div>`;
      return;
    }
    const { toevoegen, bijwerken, overslaan, nietGevonden } = plan;
    const n = toevoegen.length;
    const m = bijwerken.length;
    const boekTekst = (x) => (x === 1 ? '1 boek' : `${x} boeken`);
    // Wat er bij bestaande boeken wordt aangevuld: sterren, categorie of allebei.
    const velden = [
      bijwerken.some((b) => b.wijzigingen.sterren) && 'sterren',
      bijwerken.some((b) => b.wijzigingen.categorie) && 'categorie',
    ].filter(Boolean).join(' en ');
    const knopTekst = [n && `importeer ${boekTekst(n)}`, m && `vul ${velden} aan bij ${boekTekst(m)}`].filter(Boolean).join(' en ');
    const aanvulling = ({ sterren, categorie }) => [sterren && sterrenTekst(sterren), categorie && veilig(categorie)].filter(Boolean).join(' · ');
    vak.innerHTML = `
      <div class="waarschuwing">
        ${
          n
            ? `<p><strong>${boekTekst(n)} om toe te voegen</strong><br />
               ${toevoegen.filter((b) => b.sterren).length} met sterren, ${toevoegen.filter((b) => b.leesdata.length).length} met leesdatum.
               Covers en verdere gegevens worden daarna op de achtergrond opgehaald.</p>`
            : ''
        }
        ${
          m
            ? `<details${n ? '' : ' open'}><summary><strong>Bij ${boekTekst(m)} die je al hebt, wordt ${velden === 'sterren' ? 'het aantal sterren' : velden} aangevuld</strong></summary>
                 <ul class="overslaan">${bijwerken
                   .map(({ al, wijzigingen }) => `<li>${veilig(al.titel)} <span class="zacht">→ ${aanvulling(wijzigingen)}</span></li>`)
                   .join('')}</ul></details>`
            : ''
        }
        ${
          overslaan.length
            ? `<details><summary>${overslaan.length} ${overslaan.length === 1 ? 'boek staat' : 'boeken staan'} al in je lijst en ${overslaan.length === 1 ? 'wordt' : 'worden'} overgeslagen</summary>
                 <ul class="overslaan">${overslaan
                   .map(({ boek, al }) => `<li>${veilig(boek.titel)} <span class="zacht">(al in je lijst als "${veilig(al.titel)}")</span></li>`)
                   .join('')}</ul></details>`
            : ''
        }
        ${
          nietGevonden.length
            ? `<details><summary>${boekTekst(nietGevonden.length)} niet gevonden in je lijst (${nietGevonden.length === 1 ? 'wordt' : 'worden'} niet toegevoegd)</summary>
                 <ul class="overslaan">${nietGevonden
                   .map((boek) => `<li>${veilig(boek.titel)} <span class="zacht">${veilig(auteurTekst(boek))}</span></li>`)
                   .join('')}</ul></details>`
            : ''
        }
        ${!n && !m ? '<p>Er is niets toe te voegen of bij te werken.</p>' : ''}
        ${knopTekst ? `<button class="hoofdknop" id="importeren">${knopTekst.charAt(0).toUpperCase() + knopTekst.slice(1)}</button>` : ''}
        <button class="link-knop" id="import-annuleer">${knopTekst ? 'Annuleren' : 'Sluiten'}</button>
      </div>`;
    document.getElementById('import-annuleer').addEventListener('click', () => (vak.innerHTML = ''));
    document.getElementById('importeren')?.addEventListener('click', async (k) => {
      k.currentTarget.disabled = true;
      k.currentTarget.textContent = 'Bezig…';
      try {
        if (n) await boekenImporteren(toevoegen);
        if (m) await boekenAanvullen(bijwerken.map(({ al, wijzigingen }) => ({ id: al.id, wijzigingen })));
      } catch {
        vak.innerHTML = '<div class="waarschuwing"><p>Importeren is mislukt. Maak zo nodig je backup terug.</p></div>';
        return;
      }
      zoekterm = '';
      location.hash = '#/';
      melding([n && `${boekTekst(n)} toegevoegd`, m && `${velden} bij ${boekTekst(m)}`].filter(Boolean).join(', '));
      if (n) verrijkAlles();
    });
  });

  document.getElementById('backup-bestand').addEventListener('change', async (e) => {
    const gekozen = e.target.files?.[0];
    e.target.value = '';
    if (!gekozen) return;
    const vak = document.getElementById('terugzet-vak');
    let inhoud;
    try {
      inhoud = await leesBackup(gekozen);
    } catch (fout) {
      vak.innerHTML = `<div class="waarschuwing"><p>${veilig(fout.message)}</p></div>`;
      return;
    }
    const gemaakt = new Date(inhoud.gemaakt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    vak.innerHTML = `
      <div class="waarschuwing">
        <p><strong>Backup van ${gemaakt} met ${inhoud.boeken.length} boeken</strong><br />
        ${aantal ? `Je huidige lijst van ${aantal === 1 ? '1 boek' : `${aantal} boeken`} wordt hierdoor <b>vervangen</b>. Maak eerst een backup als je twijfelt.` : 'Je lijst is nu leeg.'}</p>
        <button class="gevaar-knop" id="terugzetten">${aantal ? 'Ja, vervang mijn lijst' : 'Terugzetten'}</button>
        <button class="link-knop" id="annuleer">Annuleren</button>
      </div>`;
    document.getElementById('annuleer').addEventListener('click', () => (vak.innerHTML = ''));
    document.getElementById('terugzetten').addEventListener('click', async (k) => {
      k.currentTarget.disabled = true;
      k.currentTarget.textContent = 'Bezig met terugzetten…';
      try {
        const n = await zetBackupTerug(inhoud);
        location.hash = '#/';
        melding(`${n} boeken teruggezet`);
      } catch {
        vak.innerHTML = '<div class="waarschuwing"><p>Terugzetten is mislukt. Je lijst is niet veranderd.</p></div>';
      }
    });
  });
}

// --- Toevoegen ---

let laatsteZoekterm = '';
let laatsteResultaten = [];

function toonToevoegen() {
  ruimCoversOp();
  app.innerHTML = `
    <header class="kop">
      <a class="terug" href="#/">‹ Terug</a>
      <h1>Toevoegen</h1>
    </header>
    <button class="hoofdknop scan-knop" id="scan">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2v14H3zM7 5h1v14H7zM10 5h2v14h-2zM14 5h1v14h-1zM17 5h1v14h-1zM20 5h1v14h-1z" /></svg>
      Scan streepjescode
    </button>
    <p class="of">of zoek op titel, auteur of ISBN</p>
    <form class="zoekbalk" id="zoekform">
      <input id="zoekveld" type="search" enterkeyhint="search" placeholder="Titel, auteur of ISBN" value="${veilig(laatsteZoekterm)}" autocomplete="off" />
      <button type="submit">Zoek</button>
    </form>
    <div id="resultaten"></div>
    <section class="toevoeg-tips" id="toevoeg-tips" hidden></section>
  `;
  document.getElementById('scan').addEventListener('click', toonScanner);
  toonToevoegTips();
  const veld = document.getElementById('zoekveld');
  document.getElementById('zoekform').addEventListener('submit', (e) => {
    e.preventDefault();
    veld.blur();
    zoek(veld.value.trim());
  });
  if (laatsteResultaten.length) toonResultaten(laatsteResultaten);
}

// --- Scannen ---

let stopCamera = null;

// Telt op bij elk openen en sluiten, zodat een camera die nog aan het opstarten was
// meteen weer uitgaat als je intussen op Annuleren tikte.
let scanBeurt = 0;

function sluitScanner() {
  scanBeurt += 1;
  stopCamera?.();
  stopCamera = null;
  document.getElementById('scanner')?.remove();
}

async function toonScanner() {
  sluitScanner();
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="scanner" id="scanner">
       <video id="scan-video" playsinline muted autoplay></video>
       <div class="scan-kader"></div>
       <p class="scan-tekst" id="scan-tekst">Richt op de streepjescode achterop het boek</p>
       <button class="scan-sluit" id="scan-sluit">Annuleren</button>
     </div>`
  );
  document.getElementById('scan-sluit').addEventListener('click', sluitScanner);
  const tekst = document.getElementById('scan-tekst');
  const beurt = scanBeurt;
  try {
    const stop = await startScanner(document.getElementById('scan-video'), async (isbn) => {
      tekst.textContent = `ISBN ${isbn} gevonden. Gegevens ophalen…`;
      await zoekGescandBoek(isbn, 'scan');
      sluitScanner();
    });
    if (beurt !== scanBeurt) stop();
    else stopCamera = stop;
  } catch (fout) {
    tekst.textContent =
      fout?.name === 'NotAllowedError'
        ? 'De app mag de camera niet gebruiken. Sta het toe in Instellingen van je iPhone, of zoek op ISBN.'
        : 'De camera start niet. Probeer het opnieuw, of typ het ISBN in het zoekveld.';
  }
}

// Boek opzoeken met een ISBN (gescand of getypt) en het voorstel tonen.
async function zoekGescandBoek(isbn, bron) {
  let boek = null;
  let reden = 'onbekend';
  try {
    boek = await zoekOpIsbn(isbn);
  } catch (fout) {
    if (!(fout instanceof GoogleWeigert)) {
      melding('Geen verbinding. Probeer het zo nog eens.');
      return;
    }
    reden = 'google';
  }
  if (boek) toonBevestigen({ ...boek, bron });
  else toonBevestigen({ titel: '', auteurs: [], isbn, handmatig: true, bron, reden });
}

let zoekBron = 'getypt';

async function zoek(tekst, bron = 'getypt') {
  zoekBron = bron;
  if (!tekst) return;
  // Een getypt ISBN direct opzoeken.
  const cijfers = tekst.replace(/[\s-]/g, '');
  if (geldigIsbn13(cijfers) || /^\d{9}[\dX]$/i.test(cijfers)) {
    document.getElementById('resultaten').innerHTML = `<p class="bezig">ISBN opzoeken…</p>`;
    await zoekGescandBoek(cijfers.toUpperCase(), 'getypt');
    return;
  }
  laatsteZoekterm = tekst;
  const vak = document.getElementById('resultaten');
  vak.innerHTML = `<p class="bezig">Zoeken…</p>`;
  try {
    laatsteResultaten = await zoekBoeken(tekst);
    await toonResultaten(laatsteResultaten);
  } catch {
    vak.innerHTML = `
      <p class="leeg">Zoeken lukt nu niet. Controleer je internetverbinding.</p>
      ${zelfInvullenKnop()}`;
    koppelZelfInvullen();
  }
}

function zelfInvullenKnop() {
  return `<button class="link-knop" id="zelf">Niet gevonden? Zelf invullen</button>`;
}

function koppelZelfInvullen() {
  document.getElementById('zelf').addEventListener('click', () =>
    toonBevestigen({ titel: laatsteZoekterm, auteurs: [], handmatig: true })
  );
}

async function toonResultaten(resultaten) {
  const vak = document.getElementById('resultaten');
  if (!vak) return;
  const mijnBoeken = await alleBoeken();
  vak.innerHTML = `
    ${resultaten.length ? '' : '<p class="leeg">Niets gevonden. Probeer andere woorden.</p>'}
    <ul class="lijst">
      ${resultaten
        .map(
          (b, i) => `
        <li><button class="boek resultaat" data-i="${i}">
          ${coverHtml(b, 'cover-klein')}
          <div class="boek-tekst">
            <strong>${veilig(b.titel)}</strong>
            <span>${veilig(auteurTekst(b))}${b.jaar ? ` · ${veilig(b.jaar)}` : ''}${b.taal ? ` · ${veilig(b.taal.toUpperCase())}` : ''}</span>
            ${vindDubbel(b, mijnBoeken) ? `<span class="al-in-lijst">Staat al in je lijst · ${veilig(statusNaam(vindDubbel(b, mijnBoeken).status))}</span>` : ''}
          </div>
        </button></li>`
        )
        .join('')}
    </ul>
    ${zelfInvullenKnop()}
  `;
  vak.querySelectorAll('.resultaat').forEach((knop) =>
    knop.addEventListener('click', () => toonBevestigen({ ...resultaten[Number(knop.dataset.i)], bron: zoekBron }))
  );
  koppelZelfInvullen();
}

async function toonBevestigen(boek) {
  ruimCoversOp();
  let status = 'Wil ik lezen';
  const mijnBoeken = await alleBoeken();
  // Een voorstel, op basis van je andere boeken van deze schrijver of de onderwerpen.
  let categorie = raadCategorie(boek, mijnBoeken);
  const dubbel = boek.handmatig ? null : vindDubbel(boek, mijnBoeken);
  app.innerHTML = `
    <header class="kop">
      <button class="terug link-knop" id="anders">‹ Ander boek</button>
      <h1>${boek.handmatig ? 'Zelf invullen' : 'Bedoel je dit boek?'}</h1>
    </header>
    <section class="bevestig">
      ${
        boek.handmatig
          ? `<label>Titel<input id="titel" value="${veilig(boek.titel)}" /></label>
             <label>Auteur<input id="auteur" placeholder="Bijvoorbeeld Toon Tellegen" /></label>
             ${boek.isbn ? `<p class="details">ISBN ${veilig(boek.isbn)}</p>` : ''}
             ${
               boek.reden === 'google'
                 ? '<p class="details">Open Library en de Koninklijke Bibliotheek kennen dit ISBN niet, en Google Books gaf geen antwoord (storing of daglimiet). Vul titel en auteur zelf in; cover en gegevens worden later aangevuld.</p>'
                 : boek.reden === 'onbekend'
                   ? '<p class="details">Dit ISBN is bij Open Library, Google Books en de Koninklijke Bibliotheek niet bekend. Vul titel en auteur zelf in.</p>'
                   : ''
             }`
          : `${coverHtml(boek, 'cover-groot')}
             <h2>${veilig(boek.titel)}</h2>
             <p>${veilig(auteurTekst(boek))}</p>
             <p class="details">${[boek.jaar, boek.paginas && `${boek.paginas} blz.`, boek.isbn && `ISBN ${boek.isbn}`]
               .filter(Boolean)
               .map(veilig)
               .join(' · ')}</p>
             ${boek.synopsis ? `<div class="synopsis kort voorproef">${synopsisHtml(boek.synopsis)}</div>` : ''}`
      }
      ${dubbel ? waarschuwingHtml(dubbel) : ''}
      <p class="label">Status</p>
      <div class="keuzes" id="statussen">
        ${STATUSSEN.map((s) => `<button class="keuze${s === status ? ' actief' : ''}" data-s="${s}">${statusNaam(s)}</button>`).join('')}
      </div>
      <p class="label">Categorie${categorie ? ' <span class="zacht">(voorstel)</span>' : ''}</p>
      <div class="keuzes" id="categorieen">${categorieKnoppen(categorie)}</div>
      <button class="${dubbel ? 'tweede-knop' : 'hoofdknop'}" id="opslaan">${dubbel ? 'Toch toevoegen' : 'Toevoegen'}</button>
    </section>
  `;

  document.getElementById('anders').addEventListener('click', () => toonToevoegen());

  // Resultaten van Google Books kennen hun werk niet; zoek het op via het ISBN.
  // Blijkt het een vertaling van een boek dat je al hebt, dan alsnog waarschuwen.
  if (!boek.handmatig && !boek.werk && boek.isbn) {
    zoekWerk(boek.isbn).then((werk) => {
      boek.werk = werk;
      const knop = document.getElementById('opslaan');
      if (dubbel || !werk || !knop || knop.disabled) return;
      const vertaling = vindDubbel(boek, mijnBoeken);
      if (!vertaling) return;
      document.querySelector('.bevestig .label').insertAdjacentHTML('beforebegin', waarschuwingHtml(vertaling));
      knop.textContent = 'Toch toevoegen';
      knop.className = 'tweede-knop';
    });
  }
  document.querySelectorAll('#statussen .keuze').forEach((knop) =>
    knop.addEventListener('click', () => {
      status = knop.dataset.s;
      document.querySelectorAll('#statussen .keuze').forEach((k) => k.classList.toggle('actief', k === knop));
    })
  );

  document.getElementById('categorieen').addEventListener('click', (e) => {
    const knop = e.target.closest('.keuze');
    if (!knop) return;
    categorie = categorie === knop.dataset.c ? '' : knop.dataset.c;
    document.querySelectorAll('#categorieen .keuze').forEach((k) => k.classList.toggle('actief', k.dataset.c === categorie));
  });

  document.getElementById('opslaan').addEventListener('click', async (e) => {
    const knop = e.currentTarget;
    let gegevens = boek;
    if (boek.handmatig) {
      const titel = document.getElementById('titel').value.trim();
      const auteur = document.getElementById('auteur').value.trim();
      if (!titel) {
        melding('Vul een titel in');
        return;
      }
      gegevens = { titel, auteurs: auteur ? [auteur] : [], isbn: boek.isbn ?? '' };
      // Bij zelf invullen pas na het typen controleren, en één keer waarschuwen.
      const zelfDubbel = vindDubbel(gegevens, await alleBoeken());
      if (zelfDubbel && !knop.dataset.gewaarschuwd) {
        knop.dataset.gewaarschuwd = 'ja';
        knop.insertAdjacentHTML('beforebegin', waarschuwingHtml(zelfDubbel));
        knop.textContent = 'Toch toevoegen';
        knop.className = 'tweede-knop';
        return;
      }
    }
    knop.disabled = true;
    knop.textContent = 'Bezig met opslaan…';
    const cover = await zoekCover(gegevens);
    if (!gegevens.werk && gegevens.isbn) gegevens.werk = await zoekWerk(gegevens.isbn);
    // Zelf ingevuld zonder cover: later op de achtergrond nog eens zoeken.
    const verrijkt = !(boek.handmatig && !cover.cover && !cover.coverUrl);
    await boekToevoegen({ ...gegevens, ...cover, status, categorie, bron: boek.bron ?? 'getypt', verrijkt });
    if (!verrijkt) verrijkAlles();
    laatsteZoekterm = '';
    laatsteResultaten = [];
    // Intussen ergens anders heen gegaan? Dan daar blijven.
    if (knop.isConnected) location.hash = '#/';
    melding('Toegevoegd');
  });
}

// Een rustige, gedempte kleur per categorie, voor een bolletje in de lijst en de knoppen.
const CATEGORIE_KLEUR = {
  'Thriller & spanning': '#8e3b46',
  'Oorlog & geschiedenis': '#7a6542',
  Sport: '#2f6f8f',
  'Biografie & levensverhaal': '#b0682c',
  'Journalistiek & samenleving': '#4c5c8c',
  'Roman & humor': '#b8891f',
  'Geloof & zingeving': '#5c7f4f',
  Overig: '#8a8680',
};

function categorieStip(categorie) {
  if (!CATEGORIE_KLEUR[categorie]) return '';
  return `<span class="cat"><i style="--c:${CATEGORIE_KLEUR[categorie]}"></i>${veilig(categorie.split(' & ')[0])}</span>`;
}

function categorieKnoppen(gekozen = '') {
  return CATEGORIEEN.map(
    (c) => `<button class="keuze${c === gekozen ? ' actief' : ''}" data-c="${veilig(c)}" style="--c:${CATEGORIE_KLEUR[c]}">${veilig(c)}</button>`
  ).join('');
}

function waarschuwingHtml(bestaand) {
  const oordeel = bestaand.sterren ? `, ${bestaand.sterren} ${bestaand.sterren === 1 ? 'ster' : 'sterren'}` : '';
  const gelezen = bestaand.leesdata?.length ? `, gelezen ${datumTekst(bestaand.leesdata[bestaand.leesdata.length - 1])}` : '';
  return `
    <div class="waarschuwing">
      <p><strong>Dit boek staat al in je lijst</strong><br />
      ${veilig(bestaand.titel)} · ${veilig(statusNaam(bestaand.status))}${oordeel}${gelezen}</p>
      <a class="hoofdknop" href="#/boek/${bestaand.id}">Open dat boek</a>
    </div>`;
}

function synopsisHtml(tekst) {
  return tekst
    .split(/\n{2,}/)
    .map((alinea) => `<p>${veilig(alinea).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

// --- Profiel ---

// Eén adres voor de profielfoto, hergebruikt op elk scherm; nieuw bij een andere foto.
let fotoAdres = null;
let fotoVan = null;
async function profielFotoAdres() {
  const foto = await haalProfielFoto();
  if (foto !== fotoVan || (foto && !fotoAdres)) {
    if (fotoAdres) URL.revokeObjectURL(fotoAdres);
    fotoAdres = foto ? URL.createObjectURL(foto) : null;
    fotoVan = foto;
  }
  return fotoAdres;
}

// Rondje met foto, of anders de eerste letter van de naam (of een poppetje).
function avatarHtml(klasse, profiel, foto, reserve) {
  if (foto) return `<img class="${klasse} met-foto" src="${veilig(foto)}" alt="" />`;
  return `<div class="${klasse}">${profiel.naam ? veilig(profiel.naam.charAt(0).toUpperCase()) : reserve}</div>`;
}

// Een rij staafjes: label, staaf naar verhouding, aantal. De grootste staaf is vol.
function stavenHtml(rijen) {
  const max = Math.max(1, ...rijen.map((r) => r.aantal));
  return `<ul class="staven">${rijen
    .map(
      (r) => `
      <li>
        <span class="staaf-label">${veilig(r.label)}</span>
        <span class="staaf"><span style="width:${Math.max(2, Math.round((r.aantal / max) * 100))}%"></span></span>
        <span class="staaf-aantal">${r.aantal}${r.extra ? ` <span class="zacht">${r.extra}</span>` : ''}</span>
      </li>`
    )
    .join('')}</ul>`;
}

function maandTekst(maand, kort = false) {
  const [j, m] = maand.split('-').map(Number);
  return new Date(j, m - 1, 15).toLocaleDateString('nl-NL', { month: kort ? 'short' : 'long', year: 'numeric' });
}

function statistiekenHtml(st, vanaf) {
  const komma = (x) => x.toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const keuze = `
    <label class="stat-vanaf">Telt vanaf
      <input type="month" id="stat-vanaf" value="${vanaf}" max="${huidigeMaand()}" />
    </label>`;
  if (!st.gelezen) {
    return `
      <section class="statistieken" id="statistieken">
        <h2 class="stat-kop">Je leesjaar</h2>
        <p class="zacht">Vanaf ${maandTekst(vanaf)} houdt de app bij wat je leest. Lees je een boek uit en vul je bij dat boek de datum in, dan verschijnt hier je overzicht.</p>
        ${keuze}
      </section>`;
  }
  return `
    <section class="statistieken" id="statistieken">
      <h2 class="stat-kop">Sinds ${maandTekst(vanaf)}</h2>
      <div class="tegels">
        <div class="tegel"><strong>${st.gelezen}</strong><span>gelezen</span></div>
        <div class="tegel"><strong>${st.dezeMaand}</strong><span>deze maand</span></div>
        <div class="tegel"><strong>${st.gemiddeld ? `${komma(st.gemiddeld)}<small>★</small>` : '–'}</strong><span>gemiddeld</span></div>
      </div>
      ${st.gemiddeld ? `<p class="zacht klein">Gemiddelde over ${st.metSterren} ${st.metSterren === 1 ? 'boek' : 'boeken'} met sterren.</p>` : ''}

      <h2 class="stat-kop">Per maand</h2>
      ${stavenHtml(st.perMaand.map((m) => ({ label: maandTekst(m.maand, true), aantal: m.aantal })))}

      ${
        st.perJaar.length > 1
          ? `<h2 class="stat-kop">Per jaar</h2>
             ${stavenHtml(st.perJaar.map((j) => ({ label: String(j.jaar), aantal: j.aantal })))}`
          : ''
      }

      <h2 class="stat-kop">Wat je leest</h2>
      ${stavenHtml(st.perCategorie.map((c) => ({ label: c.categorie, aantal: c.aantal, extra: c.gemiddeld ? `${komma(c.gemiddeld)}★` : '' })))}

      ${
        st.schrijvers.length
          ? `<h2 class="stat-kop">Schrijvers die je het vaakst las</h2>
             ${stavenHtml(st.schrijvers.map((a) => ({ label: a.naam, aantal: a.aantal })))}`
          : ''
      }
      ${keuze}
    </section>`;
}

async function toonProfiel() {
  const nr = schermNr;
  ruimCoversOp();
  const [profiel, boeken, foto] = await Promise.all([haalProfiel(), alleBoeken(), profielFotoAdres()]);
  if (nr !== schermNr) return;
  // De statistieken tellen vanaf de maand waarin de gebruiker begon met bijhouden.
  // Nog niet gekozen: deze maand, en die keuze wordt bewaard zodat hij niet elke maand verschuift.
  if (!geldigeStartmaand(profiel.statsVanaf)) {
    profiel.statsVanaf = huidigeMaand();
    await bewaarProfiel(profiel);
    if (nr !== schermNr) return;
  }
  const top = boeken
    .filter((b) => b.sterren === 5)
    .sort((a, b) => laatsteLeesdatum(b).localeCompare(laatsteLeesdatum(a)) || a.titel.localeCompare(b.titel, 'nl'));
  app.innerHTML = `
    <header class="kop">
      <a class="terug" href="#/">‹ Boeken</a>
    </header>
    <section class="profiel">
      <div class="profiel-kop">
        <label class="profiel-foto-kiezen" aria-label="Kies een profielfoto">
          <span id="avatar">${avatarHtml('profiel-groot', profiel, foto, '?')}</span>
          <input type="file" accept="image/*" id="p-foto" hidden />
        </label>
        <div>
          <h1 id="profiel-naam-kop">${veilig(profiel.naam || 'Mijn profiel')}</h1>
          <p class="zacht">${(() => {
            const n = boeken.filter((b) => b.status === 'Gelezen').length;
            return `${n === 1 ? '1 boek' : `${n} boeken`} gelezen · ${top.length} met vijf sterren`;
          })()}</p>
          <div class="foto-knoppen">
            <label class="link-knop" for="p-foto">${foto ? 'Andere foto' : 'Foto toevoegen'}</label>
            ${foto ? '<button class="link-knop zacht" id="p-foto-weg">Weghalen</button>' : ''}
          </div>
        </div>
      </div>

      ${statistiekenHtml(berekenStatistieken(boeken, profiel.statsVanaf), profiel.statsVanaf)}
      <h2 class="stat-kop">Over jou</h2>

      <label class="veld">Naam<input id="p-naam" value="${veilig(profiel.naam)}" placeholder="Je voornaam" autocomplete="given-name" /></label>
      <label class="veld">Over mij<textarea id="p-over" rows="3" placeholder="Bijvoorbeeld wat je doet, waar en wanneer je leest">${veilig(profiel.overMij)}</textarea></label>
      <label class="veld">Mijn lezersprofiel<textarea id="p-profiel" rows="12" placeholder="Wat lees je graag, en waarom? Welke schrijvers of thema's raken je?">${veilig(profiel.lezersprofiel)}</textarea></label>
      <p class="opgeslagen" id="p-opgeslagen">&nbsp;</p>
    </section>
    ${rijHtml('Mijn vijfsterrenboeken', top, 'Gelezen')}
  `;
  document.querySelector('.rij-kop .link-knop')?.remove();

  // Vanzelf bewaren, kort nadat je stopt met typen.
  const velden = { naam: 'p-naam', overMij: 'p-over', lezersprofiel: 'p-profiel' };
  const opgeslagen = document.getElementById('p-opgeslagen');
  let timer;
  const bewaar = async () => {
    clearTimeout(timer);
    const nieuw = Object.fromEntries(Object.entries(velden).map(([k, id]) => [k, document.getElementById(id).value.trim()]));
    if (Object.keys(velden).every((k) => nieuw[k] === profiel[k])) return;
    Object.assign(profiel, nieuw);
    await bewaarProfiel(profiel);
    document.getElementById('profiel-naam-kop').textContent = profiel.naam || 'Mijn profiel';
    const letter = document.querySelector('div.profiel-groot');
    if (letter) letter.textContent = profiel.naam ? profiel.naam.charAt(0).toUpperCase() : '?';
    opgeslagen.textContent = 'Opgeslagen';
  };
  for (const id of Object.values(velden)) {
    const veld = document.getElementById(id);
    veld.addEventListener('input', () => {
      opgeslagen.innerHTML = '&nbsp;';
      clearTimeout(timer);
      timer = setTimeout(bewaar, 800);
    });
    veld.addEventListener('blur', bewaar);
  }
  toonBoek.bewaarOpenstaand = bewaar;

  document.getElementById('p-foto').addEventListener('change', async (e) => {
    const bestand = e.target.files?.[0];
    if (!bestand) return;
    try {
      await bewaarProfielFoto(await vierkanteFoto(bestand));
    } catch {
      melding('Deze foto kan ik niet lezen. Kies een andere.');
      return;
    }
    await bewaar();
    melding('Profielfoto bewaard');
    toonProfiel();
  });
  document.getElementById('p-foto-weg')?.addEventListener('click', async () => {
    await bewaarProfielFoto(null);
    await bewaar();
    toonProfiel();
  });

  // Andere startmaand: bewaren en de cijfers opnieuw tekenen.
  const koppelVanaf = () =>
    document.getElementById('stat-vanaf').addEventListener('change', async (e) => {
      const vanaf = geldigeStartmaand(e.target.value);
      if (!vanaf || vanaf > huidigeMaand()) return;
      profiel.statsVanaf = vanaf;
      await bewaarProfiel(profiel);
      document.getElementById('statistieken').outerHTML = statistiekenHtml(berekenStatistieken(boeken, vanaf), vanaf);
      koppelVanaf();
    });
  koppelVanaf();
}

// --- Boekennieuws ---

const NIEUWS_ZICHTBAAR = 3;

function nieuwsDatum(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d) ? '' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function nieuwsHtml(b, boeken) {
  return `
    <li>
      <a class="nieuws-bericht" href="${veilig(veiligeUrl(b.url))}" target="_blank" rel="noopener">
        <span class="nieuws-kop">${overMijnSchrijver(b, boeken) ? '<b>Schrijver die je leest</b> · ' : ''}${veilig(b.bron ?? '')}${
          b.datum ? ` · ${veilig(nieuwsDatum(b.datum))}` : ''
        }</span>
        <strong>${veilig(b.titel)}</strong>
        <span class="nieuws-tekst">${veilig(b.tekst ?? '')}</span>
      </a>
    </li>`;
}

// Een paar berichten onder de tips; 'Meer nieuws' klapt de rest uit.
async function toonNieuws(boeken) {
  const vak = document.getElementById('nieuws-rij');
  if (!vak) return;
  const berichten = ordenNieuws(await haalNieuws(), boeken);
  if (!berichten.length || !document.body.contains(vak)) return;
  vak.hidden = false;
  vak.innerHTML = `
    <div class="rij-kop"><h2>Boekennieuws</h2></div>
    <ul class="nieuws-lijst">${berichten.slice(0, NIEUWS_ZICHTBAAR).map((b) => nieuwsHtml(b, boeken)).join('')}</ul>
    ${
      berichten.length > NIEUWS_ZICHTBAAR
        ? `<details class="nieuws-meer"><summary>Meer nieuws (${berichten.length - NIEUWS_ZICHTBAAR})</summary>
             <ul class="nieuws-lijst">${berichten.slice(NIEUWS_ZICHTBAAR).map((b) => nieuwsHtml(b, boeken)).join('')}</ul>
           </details>`
        : ''
    }`;
}

// --- Boekentips ---

// Covers van tips onthouden, zodat ze niet elke keer opnieuw gezocht worden.
function tipCoverCache() {
  try {
    return JSON.parse(localStorage.getItem('tipCovers') || '{}');
  } catch {
    return {};
  }
}

// Een mislukte zoekpoging (bijvoorbeeld bij de Google-daglimiet) na drie dagen opnieuw proberen.
const TIP_COVER_OPNIEUW = 3 * 86400000;

async function tipCover(tip) {
  if (veiligeUrl(tip.coverUrl)) return veiligeUrl(tip.coverUrl);
  const cache = tipCoverCache();
  const bewaard = cache[tip.id];
  if (typeof bewaard === 'string' && bewaard) return bewaard;
  if (bewaard?.mislukt && Date.now() - bewaard.mislukt < TIP_COVER_OPNIEUW) return '';
  const { coverUrl } = await zoekCover(tip, { opTitel: true });
  cache[tip.id] = coverUrl || { mislukt: Date.now() };
  try {
    localStorage.setItem('tipCovers', JSON.stringify(cache));
  } catch {
    // Niet erg; dan zoeken we hem de volgende keer opnieuw.
  }
  return coverUrl || '';
}

// Eerst de tips die het toestel al heeft (meteen, zodat het scherm niet verspringt),
// daarna op de achtergrond kijken of er een nieuwe ronde is.
async function toonTipsRij(boeken, verversen = true) {
  const vak = document.getElementById('tips-rij');
  if (!vak) return;
  const tips = await tipsUitArchief(boeken);
  if (verversen) {
    verversTips().then((veranderd) => {
      if (veranderd && document.body.contains(vak)) toonTipsRij(boeken, false);
    });
  }
  if (!tips.length || !document.body.contains(vak)) return;
  vak.hidden = false;
  vak.innerHTML = `
    <div class="rij-kop"><h2>Tips voor jou</h2></div>
    <div class="rij-covers">
      ${tips
        .map(
          (t) => `
        <button class="rij-boek tip" data-tip="${veilig(t.id)}">
          <div class="rij-cover geen-cover" data-cover-voor="${veilig(t.id)}">${veilig(t.titel.charAt(0))}</div>
          <span class="rij-titel">${veilig(t.titel)}</span>
          <span class="tip-auteur">${veilig(auteurTekst(t))}</span>
        </button>`
        )
        .join('')}
    </div>`;
  vak.onclick = (e) => {
    const knop = e.target.closest('[data-tip]');
    if (knop) toonTip(tips.find((t) => t.id === knop.dataset.tip), boeken);
  };
  // Covers één voor één erbij zetten, zonder het scherm op te houden.
  vulTipCovers(vak, tips);
}

async function vulTipCovers(vak, tips) {
  for (const t of tips) {
    const url = await tipCover(t);
    const plek = vak.querySelector(`[data-cover-voor="${CSS.escape(t.id)}"]`);
    if (url && plek) {
      plek.outerHTML = `<img class="rij-cover" src="${veilig(url)}" alt="" data-letter="${veilig(t.titel.charAt(0))}" data-bij-fout="letter" />`;
      t.coverUrl = url;
    }
  }
}

function toonTip(tip, boeken, opnieuw = toonLijst) {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="laag" id="tip-laag">
       <div class="laag-blad tip-blad">
         <div class="laag-kop"><span class="status status-1">${tip.soort === 'parel' ? 'Parel die je misschien gemist hebt' : 'Nieuw verschenen'}</span><button class="link-knop" id="laag-sluit">Sluiten</button></div>
         <div class="tip-boven">
           ${veiligeUrl(tip.coverUrl) ? `<img class="held-cover" src="${veilig(veiligeUrl(tip.coverUrl))}" alt="" />` : `<div class="held-cover geen-cover">${veilig(tip.titel.charAt(0))}</div>`}
           <div>
             <h2>${veilig(tip.titel)}</h2>
             <p class="zacht">${veilig(auteurTekst(tip))}${tip.jaar ? ` · ${veilig(tip.jaar)}` : ''}</p>
           </div>
         </div>
         <p class="tip-reden">${veilig(tip.reden)}</p>
         ${tip.synopsis ? `<div class="synopsis">${synopsisHtml(tip.synopsis)}</div>` : ''}
         <button class="hoofdknop" data-reactie="wil">Wil ik lezen</button>
         <div class="tip-knoppen">
           <button class="tweede-knop" data-reactie="gelezen">Al gelezen</button>
           <button class="tweede-knop" data-reactie="nee">Niet voor mij</button>
         </div>
         <a class="link-knop tip-kobo" href="${koboZoekUrl(tip)}" target="_blank" rel="noopener">Zoek bij Kobo ↗</a>
       </div>
     </div>`
  );
  const laag = document.getElementById('tip-laag');
  const sluit = () => laag.remove();
  document.getElementById('laag-sluit').addEventListener('click', sluit);
  laag.addEventListener('click', async (e) => {
    if (e.target === laag) return sluit();
    const knop = e.target.closest('[data-reactie]');
    if (!knop) return;
    laag.querySelectorAll('[data-reactie]').forEach((k) => (k.disabled = true));
    const reactie = knop.dataset.reactie;
    await zetTipReactie(tip, reactie);
    if (reactie === 'nee') {
      sluit();
      melding('Deze tip zie je niet meer');
      opnieuw();
      return;
    }
    knop.textContent = 'Bezig…';
    const id = await voegTipToe(tip, reactie, boeken);
    sluit();
    if (reactie === 'gelezen') {
      // Meteen naar het boek, om sterren te geven.
      location.hash = `#/boek/${id}`;
      melding('Toegevoegd als gelezen. Geef je oordeel!');
    } else {
      melding('Op je lijst gezet: Wil ik lezen');
      opnieuw();
    }
  });
}

// Een tip als boek in de lijst zetten, met een voorstel voor de categorie.
async function voegTipToe(tip, reactie, boeken) {
  const cover = await zoekCover(tip);
  const id = await boekToevoegen({
    titel: tip.titel,
    auteurs: tip.auteurs ?? [],
    isbn: tip.isbn ?? '',
    uitgever: tip.uitgever ?? '',
    jaar: tip.jaar ?? null,
    synopsis: tip.synopsis || undefined,
    ...cover,
    status: reactie === 'gelezen' ? 'Gelezen' : 'Wil ik lezen',
    // De tip zegt zelf in welke categorie hij hoort; anders een voorstel.
    categorie: CATEGORIEEN.includes(tip.categorie) ? tip.categorie : raadCategorie(tip, boeken),
    bron: 'tip',
    verrijkt: false,
  });
  verrijkAlles();
  return id;
}

// Op de Toevoegen-pagina: de tips onder elkaar, met de reden erbij en een knop
// om ze meteen op je lijst te zetten. Tikken op een tip opent hem helemaal.
async function toonToevoegTips(verversen = true) {
  const vak = document.getElementById('toevoeg-tips');
  if (!vak) return;
  const boeken = await alleBoeken();
  const tips = await tipsUitArchief(boeken);
  if (verversen) {
    verversTips().then((veranderd) => {
      if (veranderd && document.body.contains(vak)) toonToevoegTips(false);
    });
  }
  if (!document.body.contains(vak)) return;
  vak.hidden = false;
  if (!tips.length) {
    vak.innerHTML = `
      <h2 class="stat-kop">Tips voor jou</h2>
      <p class="zacht">Je hebt op alle tips gereageerd. Elke zaterdagochtend komen er nieuwe.</p>`;
    return;
  }
  vak.innerHTML = `
    <h2 class="stat-kop">Tips voor jou</h2>
    <ul class="lijst">
      ${tips
        .map(
          (t) => `
        <li class="tip-regel">
          <button class="boek" data-tip="${veilig(t.id)}">
            <div class="cover-klein geen-cover" data-cover-voor="${veilig(t.id)}">${veilig(t.titel.charAt(0))}</div>
            <div class="boek-tekst">
              <strong>${veilig(t.titel)}</strong>
              <span>${veilig(auteurTekst(t))}</span>
              <span class="zacht tip-kort">${veilig(t.reden)}</span>
            </div>
          </button>
          <button class="tip-plus" data-plus="${veilig(t.id)}" aria-label="Zet ${veilig(t.titel)} op Wil ik lezen">+</button>
        </li>`
        )
        .join('')}
    </ul>`;
  const vind = (id) => tips.find((t) => t.id === id);
  vak.onclick = async (e) => {
    const plus = e.target.closest('[data-plus]');
    if (plus) {
      plus.disabled = true;
      const tip = vind(plus.dataset.plus);
      await zetTipReactie(tip, 'wil');
      await voegTipToe(tip, 'wil', boeken);
      plus.closest('li').classList.add('weg');
      melding(`"${tip.titel}" op je lijst gezet: Wil ik lezen`);
      setTimeout(() => toonToevoegTips(false), 250);
      return;
    }
    const knop = e.target.closest('[data-tip]');
    if (knop) toonTip(vind(knop.dataset.tip), boeken, () => toonToevoegTips(false));
  };
  for (const t of tips) {
    const url = await tipCover(t);
    const plek = vak.querySelector(`[data-cover-voor="${CSS.escape(t.id)}"]`);
    if (url && plek) {
      plek.outerHTML = `<img class="cover-klein" src="${veilig(url)}" alt="" data-letter="${veilig(t.titel.charAt(0))}" data-bij-fout="letter" />`;
      t.coverUrl = url;
    }
  }
}

// --- Hulp bij de recensie (via de Claude-app) ---

function toonRecensieHulp(boek, plakTerug) {
  const gekozen = new Set();
  let lengte = 'kort';
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="laag" id="hulp-laag">
       <div class="laag-blad">
         <div class="laag-kop"><h2>Hulp bij je recensie</h2><button class="link-knop" id="laag-sluit">Sluiten</button></div>
         <p class="zacht">Kies wat het boek voor je was en zeg er eventueel iets bij. Claude maakt er een recensie van; die plak je hier terug.</p>
         <p class="label">Het boek was</p>
         <div class="keuzes" id="steekwoorden">${STEEKWOORDEN.map((w) => `<button class="keuze" data-w="${veilig(w)}">${veilig(w)}</button>`).join('')}</div>
         <label class="veld">Een paar woorden van jezelf<input id="hulp-eigen" placeholder="Bijvoorbeeld: in één weekend uitgelezen" /></label>
         <p class="label">Lengte</p>
         <div class="keuzes" id="hulp-lengte">
           <button class="keuze actief" data-l="kort">Kort</button>
           <button class="keuze" data-l="lang">Uitgebreider</button>
         </div>
         <button class="hoofdknop" id="hulp-open">Open Claude</button>
         <p class="zacht klein" id="hulp-uitleg">De opdracht wordt ook gekopieerd. Staat hij niet vanzelf in Claude, plak hem daar dan zelf.</p>
         <button class="tweede-knop" id="hulp-plak">Plak de recensie van Claude</button>
         <p class="zacht klein">Kopieer in Claude de recensie, kom terug naar deze app en tik hierboven. Je kunt de tekst daarna gewoon nog aanpassen.</p>
       </div>
     </div>`
  );
  const laag = document.getElementById('hulp-laag');
  const sluit = () => laag.remove();
  document.getElementById('laag-sluit').addEventListener('click', sluit);
  laag.addEventListener('click', (e) => {
    if (e.target === laag) sluit();
  });
  document.getElementById('steekwoorden').addEventListener('click', (e) => {
    const knop = e.target.closest('.keuze');
    if (!knop) return;
    const w = knop.dataset.w;
    if (gekozen.has(w)) gekozen.delete(w);
    else gekozen.add(w);
    knop.classList.toggle('actief', gekozen.has(w));
  });
  document.getElementById('hulp-lengte').addEventListener('click', (e) => {
    const knop = e.target.closest('.keuze');
    if (!knop) return;
    lengte = knop.dataset.l;
    document.querySelectorAll('#hulp-lengte .keuze').forEach((k) => k.classList.toggle('actief', k === knop));
  });
  document.getElementById('hulp-open').addEventListener('click', () => {
    const opdracht = recensieOpdracht({
      boek,
      woorden: STEEKWOORDEN.filter((w) => gekozen.has(w)),
      eigen: document.getElementById('hulp-eigen').value,
      lengte,
    });
    // Eerst openen (iOS wil dat direct na de tik), daarna kopiëren als reserve.
    window.open(claudeAdres(opdracht), '_blank', 'noopener');
    navigator.clipboard?.writeText(opdracht).catch(() => {});
  });
  document.getElementById('hulp-plak').addEventListener('click', async () => {
    let tekst = '';
    try {
      tekst = (await navigator.clipboard.readText()).trim();
    } catch {
      // Geen toestemming of niet mogelijk: dan zelf plakken.
    }
    sluit();
    if (!tekst) {
      document.getElementById('recensie')?.focus();
      melding('Plak de tekst zelf in het vak Recensie');
      return;
    }
    await plakTerug(tekst);
    melding('Recensie geplakt en bewaard');
  });
}

// --- Cover kiezen ---

async function toonCoverKeuze(boek, bewaar, klaar) {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="laag" id="cover-laag">
       <div class="laag-blad">
         <div class="laag-kop"><h2>Kies een cover</h2><button class="link-knop" id="laag-sluit">Sluiten</button></div>
         <div id="keuzes"><p class="bezig">Covers zoeken bij Google Books en Open Library…</p></div>
         <a class="tweede-knop" target="_blank" rel="noopener" href="${googleAfbeeldingenUrl(boek)}">Zelf zoeken op internet ↗</a>
         <button class="tweede-knop" id="cover-plak">Plak gekopieerde cover</button>
         <p class="zacht klein">Gevonden op internet? Houd het plaatje vast, kies <b>Kopieer</b>, kom terug en tik op <b>Plak gekopieerde cover</b>.</p>
       </div>
     </div>`
  );
  const laag = document.getElementById('cover-laag');
  const sluit = () => laag.remove();
  document.getElementById('laag-sluit').addEventListener('click', sluit);
  laag.addEventListener('click', (e) => e.target === laag && sluit());
  document.getElementById('cover-plak').addEventListener('click', async () => {
    const cover = await plakCover();
    if (!cover) return;
    await bewaar(cover);
    klaar();
    sluit();
    melding('Cover bewaard');
  });

  const urls = (await zoekCoverKeuzes(boek)).map(veiligeUrl).filter(Boolean);
  // Intussen gesloten (of een nieuwe keuze geopend)? Dan niets meer doen.
  if (!laag.isConnected) return;
  const vak = laag.querySelector('#keuzes');
  if (!urls.length) {
    vak.innerHTML = '<p class="leeg">Geen covers gevonden voor dit boek. Probeer zelf te zoeken, of maak een eigen foto.</p>';
    return;
  }
  vak.innerHTML = `<div class="keuze-raster">${urls
    .map((u, i) => `<button class="keuze-cover" data-i="${i}"><img src="${veilig(u)}" alt="" loading="lazy" data-bij-fout="weg" /></button>`)
    .join('')}</div>`;
  vak.addEventListener('click', async (e) => {
    const knop = e.target.closest('.keuze-cover');
    if (!knop) return;
    knop.classList.add('gekozen');
    await bewaar(await bewaarbareCover(urls[Number(knop.dataset.i)]));
    klaar();
    sluit();
    melding('Cover bewaard');
  });
}

// Leest een gekopieerde cover uit het klembord, met een duidelijke melding als dat niet lukt.
async function plakCover() {
  try {
    const cover = await coverUitKlembord();
    if (cover.cover) return cover;
    const soorten = [...new Set(cover.gevonden)].join(', ') || 'niets';
    melding(`Geen plaatje in het klembord (wel: ${soorten}). Gebruik Foto: bewaar de cover eerst in Foto's.`);
  } catch {
    melding('Plakken lukt niet. Houd het plaatje vast en kies Kopieer, of gebruik Eigen foto.');
  }
  return null;
}

// Wat komt er mee als je naar een andere telefoon gaat? Covers die alleen een internetadres
// hebben, gaan als adres mee; die kunnen hier alsnog als plaatje worden vastgelegd.
async function toonVerhuis() {
  const vak = document.getElementById('verhuis');
  if (!vak) return;
  const st = await coverStand();
  if (!st.totaal || !document.body.contains(vak)) return;
  const n = (x, een, meer) => `${x} ${x === 1 ? een : meer}`;
  vak.innerHTML = `
    <p class="label">Wat er in je backup zit</p>
    <p class="zacht">${n(st.totaal, 'boek', 'boeken')} met al je sterren, leesdata, recensies en categorieën. Covers: ${st.plaatje} als plaatje${
      st.internet ? `, ${st.internet} alleen als internetadres` : ''
    }${st.geen ? `, ${st.geen} zonder cover` : ''}. Ook je profiel, profielfoto, reacties op tips en je keuzes in de lijst.</p>
    ${
      st.internet
        ? `<p class="zacht">Covers met alleen een internetadres komen op een nieuwe telefoon opnieuw van internet. Leg ze vast als plaatje, dan zitten ze echt in je backup.</p>
           <button class="tweede-knop" id="leg-vast">Covers als plaatje vastleggen (${st.internet})</button>
           <p class="zacht" id="leg-vast-stand"></p>`
        : st.plaatje
          ? '<p class="zacht">Alle covers zitten als plaatje in je backup.</p>'
          : ''
    }`;
  document.getElementById('leg-vast')?.addEventListener('click', async (e) => {
    const knop = e.currentTarget;
    const stand = document.getElementById('leg-vast-stand');
    knop.disabled = true;
    const { gelukt, over } = await legCoversVast(({ klaar, totaal }) => {
      knop.textContent = `Bezig… ${klaar} van ${totaal}`;
    });
    knop.remove();
    const nu = await coverStand();
    const nalopen = document.getElementById('covers-nalopen');
    if (nalopen) {
      nalopen.hidden = !(nu.geen + nu.internet);
      nalopen.textContent = `Covers zelf nalopen (${nu.geen + nu.internet})`;
    }
    stand.innerHTML = over
      ? `${n(gelukt, 'cover', 'covers')} vastgelegd. ${n(over, 'cover kon', 'covers konden')} niet automatisch: <a href="#/covers">leg die zelf vast</a> (houd de cover vast, kies Kopieer en tik op Plak).`
      : `Klaar: ${n(gelukt, 'cover', 'covers')} vastgelegd. Maak nu een nieuwe backup.`;
  });
}

// --- Covers nalopen: alle boeken zonder cover op een rij ---

async function toonCoversNalopen() {
  const nr = schermNr;
  ruimCoversOp();
  const opNaam = (a, b) => achternaam(a).localeCompare(achternaam(b), 'nl') || a.titel.localeCompare(b.titel, 'nl');
  const alle = await alleBoeken();
  const zonder = alle.filter((b) => !(b.cover instanceof Blob) && !b.coverUrl).sort(opNaam);
  const internet = alle.filter((b) => !(b.cover instanceof Blob) && b.coverUrl).sort(opNaam);
  if (nr !== schermNr) return;
  const regel = (b, metCover) => `
    <li class="nalopen-regel" data-id="${b.id}">
      <div class="cover-vak">${metCover ? `<img class="cover-klein vasthouden" src="${veilig(veiligeUrl(b.coverUrl))}" alt="Cover van ${veilig(b.titel)}" data-letter="${veilig(b.titel.charAt(0))}" data-bij-fout="letter" />` : coverHtml(b, 'cover-klein')}</div>
      <div class="boek-tekst"><strong>${veilig(b.titel)}</strong><span>${veilig(auteurTekst(b))}</span></div>
      <div class="nalopen-knoppen">
        ${metCover ? '' : `<a class="link-knop" href="${googleAfbeeldingenUrl(b)}" target="_blank" rel="noopener">Zoek ↗</a>`}
        <button class="keuze" data-plak="${b.id}">Plak</button>
        <label class="keuze">Foto<input type="file" accept="image/*" data-foto="${b.id}" hidden /></label>
      </div>
    </li>`;
  app.innerHTML = `
    <header class="kop">
      <a class="terug" href="#/instellingen">‹ Instellingen</a>
      <h1>Covers nalopen</h1>
    </header>
    <p class="zacht" id="nalopen-aantal"></p>
    ${
      zonder.length
        ? `<h2 class="stat-kop">Zonder cover</h2>
           <p class="zacht">Tik op <b>Zoek</b> en houd in Google het juiste plaatje vast. Kies <b>Kopieer</b> en tik hier op <b>Plak</b>, of kies <b>Voeg toe aan Foto's</b> en tik hier op <b>Foto</b>.</p>
           <ul class="lijst nalopen">${zonder.map((b) => regel(b, false)).join('')}</ul>`
        : ''
    }
    ${
      internet.length
        ? `<h2 class="stat-kop">Alleen via internet</h2>
           <p class="zacht">Deze covers staan nog niet als plaatje op je telefoon. Houd de cover hieronder vast en kies <b>Voeg toe aan Foto's</b>. Tik dan op <b>Foto</b> en kies hem. Dan zit hij in je backup.</p>
           <ul class="lijst nalopen">${internet.map((b) => regel(b, true)).join('')}</ul>`
        : ''
    }`;
  const zetAantal = () => {
    const over = document.querySelectorAll('.nalopen-regel:not(.klaar)').length;
    document.getElementById('nalopen-aantal').textContent = over
      ? `Nog ${over === 1 ? '1 boek' : `${over} boeken`} om na te lopen.`
      : 'Alle covers staan als plaatje op je telefoon.';
  };
  zetAantal();
  const bewaarCover = async (li, id, cover) => {
    await boekBijwerken(id, cover);
    li.querySelector('.cover-vak').innerHTML = coverHtml(await haalBoek(id), 'cover-klein', lijstLinks);
    li.querySelector('.nalopen-knoppen').innerHTML = '<span class="keuze actief">✓</span>';
    li.classList.add('klaar');
    zetAantal();
    melding('Cover bewaard');
  };
  app.querySelectorAll('.nalopen').forEach((lijst) => {
    lijst.addEventListener('click', async (e) => {
      const knop = e.target.closest('[data-plak]');
      if (!knop) return;
      const cover = await plakCover();
      if (cover) await bewaarCover(knop.closest('li'), Number(knop.dataset.plak), cover);
    });
    lijst.addEventListener('change', async (e) => {
      const invoer = e.target.closest('[data-foto]');
      const bestand = invoer?.files?.[0];
      if (!bestand) return;
      await bewaarCover(invoer.closest('li'), Number(invoer.dataset.foto), { cover: await verkleinFoto(bestand), coverUrl: '' });
    });
  });
}

// --- Boek ---

async function toonBoek(id) {
  const nr = schermNr;
  ruimCoversOp();
  const boek = await haalBoek(id);
  if (nr !== schermNr) return;
  if (!boek) {
    location.hash = '#/';
    return;
  }

  const bewaar = async (wijzigingen) => {
    Object.assign(boek, wijzigingen);
    await boekBijwerken(id, wijzigingen);
  };

  app.innerHTML = `
    <header class="kop">
      <a class="terug" href="#/">‹ Boeken</a>
      <button class="link-knop deel-knop" id="deel" aria-label="Deel dit boek">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l4 4-1.4 1.4L13 6.8V15h-2V6.8L9.4 8.4 8 7zM5 11h3v2H7v6h10v-6h-1v-2h3v10H5z" /></svg>
        Deel
      </button>
    </header>
    <section class="bevestig">
      <div id="cover-vak">${coverHtml(boek, 'cover-groot')}</div>
      <div class="cover-knoppen">
        <button class="link-knop" id="cover-kiezen">Kies een cover</button>
        <label class="link-knop">Eigen foto<input type="file" accept="image/*" id="cover-foto" hidden /></label>
      </div>
      <h2>${veilig(boek.titel)}</h2>
      <p>${veilig(auteurTekst(boek))}</p>
      <p class="details">${[boek.uitgever, boek.jaar, boek.paginas && `${boek.paginas} blz.`, boek.isbn && `ISBN ${boek.isbn}`]
        .filter(Boolean)
        .map(veilig)
        .join(' · ')}</p>
      ${boek.opmerking ? `<p class="details">${veilig(boek.opmerking)}</p>` : ''}
      ${
        boek.synopsis
          ? `<p class="label">Over het boek</p>
             <div class="synopsis kort" id="synopsis">${synopsisHtml(boek.synopsis)}</div>
             <button class="link-knop meer" id="synopsis-meer">Lees meer</button>`
          : ''
      }

      <p class="label">Mijn oordeel</p>
      <div class="sterren" id="sterren" role="radiogroup" aria-label="Sterren"></div>

      <p class="label">Status</p>
      <div class="keuzes" id="statussen">
        ${STATUSSEN.map((s) => `<button class="keuze" data-s="${s}">${statusNaam(s)}</button>`).join('')}
      </div>

      <p class="label">Categorie</p>
      <div class="keuzes" id="categorieen">${categorieKnoppen()}</div>

      <p class="label">Kobo en boek</p>
      <div class="keuzes" id="bezit">
        ${Object.values(BEZIT).map((x) => `<button class="keuze${boek[x.veld] ? ' actief' : ''}" data-veld="${x.veld}">${x.naam}</button>`).join('')}
      </div>
      <div class="kobo-regel">
        <a class="link-knop" href="${koboZoekUrl(boek)}" target="_blank" rel="noopener">Zoek bij Kobo ↗</a>
      </div>

      <p class="label">Gelezen op</p>
      <ul class="leesdata" id="leesdata"></ul>
      <div class="datum-toevoegen">
        <input type="date" id="nieuwe-datum" value="${vandaag()}" max="${vandaag()}" />
        <button class="keuze" id="datum-knop">Toevoegen</button>
      </div>

      <p class="label">Recensie</p>
      <textarea id="recensie" rows="6" placeholder="Wat vond je ervan?">${veilig(boek.recensie)}</textarea>
      <div class="recensie-regel">
        <button class="link-knop" id="recensie-hulp">✎ Hulp van Claude</button>
        <p class="opgeslagen" id="opgeslagen">&nbsp;</p>
      </div>

      <button class="verwijder" id="verwijder">Boek verwijderen</button>
    </section>
  `;

  document.getElementById('deel').addEventListener('click', async () => {
    // De recensie zoals hij nu in het vak staat, ook als hij nog niet bewaard is.
    const tekst = deelTekst(boek, document.getElementById('recensie').value);
    try {
      if ((await deelBoek(tekst)) === 'gekopieerd') melding('Tekst gekopieerd. Plak hem waar je wilt.');
    } catch {
      melding('Delen lukt hier niet');
    }
  });

  const synopsisVak = document.getElementById('synopsis');
  const meer = document.getElementById('synopsis-meer');
  if (synopsisVak) {
    // Alleen 'Lees meer' tonen als de tekst echt langer is dan het stukje dat je ziet.
    if (synopsisVak.scrollHeight <= synopsisVak.clientHeight + 4) meer.remove();
    else
      meer.addEventListener('click', () => {
        synopsisVak.classList.remove('kort');
        meer.remove();
      });
  }

  const toonNieuweCover = () => {
    document.getElementById('cover-vak').innerHTML = coverHtml(boek, 'cover-groot');
  };
  document.getElementById('cover-kiezen').addEventListener('click', () => toonCoverKeuze(boek, bewaar, toonNieuweCover));
  document.getElementById('cover-foto').addEventListener('change', async (e) => {
    const bestand = e.target.files?.[0];
    if (!bestand) return;
    const cover = await verkleinFoto(bestand);
    await bewaar({ cover, coverUrl: '' });
    toonNieuweCover();
    melding('Cover bewaard');
  });

  const tekenSterren = () => {
    document.getElementById('sterren').innerHTML = [1, 2, 3, 4, 5]
      .map(
        (n) =>
          `<button class="ster${boek.sterren >= n ? ' aan' : ''}" data-n="${n}" role="radio" aria-checked="${boek.sterren === n}" aria-label="${n} ${n === 1 ? 'ster' : 'sterren'}">★</button>`
      )
      .join('');
  };
  tekenSterren();
  document.getElementById('sterren').addEventListener('click', async (e) => {
    const knop = e.target.closest('.ster');
    if (!knop) return;
    const n = Number(knop.dataset.n);
    // Nog een keer op dezelfde ster tikken haalt het oordeel weg.
    await bewaar({ sterren: boek.sterren === n ? null : n });
    tekenSterren();
  });

  const tekenStatus = () =>
    document.querySelectorAll('#statussen .keuze').forEach((k) => k.classList.toggle('actief', k.dataset.s === boek.status));
  tekenStatus();
  document.getElementById('statussen').addEventListener('click', async (e) => {
    const knop = e.target.closest('.keuze');
    if (!knop) return;
    await bewaar({ status: knop.dataset.s });
    tekenStatus();
  });

  const tekenCategorie = () =>
    document.querySelectorAll('#categorieen .keuze').forEach((k) => k.classList.toggle('actief', k.dataset.c === boek.categorie));
  tekenCategorie();
  document.getElementById('categorieen').addEventListener('click', async (e) => {
    const knop = e.target.closest('.keuze');
    if (!knop) return;
    // Nog een keer op dezelfde tikken haalt de categorie weg.
    await bewaar({ categorie: boek.categorie === knop.dataset.c ? '' : knop.dataset.c });
    tekenCategorie();
  });

  // Wacht op Kobo Plus, Gedownload in Kobo, Papieren boek gekocht: elk aan of uit.
  // Gedownload betekent dat het wachten voorbij is, dus dat label gaat dan uit.
  document.getElementById('bezit').addEventListener('click', async (e) => {
    const knop = e.target.closest('[data-veld]');
    if (!knop) return;
    const veld = knop.dataset.veld;
    const wijziging = { [veld]: !boek[veld] };
    if (veld === 'koboGedownload' && wijziging.koboGedownload) wijziging.koboWacht = false;
    if (veld === 'koboWacht' && wijziging.koboWacht) wijziging.koboGedownload = false;
    await bewaar(wijziging);
    document.querySelectorAll('#bezit .keuze').forEach((k) => k.classList.toggle('actief', Boolean(boek[k.dataset.veld])));
  });

  const tekenLeesdata = () => {
    const lijst = document.getElementById('leesdata');
    lijst.innerHTML = boek.leesdata.length
      ? boek.leesdata
          .map(
            (d, i) => `<li><span>${datumTekst(d)}</span><button class="link-knop weg" data-i="${i}" aria-label="Datum weghalen">Weghalen</button></li>`
          )
          .join('')
      : '<li class="zacht">Nog geen datum</li>';
  };
  tekenLeesdata();
  document.getElementById('datum-knop').addEventListener('click', async () => {
    const datum = document.getElementById('nieuwe-datum').value;
    if (!datum) return;
    const leesdata = [...boek.leesdata, datum].sort();
    // Een leesdatum betekent dat het boek uit is.
    await bewaar({ leesdata, status: 'Gelezen' });
    tekenLeesdata();
    tekenStatus();
    melding(leesdata.length > 1 ? `${leesdata.length}e keer gelezen` : 'Leesdatum toegevoegd');
  });
  document.getElementById('leesdata').addEventListener('click', async (e) => {
    const knop = e.target.closest('.weg');
    if (!knop) return;
    const leesdata = boek.leesdata.filter((_, i) => i !== Number(knop.dataset.i));
    await bewaar({ leesdata });
    tekenLeesdata();
  });

  // Recensie bewaart vanzelf, kort nadat je stopt met typen.
  const recensie = document.getElementById('recensie');
  const opgeslagen = document.getElementById('opgeslagen');
  let timer;
  const bewaarRecensie = async () => {
    clearTimeout(timer);
    if (recensie.value === boek.recensie) return;
    await bewaar({ recensie: recensie.value });
    opgeslagen.textContent = 'Opgeslagen';
  };
  recensie.addEventListener('input', () => {
    opgeslagen.innerHTML = '&nbsp;';
    clearTimeout(timer);
    timer = setTimeout(bewaarRecensie, 800);
  });
  recensie.addEventListener('blur', bewaarRecensie);
  toonBoek.bewaarOpenstaand = bewaarRecensie;

  document.getElementById('recensie-hulp').addEventListener('click', async () => {
    await bewaarRecensie();
    toonRecensieHulp(boek, async (tekst) => {
      recensie.value = tekst;
      await bewaarRecensie();
    });
  });

  document.getElementById('verwijder').addEventListener('click', async () => {
    if (!confirm(`"${boek.titel}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    await boekVerwijderen(id);
    location.hash = '#/';
    melding('Verwijderd');
  });
}

// --- Navigatie ---

// Waar je op elke pagina was, zodat 'terug' je daar weer neerzet.
const scrollPlekken = {};
let vorigeHash = location.hash || '#/';

// Elk nieuw scherm krijgt een volgnummer; een trager, ouder scherm tekent dan niet meer.
let schermNr = 0;

async function route({ naarBoven = false } = {}) {
  schermNr += 1;
  scrollPlekken[vorigeHash] = window.scrollY;
  vorigeHash = location.hash || '#/';
  sluitScanner();
  // Een recensie die nog niet bewaard is, eerst opslaan.
  if (toonBoek.bewaarOpenstaand) {
    await toonBoek.bewaarOpenstaand();
    toonBoek.bewaarOpenstaand = null;
  }
  window.scrollTo(0, 0);
  const boekId = location.hash.match(/^#\/boek\/(\d+)$/);
  const plek = { '#/toevoegen': 'toevoegen', '#/instellingen': 'instellingen', '#/covers': 'instellingen', '#/zoek': 'zoek' }[location.hash] || 'lijst';
  document.querySelectorAll('.balk a').forEach((a) => a.classList.toggle('actief', a.dataset.plek === plek));
  if (location.hash === '#/toevoegen') toonToevoegen();
  else if (location.hash === '#/instellingen') toonInstellingen();
  else if (location.hash === '#/profiel') toonProfiel();
  else if (location.hash === '#/covers') toonCoversNalopen();
  else if (boekId) toonBoek(Number(boekId[1]));
  else if (location.hash === '#/zoek') {
    // Zoeken = de lijst met de cursor in het zoekveld.
    await toonLijst();
    const veld = document.getElementById('lijst-zoek');
    veld?.focus({ preventScroll: true });
    document.getElementById('lijst-kop')?.scrollIntoView();
  } else {
    const nr = schermNr;
    await toonLijst();
    // Terug op het startscherm: verder waar je was. Onderin op Boeken tikken: naar boven.
    if (nr === schermNr && !naarBoven && scrollPlekken['#/']) window.scrollTo(0, scrollPlekken['#/']);
  }
}

window.addEventListener('hashchange', route);

// Gaat de app naar de achtergrond, dan een half getypte recensie of profieltekst meteen bewaren.
const bewaarNu = () => toonBoek.bewaarOpenstaand?.();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') bewaarNu();
});
window.addEventListener('pagehide', bewaarNu);

// Tik op de plek waar je al bent (bijvoorbeeld Toevoegen vanaf een voorstel): opnieuw beginnen.
document.querySelector('.balk').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (a && a.getAttribute('href') === (location.hash || '#/')) {
    e.preventDefault();
    if (a.dataset.plek === 'toevoegen') {
      laatsteZoekterm = '';
      laatsteResultaten = [];
    }
    route({ naarBoven: true });
  }
});
route();
