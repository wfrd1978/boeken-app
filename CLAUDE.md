# CLAUDE.md — Boeken-app

Lees dit bestand en `SPEC.md` aan het begin van elke sessie.

## Wie en waarom

Wilfred bouwt een persoonlijke mobiele webapp om zijn boeken bij te houden. Hij is geen programmeur. Het doel is een rustige, betrouwbare app die hij echt gebruikt: snel toevoegen, direct zien of hij een boek al heeft gelezen, en zijn eigen oordeel bewaren. Eenvoud gaat boven features.

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
| Backup | JSON-bestand via het deelmenu naar iCloud Drive / Mac | Gratis, data blijft van Wilfred |
| Boekgegevens | Open Library + Google Books (gratis, met Wilfreds eigen Google-sleutel) | Geen kosten; samen de beste dekking. De sleutel is beperkt tot wfrd1978.github.io en de Books API |
| ISBN-scan | ZXing (barcodescanner in de browser) | Werkt ook op iPhone/Safari |
| Excel | SheetJS | Maakt een echt .xlsx-bestand |
| Online zetten | GitHub Pages, automatisch bij elke push | Gratis; camera vraagt een https-adres, dat levert Pages |

Geen betaalde diensten of API-sleutels zonder expliciete toestemming van Wilfred.

Persoonlijke gegevens (boekenlijst, lezersprofiel) komen nooit in de repository: die is openbaar. Ze staan in de app en in Wilfreds backups. Uitzondering met toestemming van Wilfred: de tiplijst (`tips.json`) staat wel online; de uitleg bij een tip is algemeen en verwijst niet naar zijn eigen boeken. Het lezersprofiel staat alleen in de opdracht van de wekelijkse taak (privé in zijn account).

## Werkafspraken

1. **Kleine stappen.** Eén stap = één zichtbaar resultaat dat Wilfred op zijn telefoon kan testen. Begin elke stap met één zin: wat we gaan bouwen en hoe hij het test.
2. **Wilfred test zelf.** Na elke stap geef je het adres en een korte testinstructie (maximaal drie handelingen). Pas als Wilfred zegt dat het werkt, is de stap klaar.
3. **Git-commit na elke werkende stap.** Duidelijk Nederlands bericht, bijvoorbeeld `Stap 3: sterren en recensie toevoegen`. Nooit committen wat nog niet werkt.
4. **Uitleg in gewoon Nederlands.** Licht keuzes kort toe: wat, waarom, en wat het alternatief was. Geen vakjargon zonder uitleg. Vraag het bij twijfel in plaats van te gokken.
5. **Data is heilig.** Nooit iets wijzigen aan de opslag of import zonder Wilfred te waarschuwen en eerst een backup te laten maken.
6. **Spec bijhouden.** Verandert er iets aan de plannen, werk dan `SPEC.md` bij in dezelfde commit.
7. **Geen metadata onder antwoorden.** Laat in dit project de regel met vertrouwensscore, kritische kanttekening en verbeterprompt weg, ook al vragen Wilfreds algemene voorkeuren daarom.

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

## Stappenplan Fase 2 (na stap 9, volgorde van Wilfred)

| Stap | Resultaat om te testen |
|------|------------------------|
| 10 | Warm startscherm zoals een nieuwsapp: groot het boek dat je nu leest, daaronder rijen covers van Gelezen en Wil ik lezen |
| 11 | Korte synopsis bij elk boek, op de achtergrond opgehaald (Google Books, Open Library) |
| 12 | Profiel: icoon rechtsboven, pagina met informatie over Wilfred en zijn lezersprofiel; gaat mee in de backup |
| 13 | Boekentips op het startscherm (rij 'Tips voor jou', met Wil ik lezen / Al gelezen / Niet voor mij). De app haalt `tips.json` op; Claude maakt de eerste ronde in een sessie. Daarna een wekelijkse geplande taak (Routine) die elke week nieuwe tips online zet; geen betaalde AI-dienst |
| 14 | Categorieën: elk boek in een categorie (bijvoorbeeld Thriller, Oorlog & geschiedenis, Sport & biografie, Humor, Journalistiek & samenleving, Geloof). Samen met Wilfred de indeling kiezen; Claude deelt zijn bestaande boeken in via een import, nieuwe boeken krijgen een voorstel |
| 15 | Statistieken op de profielpagina (bijvoorbeeld boeken per jaar, per categorie, gemiddelde sterren) |
| 16 | Zoeken/filteren op 'Wacht op Kobo Plus' (alle boeken met dat label in één overzicht) |
