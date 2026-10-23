# SPEC.md — Boeken-app

Dit document beschrijft wát de app doet. `CLAUDE.md` beschrijft hóé we werken. Verandert een plan, dan passen we dit bestand aan in dezelfde commit.

## Doel

Een persoonlijke boeken-app op de iPhone. Drie dingen moeten moeiteloos gaan:

1. Een boek snel toevoegen.
2. In één oogopslag zien of een boek al in de lijst staat en of het gelezen is.
3. Een eigen oordeel bewaren: sterren en een korte recensie.

Eenvoud gaat boven features. Alles werkt op het toestel zelf, ook zonder internet (behalve het ophalen van boekgegevens).

## Adres

https://wfrd1978.github.io/boeken-app/

## Wat we per boek bewaren

| Veld | Uitleg | Verplicht |
|------|--------|-----------|
| Titel | | ja |
| Auteur(s) | Eén of meer namen | nee |
| ISBN | 13 cijfers, of 10 bij oudere boeken | nee |
| Cover | Afbeelding, opgeslagen op het toestel zodat hij offline zichtbaar is | nee |
| Uitgever, jaar, aantal pagina's, taal | Automatisch opgehaald waar mogelijk | nee |
| Status | *Wil ik lezen*, *Bezig*, *Gelezen*, *Gestopt* | ja, standaard *Wil ik lezen* |
| Sterren | 1 t/m 5, alleen hele sterren | nee |
| Leesdata | Eén of meer datums waarop het boek uit was; herlezen voegt een datum toe | nee |
| Recensie | Vrije tekst | nee |
| Toegevoegd op | Automatisch | ja |
| Bron | Hoe het boek erin kwam: getypt, scan, foto, Excel-import | ja |

## Schermen

1. **Lijst** — alle boeken met cover, titel, auteur, status en sterren. Bovenin een zoekveld. Sorteren op: laatst toegevoegd (standaard), titel, auteur, laatste leesdatum, sterren.
2. **Toevoegen** — drie manieren: titel typen, ISBN scannen, foto van de kaft. Altijd eerst een voorstel tonen ("Bedoel je dit boek?") voordat het wordt opgeslagen.
3. **Boek** — alle gegevens; sterren, status, leesdata en recensie aanpassen; een leesdatum toevoegen bij herlezen; verwijderen (met bevestiging).
4. **Instellingen** — backup maken, backup terugzetten, Excel importeren, Excel-export.

## Gedrag

**Gegevens ophalen.** Eerst Open Library, daarna Google Books als aanvulling. Beide gratis, geen sleutel nodig. Lukt ophalen niet, dan kan Wilfred het boek gewoon met de hand invullen.

**Dubbel-waarschuwing.** Bij toevoegen kijkt de app of het boek er al staat: gelijk ISBN, of dezelfde titel en auteur (hoofdletters en leestekens maken niet uit). Dan verschijnt: "Dit boek staat al in je lijst (status: Gelezen, 4 sterren)". Wilfred kiest zelf of hij het toch toevoegt.

**Zoeken.** Zoekt in titel, auteur en ISBN, terwijl je typt.

**Backup.** Eén JSON-bestand met alle boeken én covers, te bewaren via het deelmenu (bijvoorbeeld in iCloud Drive). Terugzetten vervangt de huidige lijst pas na een duidelijke bevestiging. Is de laatste backup ouder dan 14 dagen, dan toont de app een rustige herinnering.

**Excel-import.** Wilfreds bestaande boekenlijst (.xlsx) inlezen. Welke kolom wat betekent (titel, auteur, sterren, datum, status …) stellen we vast aan de hand van zijn eigen bestand; bij twijfel vraagt de app het. Covers en ontbrekende gegevens worden daarna op de achtergrond opgehaald. Vooraf een backup; dubbele boeken worden overgeslagen en gemeld, en vooraf toont de app hoeveel boeken er worden toegevoegd.

**Excel-export.** Eén .xlsx-bestand met één regel per boek en de velden hierboven als kolommen (zonder cover). Bij herlezen staan alle leesdata in één cel.

## Buiten Fase 1

Synopsis, informatie over de schrijver, verfilmingen, boekentips (Fase 2). Delen met anderen en wekelijkse tips (Fase 3). Geen accounts, geen synchronisatie tussen apparaten, geen betaalde diensten.

## Besluiten

| Datum | Besluit |
|-------|---------|
| 2026-10-23 | Vier statussen: Wil ik lezen, Bezig, Gelezen, Gestopt |
| 2026-10-23 | Sterren: alleen hele sterren, 1 t/m 5 |
| 2026-10-23 | Herlezen vastleggen: per boek één of meer leesdata |
| 2026-10-23 | Bij toevoegen kies je meteen de status (standaard *Wil ik lezen*) |
| 2026-10-23 | Import uit Excel in plaats van Goodreads: Wilfreds lijst staat in Excel |
