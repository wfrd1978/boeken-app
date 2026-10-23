import './style.css';
import {
  alleBoeken,
  boekToevoegen,
  haalBoek,
  boekBijwerken,
  boekVerwijderen,
  boekTerugzetten,
  vraagBlijvendeOpslag,
  vulWerkenAan,
  STATUSSEN,
} from './db.js';
import { zoekBoeken, zoekCover, verkleinFoto, zoekWerk } from './zoeken.js';
import { kaal, achternaam, vindDubbel } from './dubbel.js';
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

const app = document.getElementById('app');

// Service worker: zorgt dat de app ook zonder internet opent.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}

vraagBlijvendeOpslag();
vulWerkenAan(zoekWerk);

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
  if (src) return `<img class="${klasse}" src="${veilig(src)}" alt="" loading="lazy" />`;
  return `<div class="${klasse} geen-cover">${veilig((boek.titel || '?').charAt(0))}</div>`;
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

// Zoekterm en sortering blijven bewaard als je een boek opent en terugkomt.
let zoekterm = '';
let sortering = 'toegevoegd';
try {
  sortering = localStorage.getItem('sortering') || sortering;
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
  if (!woorden.length) return boeken;
  return boeken.filter((b) => {
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
        <strong>${veilig(b.titel)}</strong>
        <span>${veilig(auteurTekst(b))}</span>
        <span class="regel">
          <span class="status status-${STATUSSEN.indexOf(b.status)}">${veilig(b.status)}</span>
          ${b.sterren ? `<span class="sterren-klein" aria-label="${b.sterren} sterren">${sterrenTekst(b.sterren)}</span>` : ''}
        </span>
      </div>
    </a></li>`;
}

// Naar links vegen toont een rode knop, zoals in Apple Mail.
const VEEG_BREEDTE = 96;

function maakVeegbaar(lijst, onVerwijder) {
  let open = null;
  let start = null;

  const zet = (li, x, animeer) => {
    const a = li.querySelector('.boek');
    a.style.transition = animeer ? 'transform 0.2s ease' : 'none';
    a.style.transform = x ? `translateX(${x}px)` : '';
  };
  const sluit = () => {
    if (open) zet(open, 0, true);
    open = null;
  };

  lijst.addEventListener('touchstart', (e) => {
    const li = e.target.closest('.veeg');
    if (!li || e.target.closest('.veeg-actie')) return;
    if (open && open !== li) sluit();
    const t = e.touches[0];
    start = { li, x: t.clientX, y: t.clientY, basis: open === li ? -VEEG_BREEDTE : 0, richting: null };
  }, { passive: true });

  lijst.addEventListener('touchmove', (e) => {
    if (!start) return;
    const t = e.touches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Pas beslissen na een paar pixels: vegen opzij of gewoon scrollen.
    if (!start.richting && Math.abs(dx) + Math.abs(dy) > 12) {
      start.richting = Math.abs(dx) > Math.abs(dy) ? 'opzij' : 'scroll';
    }
    if (start.richting !== 'opzij') return;
    e.preventDefault();
    const x = Math.max(-VEEG_BREEDTE * 1.3, Math.min(0, start.basis + dx));
    zet(start.li, x, false);
  }, { passive: false });

  lijst.addEventListener('touchend', (e) => {
    if (!start) return;
    if (start.richting === 'opzij') {
      const x = start.basis + (e.changedTouches[0].clientX - start.x);
      if (x < -VEEG_BREEDTE / 2) {
        zet(start.li, -VEEG_BREEDTE, true);
        open = start.li;
      } else {
        zet(start.li, 0, true);
        if (open === start.li) open = null;
      }
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
    <header class="kop">
      <h1>Boeken</h1>
      <span class="aantal">${boeken.length === 1 ? '1 boek' : `${boeken.length} boeken`}</span>
      <a class="instellingen-link" href="#/instellingen">Instellingen</a>
    </header>
    ${boeken.length && moetHerinneren() ? herinneringHtml() : ''}
    ${
      boeken.length
        ? `<div class="lijst-bediening">
             <input id="lijst-zoek" type="search" placeholder="Zoek op titel, auteur of ISBN" value="${veilig(zoekterm)}" autocomplete="off" enterkeyhint="search" />
             <label class="sorteer">Sorteer
               <select id="sorteer">
                 ${Object.entries(SORTERINGEN)
                   .map(([k, v]) => `<option value="${k}"${k === sortering ? ' selected' : ''}>${v}</option>`)
                   .join('')}
               </select>
             </label>
           </div>
           <ul class="lijst" id="lijst"></ul>`
        : `<p class="leeg">Nog geen boeken.<br />Tik op <b>+</b> om je eerste boek toe te voegen.</p>`
    }
    <a class="plus" href="#/toevoegen" aria-label="Boek toevoegen">+</a>
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
      : `<li class="leeg">Geen boek gevonden voor "${veilig(zoekterm)}".</li>`;
  };
  teken();

  const zetAantal = () => {
    document.querySelector('.kop .aantal').textContent = boeken.length === 1 ? '1 boek' : `${boeken.length} boeken`;
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
    <form class="zoekbalk" id="zoekform">
      <input id="zoekveld" type="search" enterkeyhint="search" placeholder="Titel of auteur" value="${veilig(laatsteZoekterm)}" autocomplete="off" />
      <button type="submit">Zoek</button>
    </form>
    <div id="resultaten"></div>
  `;
  const veld = document.getElementById('zoekveld');
  document.getElementById('zoekform').addEventListener('submit', (e) => {
    e.preventDefault();
    veld.blur();
    zoek(veld.value.trim());
  });
  if (laatsteResultaten.length) toonResultaten(laatsteResultaten);
  else veld.focus();
}

async function zoek(tekst) {
  if (!tekst) return;
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
            ${vindDubbel(b, mijnBoeken) ? `<span class="al-in-lijst">Staat al in je lijst · ${veilig(vindDubbel(b, mijnBoeken).status)}</span>` : ''}
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
             <label>Auteur<input id="auteur" placeholder="Bijvoorbeeld Toon Tellegen" /></label>`
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
        ${STATUSSEN.map((s) => `<button class="keuze${s === status ? ' actief' : ''}" data-s="${s}">${s}</button>`).join('')}
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
      gegevens = { titel, auteurs: auteur ? [auteur] : [] };
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
    await boekToevoegen({ ...gegevens, ...cover, status, bron: 'getypt' });
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
      ${veilig(bestaand.titel)} · ${veilig(bestaand.status)}${oordeel}${gelezen}</p>
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

      <p class="label">Mijn oordeel</p>
      <div class="sterren" id="sterren" role="radiogroup" aria-label="Sterren"></div>

      <p class="label">Status</p>
      <div class="keuzes" id="statussen">
        ${STATUSSEN.map((s) => `<button class="keuze" data-s="${s}">${s}</button>`).join('')}
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
  // Een recensie die nog niet bewaard is, eerst opslaan.
  if (toonBoek.bewaarOpenstaand) {
    await toonBoek.bewaarOpenstaand();
    toonBoek.bewaarOpenstaand = null;
  }
  window.scrollTo(0, 0);
  const boekId = location.hash.match(/^#\/boek\/(\d+)$/);
  if (location.hash === '#/toevoegen') toonToevoegen();
  else if (location.hash === '#/instellingen') toonInstellingen();
  else if (boekId) toonBoek(Number(boekId[1]));
  else toonLijst();
}

window.addEventListener('hashchange', route);
route();
