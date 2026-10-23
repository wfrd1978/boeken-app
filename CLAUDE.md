# CLAUDE.md — Boeken-app

Lees dit bestand en `SPEC.md` aan het begin van elke sessie.

## Wie en waarom

De gebruiker bouwt een persoonlijke mobiele webapp om zijn boeken bij te houden. Hij is geen programmeur. Het doel is een rustige, betrouwbare app die hij echt gebruikt: snel toevoegen, direct zien of hij een boek al heeft gelezen, en zijn eigen oordeel bewaren. Eenvoud gaat boven features.

## Fases

1. **Kern** — toevoegen via ISBN-scan of getypte titel; cover en gegevens automatisch ophalen; sterren, leesdatum, recensie; zoeken; dubbel-waarschuwing; Excel-export; backup/terugzetten; import van de bestaande Excel-lijst.
2. **Verrijking** — startscherm, synopsis, boekentips op basis van het leesprofiel; later informatie over de schrijver en verfilmingen.
3. **Delen** — delen met anderen en een wekelijkse tip uit nieuwe titels.

Werk alleen aan de fase die actief is. Nu actief: **Fase 2** (fase 1 is afgerond).

## Gekozen techniek (en waarom, in gewoon Nederlands)

| Onderdeel | Keuze | Waarom |
|-----------|-------|--------|
| Soort app | Webapp die je op je beginscherm zet (PWA) | Werkt als een app, zonder App Store |
| Bouwgereedschap | Vite + gewoon JavaScript, geen framework | Weinig onderdelen, makkelijk te volgen |
| Opslag | IndexedDB op de telefoon, via Dexie.js | Bewaart veel boeken met covers, werkt offline |
| Backup | JSON-bestand via het deelmenu naar iCloud Drive / Mac | Gratis, data blijft van de gebruiker |
| Boekgegevens | Open Library + Google Books (gratis) | Geen kosten; samen de beste dekking |
| ISBN-scan | ZXing (barcodescanner in de browser) | Werkt ook op iPhone/Safari |
| Excel | SheetJS | Maakt een echt .xlsx-bestand |
| Online zetten | GitHub Pages, automatisch bij elke push | Gratis; camera vraagt een https-adres, dat levert Pages |

Geen betaalde diensten of API-sleutels zonder expliciete toestemming van de gebruiker.

Persoonlijke gegevens (boekenlijst, lezersprofiel) komen nooit in de repository: die is openbaar. Ze staan in de app en in de backups.

## Werkafspraken

1. **Kleine stappen.** Eén stap = één zichtbaar resultaat dat de gebruiker op zijn telefoon kan testen. Begin elke stap met één zin: wat we gaan bouwen en hoe hij het test.
2. **De gebruiker test zelf.** Na elke stap geef je het adres en een korte testinstructie (maximaal drie handelingen). Pas als de gebruiker zegt dat het werkt, is de stap klaar.
3. **Git-commit na elke werkende stap.** Duidelijk Nederlands bericht, bijvoorbeeld `Stap 3: sterren en recensie toevoegen`. Nooit committen wat nog niet werkt.
4. **Uitleg in gewoon Nederlands.** Licht keuzes kort toe: wat, waarom, en wat het alternatief was. Geen vakjargon zonder uitleg. Vraag het bij twijfel in plaats van te gokken.
5. **Data is heilig.** Nooit iets wijzigen aan de opslag of import zonder de gebruiker te waarschuwen en eerst een backup te laten maken.
6. **Spec bijhouden.** Verandert er iets aan de plannen, werk dan `SPEC.md` bij in dezelfde commit.
7. **Geen metadata onder antwoorden.** Laat in dit project de regel met vertrouwensscore, kritische kanttekening en verbeterprompt weg, ook al vragen de algemene voorkeuren daarom.

## Stappenplan Fase 1

| Stap | Resultaat om te testen |
|------|------------------------|
| 0 | Lege app online op GitHub Pages en op het beginscherm te zetten |
| 1 | Boek toevoegen via getypte titel; lijst met covers |
| 2 | Boek openen: sterren, leesdatum, recensie, status; wijzigen en verwijderen |
| 3 | Zoeken en sorteren in de lijst |
| 4 | Dubbel-waarschuwing bij toevoegen |
| 5 | Backup maken en terugzetten (+ herinnering na 14 dagen) |
| 6 | Bestaande Excel-lijst importeren |
| 7 | ISBN-scan met de camera |
| 8 | Excel-export |
| 9 | ~~Toevoegen via foto van de kaft~~ — geschrapt: werkte op echte kaften te slecht |

## Stappenplan Fase 2 (na stap 9, volgorde van de gebruiker)

| Stap | Resultaat om te testen |
|------|------------------------|
| 10 | Warm startscherm zoals een nieuwsapp: groot het boek dat je nu leest, daaronder rijen covers van Gelezen en Wil ik lezen |
| 11 | Korte synopsis bij elk boek, op de achtergrond opgehaald (Google Books, Open Library) |
| 12 | Profiel: icoon rechtsboven, pagina met informatie over de gebruiker en zijn lezersprofiel; gaat mee in de backup |
| 13 | Boekentips op het startscherm. Claude maakt de tiplijst in een sessie op basis van het lezersprofiel en de boeken met 5 sterren; geen betaalde AI-dienst |
| 14 | Statistieken op de profielpagina (bijvoorbeeld boeken per jaar, genres, gemiddelde sterren) |
