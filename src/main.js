import './style.css';
import {
  alleBoeken,
  boekToevoegen,
  haalBoek,
  boekBijwerken,
  boekVerwijderen,
  vraagBlijvendeOpslag,
  STATUSSEN,
} from './db.js';
import { zoekBoeken, haalCover } from './zoeken.js';

const app = document.getElementById('app');

// Service worker: zorgt dat de app ook zonder internet opent.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  });
}

vraagBlijvendeOpslag();

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

function datumTekst(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function vandaag() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ruimCoversOp() {
  coverLinks.forEach((url) => URL.revokeObjectURL(url));
  coverLinks.clear();
}

function melding(tekst) {
  const el = document.getElementById('melding');
  el.textContent = tekst;
  el.classList.add('zichtbaar');
  clearTimeout(melding.timer);
  melding.timer = setTimeout(() => el.classList.remove('zichtbaar'), 2500);
}

// --- Lijst ---

async function toonLijst() {
  ruimCoversOp();
  const boeken = await alleBoeken();
  app.innerHTML = `
    <header class="kop">
      <h1>Boeken</h1>
      <span class="aantal">${boeken.length === 1 ? '1 boek' : `${boeken.length} boeken`}</span>
    </header>
    ${
      boeken.length
        ? `<ul class="lijst">${boeken
            .map(
              (b) => `
          <li><a class="boek" href="#/boek/${b.id}">
            ${coverHtml(b, 'cover-klein')}
            <div class="boek-tekst">
              <strong>${veilig(b.titel)}</strong>
              <span>${veilig(auteurTekst(b))}</span>
              <span class="regel">
                <span class="status status-${STATUSSEN.indexOf(b.status)}">${veilig(b.status)}</span>
                ${b.sterren ? `<span class="sterren-klein" aria-label="${b.sterren} sterren">${sterrenTekst(b.sterren)}</span>` : ''}
              </span>
            </div>
          </a></li>`
            )
            .join('')}</ul>`
        : `<p class="leeg">Nog geen boeken.<br />Tik op <b>+</b> om je eerste boek toe te voegen.</p>`
    }
    <a class="plus" href="#/toevoegen" aria-label="Boek toevoegen">+</a>
  `;
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

function toonResultaten(resultaten) {
  const vak = document.getElementById('resultaten');
  if (!vak) return;
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

function toonBevestigen(boek) {
  ruimCoversOp();
  let status = 'Wil ik lezen';
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
      <p class="label">Status</p>
      <div class="keuzes" id="statussen">
        ${STATUSSEN.map((s) => `<button class="keuze${s === status ? ' actief' : ''}" data-s="${s}">${s}</button>`).join('')}
      </div>
      <button class="hoofdknop" id="opslaan">Toevoegen</button>
    </section>
  `;

  document.getElementById('anders').addEventListener('click', () => toonToevoegen());
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
    }
    knop.disabled = true;
    knop.textContent = 'Bezig met opslaan…';
    const cover = await haalCover(gegevens.coverUrl);
    await boekToevoegen({ ...gegevens, cover, status, bron: 'getypt' });
    laatsteZoekterm = '';
    laatsteResultaten = [];
    location.hash = '#/';
    melding('Toegevoegd');
  });
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
      ${coverHtml(boek, 'cover-groot')}
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
  else if (boekId) toonBoek(Number(boekId[1]));
  else toonLijst();
}

window.addEventListener('hashchange', route);
route();
