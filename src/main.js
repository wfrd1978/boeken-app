import './style.css';
import { alleBoeken, boekToevoegen, vraagBlijvendeOpslag, STATUSSEN } from './db.js';
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
          <li class="boek">
            ${coverHtml(b, 'cover-klein')}
            <div class="boek-tekst">
              <strong>${veilig(b.titel)}</strong>
              <span>${veilig(auteurTekst(b))}</span>
              <span class="status status-${STATUSSEN.indexOf(b.status)}">${veilig(b.status)}</span>
            </div>
          </li>`
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
            <span>${veilig(auteurTekst(b))}${b.jaar ? ` · ${b.jaar}` : ''}</span>
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

// --- Navigatie ---

function route() {
  window.scrollTo(0, 0);
  if (location.hash === '#/toevoegen') toonToevoegen();
  else toonLijst();
}

window.addEventListener('hashchange', route);
route();
