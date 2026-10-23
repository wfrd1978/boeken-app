import './style.css';
import {
  alleBoeken,
  boekToevoegen,
  haalBoek,
  boekBijwerken,
  boekVerwijderen,
  boekTerugzetten,
  boekenImporteren,
  sterrenAanvullen,
  vraagBlijvendeOpslag,
  vulWerkenAan,
  zetKoboOm,
  STATUSSEN,
  statusNaam,
} from './db.js';
import { zoekBoeken, zoekCover, verkleinFoto, zoekWerk, zoekOpIsbn, testBronnen, GoogleWeigert } from './zoeken.js';
import { startScanner, geldigIsbn13 } from './scanner.js';
import { kaal, achternaam, vindDubbel } from './dubbel.js';
import { koboZoekUrl } from './kobo.js';
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
import { verrijkAlles, opVoortgang, aantalTeVerrijken, zonderCoverOpnieuw, coverTelling } from './verrijken.js';

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
opVoortgang(({ klaar, totaal, gestopt }) => {
  const el = document.getElementById('verrijk-status');
  if (el) {
    el.textContent =
      klaar < totaal
        ? gestopt
          ? `Covers ophalen gepauzeerd (${klaar} van ${totaal}): een bron weigert even, bijvoorbeeld door de daglimiet van Google. Het gaat later vanzelf verder.`
          : `Covers en gegevens ophalen: ${klaar} van ${totaal}…`
        : '';
    el.hidden = !el.textContent;
  }
  if (klaar === totaal && totaal > 0) {
    melding('Alle covers zijn opgehaald');
    // Lijst bijwerken als die open staat en er niet getypt wordt.
    if (location.hash === '' || location.hash === '#/') {
      if (document.activeElement?.id !== 'lijst-zoek') {
        const y = window.scrollY;
        toonLijst().then(() => window.scrollTo(0, y));
      }
    }
  }
});
window.addEventListener('online', verrijkAlles);

// --- Hulpjes ---

function veilig(tekst) {
  const div = document.createElement('div');
  div.textContent = tekst ?? '';
  return div.innerHTML;
}

function auteurTekst(boek) {
  return boek.auteurs?.length ? boek.auteurs.join(', ') : 'Onbekende auteur';
}

// Cover als <img>, of een rustig vlak met de beginletter als er geen cover is.
const coverLinks = new Set();
function coverHtml(boek, klasse) {
  let src = boek.coverUrl;
  if (boek.cover instanceof Blob) {
    src = URL.createObjectURL(boek.cover);
    coverLinks.add(src);
  }
  const letter = veilig((boek.titel || '?').charAt(0));
  // Laadt een cover niet (bijvoorbeeld offline bij een Google-cover), dan het vlak met de beginletter.
  if (src) {
    return `<img class="${klasse}" src="${veilig(src)}" alt="" loading="lazy" data-letter="${letter}" onerror="geenCover(this)" />`;
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

window.geenCover = (img) => {
  const vlak = document.createElement('div');
  vlak.className = `${img.className} geen-cover`;
  vlak.textContent = img.dataset.letter;
  img.replaceWith(vlak);
};

function ruimCoversOp() {
  coverLinks.forEach((url) => URL.revokeObjectURL(url));
  coverLinks.clear();
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

// Zoekterm, tab en sortering blijven bewaard als je een boek opent en terugkomt.
let zoekterm = '';
let sortering = 'toegevoegd';
let tab = 'Alles';
try {
  sortering = localStorage.getItem('sortering') || sortering;
  tab = localStorage.getItem('tab') || tab;
} catch {
  // Zonder opslag gewoon de standaard.
}

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
  const inTab = tab === 'Alles' ? boeken : boeken.filter((b) => b.status === tab);
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
      ${coverHtml(b, 'cover-klein')}
      <div class="boek-tekst">
        <span class="regel">
          <span class="status status-${STATUSSEN.indexOf(b.status)}">${veilig(statusNaam(b.status))}</span>
          ${b.koboWacht ? '<span class="status kobo">· Wacht op Kobo Plus</span>' : ''}
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

async function toonLijst() {
  ruimCoversOp();
  const boeken = await alleBoeken();
  app.innerHTML = `
    <header class="woordmerk"><h1>Boeken</h1></header>
    ${
      boeken.length
        ? `<nav class="tabs" id="tabs">${TABS.map(
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
    ruimCoversOp();
    const zichtbaar = sorteer(filter(boeken));
    document.getElementById('lijst').innerHTML = zichtbaar.length
      ? zichtbaar.map(boekRegel).join('')
      : `<li class="leeg">${zoekterm ? `Geen boek gevonden voor "${veilig(zoekterm)}".` : `Nog geen boeken bij ${veilig(statusNaam(tab))}.`}</li>`;
    document.getElementById('aantal').textContent = zichtbaar.length === 1 ? '1 boek' : `${zichtbaar.length} boeken`;
  };

  document.getElementById('tabs').addEventListener('click', (e) => {
    const knop = e.target.closest('.tab');
    if (!knop) return;
    tab = knop.dataset.tab;
    try {
      localStorage.setItem('tab', tab);
    } catch {
      // Niet erg.
    }
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('actief', t === knop));
    teken();
  });
  teken();

  const zetAantal = () => {
    const zichtbaar = filter(boeken).length;
    document.getElementById('aantal').textContent = zichtbaar === 1 ? '1 boek' : `${zichtbaar} boeken`;
  };
  maakVeegbaar(document.getElementById('lijst'), async (li) => {
    const id = Number(li.dataset.id);
    const boek = boeken.find((b) => b.id === id);
    await boekVerwijderen(id);
    boeken.splice(boeken.indexOf(boek), 1);
    li.classList.add('weg');
    setTimeout(() => li.remove(), 250);
    zetAantal();
    melding(`"${boek.titel}" verwijderd`, {
      tekst: 'Ongedaan maken',
      actie: async () => {
        await boekTerugzetten(boek);
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

// Wie al boeken heeft, maakt eerst een backup (vandaag of gisteren) voor een import.
function backupNodig(aantal) {
  const dagen = dagenSindsBackup();
  return aantal > 0 && (dagen === null || dagen > 1);
}

async function toonInstellingen() {
  ruimCoversOp();
  const aantal = (await alleBoeken()).length;
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
      <h2>Covers</h2>
      <p id="cover-telling" class="zacht">&nbsp;</p>
      <p class="verrijk-status" id="verrijk-status" hidden></p>
      <button class="tweede-knop" id="covers-opnieuw" hidden>Zoek opnieuw naar ontbrekende covers</button>
      <button class="link-knop" id="bronnen-test">Test de verbinding met de boekenbronnen</button>
      <p class="zacht" id="bronnen-uitslag"></p>
    </section>

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

  const telling = await coverTelling();
  const zonder = telling.totaal - telling.met;
  document.getElementById('cover-telling').textContent = telling.totaal
    ? `${telling.met} van de ${telling.totaal} boeken hebben een cover.`
    : 'Nog geen boeken.';
  const opnieuw = document.getElementById('covers-opnieuw');
  opnieuw.hidden = !zonder;
  opnieuw.textContent = `Zoek opnieuw naar ontbrekende covers (${zonder})`;
  opnieuw.addEventListener('click', async () => {
    opnieuw.disabled = true;
    const n = await zonderCoverOpnieuw();
    const el = document.getElementById('verrijk-status');
    el.textContent = `Bezig met ${n} boeken…`;
    el.hidden = false;
  });

  document.getElementById('bronnen-test').addEventListener('click', async () => {
    const uitslag = document.getElementById('bronnen-uitslag');
    uitslag.textContent = 'Testen…';
    const { openLibrary, google } = await testBronnen();
    const regel = (naam, r) =>
      r.ok ? `${naam}: werkt` : `${naam}: werkt niet${r.status === 429 ? ' (daglimiet bereikt)' : r.status ? ` (fout ${r.status})` : ' (geen verbinding)'}`;
    uitslag.textContent = `${regel('Open Library', openLibrary)}. ${regel('Google Books', google)}.`;
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
    const { toevoegen, bijwerken, overslaan } = plan;
    const n = toevoegen.length;
    const m = bijwerken.length;
    const boekTekst = (x) => (x === 1 ? '1 boek' : `${x} boeken`);
    const knopTekst = [n && `importeer ${boekTekst(n)}`, m && `vul sterren aan bij ${boekTekst(m)}`].filter(Boolean).join(' en ');
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
            ? `<details${n ? '' : ' open'}><summary><strong>Bij ${boekTekst(m)} die je al hebt, worden de sterren aangevuld</strong></summary>
                 <ul class="overslaan">${bijwerken
                   .map(({ boek, al }) => `<li>${veilig(al.titel)} <span class="zacht">→ ${sterrenTekst(boek.sterren)}</span></li>`)
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
        if (m) await sterrenAanvullen(bijwerken.map(({ boek, al }) => ({ id: al.id, sterren: boek.sterren })));
      } catch {
        vak.innerHTML = '<div class="waarschuwing"><p>Importeren is mislukt. Maak zo nodig je backup terug.</p></div>';
        return;
      }
      zoekterm = '';
      location.hash = '#/';
      melding([n && `${boekTekst(n)} toegevoegd`, m && `sterren bij ${boekTekst(m)}`].filter(Boolean).join(', '));
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
  `;
  document.getElementById('scan').addEventListener('click', toonScanner);
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

function sluitScanner() {
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
  try {
    stopCamera = await startScanner(document.getElementById('scan-video'), async (isbn) => {
      tekst.textContent = `ISBN ${isbn} gevonden. Gegevens ophalen…`;
      await zoekGescandBoek(isbn, 'scan');
      sluitScanner();
    });
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

async function zoek(tekst) {
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
    toonResultaten(laatsteResultaten);
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
            <span>${veilig(auteurTekst(b))}${b.jaar ? ` · ${b.jaar}` : ''}${b.taal ? ` · ${veilig(b.taal.toUpperCase())}` : ''}</span>
            ${vindDubbel(b, mijnBoeken) ? `<span class="al-in-lijst">Staat al in je lijst · ${veilig(statusNaam(vindDubbel(b, mijnBoeken).status))}</span>` : ''}
          </div>
        </button></li>`
        )
        .join('')}
    </ul>
    ${zelfInvullenKnop()}
  `;
  vak.querySelectorAll('.resultaat').forEach((knop) =>
    knop.addEventListener('click', () => toonBevestigen(resultaten[Number(knop.dataset.i)]))
  );
  koppelZelfInvullen();
}

async function toonBevestigen(boek) {
  ruimCoversOp();
  let status = 'Wil ik lezen';
  const mijnBoeken = await alleBoeken();
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
                 ? '<p class="details">Open Library kent dit ISBN niet, en Google Books gaf geen antwoord (mogelijk de daglimiet). Vul titel en auteur zelf in; cover en gegevens worden later aangevuld.</p>'
                 : boek.reden === 'onbekend'
                   ? '<p class="details">Dit ISBN is bij Open Library en Google Books niet bekend. Vul titel en auteur zelf in.</p>'
                   : ''
             }`
          : `${coverHtml(boek, 'cover-groot')}
             <h2>${veilig(boek.titel)}</h2>
             <p>${veilig(auteurTekst(boek))}</p>
             <p class="details">${[boek.jaar, boek.paginas && `${boek.paginas} blz.`, boek.isbn && `ISBN ${boek.isbn}`]
               .filter(Boolean)
               .map(veilig)
               .join(' · ')}</p>`
      }
      ${dubbel ? waarschuwingHtml(dubbel) : ''}
      <p class="label">Status</p>
      <div class="keuzes" id="statussen">
        ${STATUSSEN.map((s) => `<button class="keuze${s === status ? ' actief' : ''}" data-s="${s}">${statusNaam(s)}</button>`).join('')}
      </div>
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
    await boekToevoegen({ ...gegevens, ...cover, status, bron: boek.bron ?? 'getypt', verrijkt });
    if (!verrijkt) verrijkAlles();
    laatsteZoekterm = '';
    laatsteResultaten = [];
    location.hash = '#/';
    melding('Toegevoegd');
  });
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

// --- Boek ---

async function toonBoek(id) {
  ruimCoversOp();
  const boek = await haalBoek(id);
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
    </header>
    <section class="bevestig">
      <div id="cover-vak">${coverHtml(boek, 'cover-groot')}</div>
      <div class="cover-knoppen">
        ${boek.cover || boek.coverUrl ? '' : '<button class="link-knop" id="cover-zoeken">Cover zoeken</button>'}
        <label class="link-knop" id="foto-label">${boek.cover || boek.coverUrl ? 'Andere cover (foto)' : 'Eigen foto'}<input type="file" accept="image/*" id="cover-foto" hidden /></label>
      </div>
      <h2>${veilig(boek.titel)}</h2>
      <p>${veilig(auteurTekst(boek))}</p>
      <p class="details">${[boek.uitgever, boek.jaar, boek.paginas && `${boek.paginas} blz.`, boek.isbn && `ISBN ${boek.isbn}`]
        .filter(Boolean)
        .map(veilig)
        .join(' · ')}</p>
      ${boek.opmerking ? `<p class="details">${veilig(boek.opmerking)}</p>` : ''}

      <p class="label">Mijn oordeel</p>
      <div class="sterren" id="sterren" role="radiogroup" aria-label="Sterren"></div>

      <p class="label">Status</p>
      <div class="keuzes" id="statussen">
        ${STATUSSEN.map((s) => `<button class="keuze" data-s="${s}">${statusNaam(s)}</button>`).join('')}
      </div>

      <p class="label">Kobo</p>
      <div class="kobo-regel">
        <button class="keuze${boek.koboWacht ? ' actief' : ''}" id="kobo-wacht">Wacht op Kobo Plus</button>
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
      <p class="opgeslagen" id="opgeslagen">&nbsp;</p>

      <button class="verwijder" id="verwijder">Boek verwijderen</button>
    </section>
  `;

  const toonNieuweCover = () => {
    document.getElementById('cover-vak').innerHTML = coverHtml(boek, 'cover-groot');
    document.getElementById('cover-zoeken')?.remove();
    document.getElementById('foto-label').firstChild.textContent = 'Andere cover (foto)';
  };
  document.getElementById('cover-zoeken')?.addEventListener('click', async (e) => {
    const knop = e.currentTarget;
    knop.disabled = true;
    knop.textContent = 'Zoeken…';
    const gevonden = await zoekCover(boek);
    if (gevonden.cover || gevonden.coverUrl) {
      await bewaar(gevonden);
      toonNieuweCover();
      melding('Cover gevonden');
    } else {
      knop.disabled = false;
      knop.textContent = 'Cover zoeken';
      melding('Geen cover gevonden. Maak er zelf een foto van.');
    }
  });
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

  const koboKnop = document.getElementById('kobo-wacht');
  koboKnop.addEventListener('click', async () => {
    await bewaar({ koboWacht: !boek.koboWacht });
    koboKnop.classList.toggle('actief', boek.koboWacht);
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

  document.getElementById('verwijder').addEventListener('click', async () => {
    if (!confirm(`"${boek.titel}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
    await boekVerwijderen(id);
    location.hash = '#/';
    melding('Verwijderd');
  });
}

// --- Navigatie ---

async function route() {
  sluitScanner();
  // Een recensie die nog niet bewaard is, eerst opslaan.
  if (toonBoek.bewaarOpenstaand) {
    await toonBoek.bewaarOpenstaand();
    toonBoek.bewaarOpenstaand = null;
  }
  window.scrollTo(0, 0);
  const boekId = location.hash.match(/^#\/boek\/(\d+)$/);
  const plek = { '#/toevoegen': 'toevoegen', '#/instellingen': 'instellingen', '#/zoek': 'zoek' }[location.hash] || 'lijst';
  document.querySelectorAll('.balk a').forEach((a) => a.classList.toggle('actief', a.dataset.plek === plek));
  if (location.hash === '#/toevoegen') toonToevoegen();
  else if (location.hash === '#/instellingen') toonInstellingen();
  else if (boekId) toonBoek(Number(boekId[1]));
  else if (location.hash === '#/zoek') {
    // Zoeken = de lijst met de cursor in het zoekveld.
    await toonLijst();
    document.getElementById('lijst-zoek')?.focus();
  } else toonLijst();
}

window.addEventListener('hashchange', route);

// Tik op de plek waar je al bent (bijvoorbeeld Toevoegen vanaf een voorstel): opnieuw beginnen.
document.querySelector('.balk').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (a && a.getAttribute('href') === (location.hash || '#/')) {
    e.preventDefault();
    if (a.dataset.plek === 'toevoegen') {
      laatsteZoekterm = '';
      laatsteResultaten = [];
    }
    route();
  }
});
route();
