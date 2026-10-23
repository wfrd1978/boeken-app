# SPEC.md — Boeken-app

Dit document beschrijft wát de app doet. `CLAUDE.md` beschrijft hóé we werken. Verandert een plan, dan passen we dit bestand aan in dezelfde commit.

Keuzes die nog niet door Wilfred bevestigd zijn, staan gemarkeerd met **(voorstel)**.

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
| Status | *Wil ik lezen*, *Bezig*, *Gelezen*, *Gestopt* **(voorstel)** | ja, standaard *Wil ik lezen* |
| Sterren | 1 t/m 5, hele sterren **(voorstel)** | nee |
| Leesdatum | Datum waarop het boek uit is | nee |
| Recensie | Vrije tekst | nee |
| Toegevoegd op | Automatisch | ja |
| Bron | Hoe het boek erin kwam: getypt, scan, foto, Goodreads | ja |

## Schermen

1. **Lijst** — alle boeken met cover, titel, auteur, status en sterren. Bovenin een zoekveld. Sorteren op: laatst toegevoegd (standaard), titel, auteur, leesdatum, sterren.
2. **Toevoegen** — drie manieren: titel typen, ISBN scannen, foto van de kaft. Altijd eerst een voorstel tonen ("Bedoel je dit boek?") voordat het wordt opgeslagen.
3. **Boek** — alle gegevens; sterren, status, leesdatum en recensie aanpassen; verwijderen (met bevestiging).
4. **Instellingen** — backup maken, backup terugzetten, Goodreads importeren, Excel-export.

## Gedrag

**Gegevens ophalen.** Eerst Open Library, daarna Google Books als aanvulling. Beide gratis, geen sleutel nodig. Lukt ophalen niet, dan kan Wilfred het boek gewoon met de hand invullen.

**Dubbel-waarschuwing.** Bij toevoegen kijkt de app of het boek er al staat: gelijk ISBN, of dezelfde titel en auteur (hoofdletters en leestekens maken niet uit). Dan verschijnt: "Dit boek staat al in je lijst (status: Gelezen, 4 sterren)". Wilfred kiest zelf of hij het toch toevoegt.

**Zoeken.** Zoekt in titel, auteur en ISBN, terwijl je typt.

**Backup.** Eén JSON-bestand met alle boeken én covers, te bewaren via het deelmenu (bijvoorbeeld in iCloud Drive). Terugzetten vervangt de huidige lijst pas na een duidelijke bevestiging. Is de laatste backup ouder dan 14 dagen, dan toont de app een rustige herinnering.

**Goodreads-import.** Het exportbestand (CSV) van Goodreads inlezen. Overnemen: titel, auteur, ISBN, sterren, leesdatum, recensie, en de plank (*read* → Gelezen, *currently-reading* → Bezig, *to-read* → Wil ik lezen). Covers worden daarna op de achtergrond opgehaald. Vooraf een backup; dubbele boeken worden overgeslagen en gemeld.

**Excel-export.** Eén .xlsx-bestand met één regel per boek en de velden hierboven als kolommen (zonder cover).

## Buiten Fase 1

Synopsis, informatie over de schrijver, verfilmingen, boekentips (Fase 2). Delen met anderen en wekelijkse tips (Fase 3). Geen accounts, geen synchronisatie tussen apparaten, geen betaalde diensten.

## Open vragen

1. Statussen: zijn de vier voorgestelde statussen goed?
2. Sterren: hele sterren, of ook halve?
3. Herlezen: één leesdatum per boek, of wil je meerdere keren lezen kunnen vastleggen?
