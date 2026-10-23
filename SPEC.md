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
| Status | *Wil ik lezen*, *Aan het lezen*, *Gelezen*, *Gestopt* (in de opslag heet *Aan het lezen* nog 'Bezig') | ja, standaard *Wil ik lezen* |
| Sterren | 1 t/m 5, alleen hele sterren | nee |
| Leesdata | Eén of meer datums waarop het boek uit was; herlezen voegt een datum toe. Is alleen de maand bekend, dan bewaren we alleen maand en jaar (geen verzonnen dag) | nee |
| Recensie | Vrije tekst | nee |
| Wacht op Kobo Plus | Aan/uit: boek staat op de verlanglijst maar zit nog niet in Kobo Plus. Zichtbaar als label naast de status | nee |
| Opmerking | Korte toevoeging uit de Excel-lijst, bijvoorbeeld de serie ("Amos Decker 1") | nee |
| Toegevoegd op | Automatisch | ja |
| Bron | Hoe het boek erin kwam: getypt, scan, foto, Excel-import | ja |

## Schermen

1. **Lijst** — alle boeken met cover, titel, auteur, status en sterren. Naar links vegen toont een rode knop Verwijder (zoals Apple Mail); daarna kan het 5 seconden ongedaan worden gemaakt. Bovenin een zoekveld. Sorteren op: laatst toegevoegd (standaard), titel, auteur, laatste leesdatum, sterren.
2. **Toevoegen** — drie manieren: titel typen, ISBN scannen, foto van de kaft. Altijd eerst een voorstel tonen ("Bedoel je dit boek?") voordat het wordt opgeslagen.
3. **Boek** — alle gegevens; label Wacht op Kobo Plus aan/uit en een knop Zoek bij Kobo (opent kobo.com met titel en auteur ingevuld); sterren, status, leesdata en recensie aanpassen; een leesdatum toevoegen bij herlezen; verwijderen (met bevestiging).
4. **Instellingen** — backup maken, backup terugzetten, Excel importeren, covers opnieuw zoeken, Excel-export.

## Gedrag

**Gegevens ophalen.** Eerst Open Library, daarna Google Books als aanvulling. Beide gratis, geen sleutel nodig. Lukt ophalen niet, dan kan de gebruiker het boek gewoon met de hand invullen.

**Dubbel-waarschuwing.** Bij toevoegen kijkt de app of het boek er al staat: gelijk ISBN, hetzelfde werk bij Open Library (zo worden vertalingen herkend), of dezelfde titel en achternaam van de auteur (hoofdletters, leestekens, lidwoorden vooraan en ondertitels maken niet uit). Dan verschijnt: "Dit boek staat al in je lijst (status: Gelezen, 4 sterren)". De gebruiker kiest zelf of hij het toch toevoegt.

**Zoeken.** Zoekt in titel, auteur en ISBN, terwijl je typt.

**Backup.** Eén JSON-bestand met alle boeken én covers, te bewaren via het deelmenu (bijvoorbeeld in iCloud Drive). Terugzetten vervangt de huidige lijst pas na een duidelijke bevestiging. Is de laatste backup ouder dan 14 dagen, dan toont de app een rustige herinnering.

**Excel-import.** De bestaande boekenlijst (.xlsx) inlezen. Welke kolom wat betekent (titel, auteur, sterren, datum, status …) stellen we vast aan de hand van zijn eigen bestand; bij twijfel vraagt de app het. Covers en ontbrekende gegevens (ISBN, jaar, uitgever) worden daarna op de achtergrond opgehaald, zolang de app open is en er internet is; het gaat de volgende keer vanzelf verder. Titel en auteur uit de lijst blijven altijd zoals de gebruiker ze schreef. Importeren kan pas als er die dag of de dag ervoor een backup is gemaakt. Vooraf een backup; dubbele boeken worden overgeslagen en gemeld, en vooraf toont de app hoeveel boeken er worden toegevoegd. Indeling van het (verbeterde) bestand: kolommen Auteur, Titel, Gelezen (maand), Sterren, Opmerking; alle boeken krijgen status *Gelezen*. Het bestand zelf komt niet in de repository (die is openbaar).

**Excel-export.** Eén .xlsx-bestand met één regel per boek en de velden hierboven als kolommen (zonder cover). Bij herlezen staan alle leesdata in één cel.

## Vormgeving

Inspiratie: de apps van de Volkskrant, Trouw en NOS. Simpel en strak, zoals een nieuwsapp. Wat we daaruit overnemen:

1. **Rustige basis.** Witte achtergrond, zwarte tekst, dunne grijze scheidingslijnen. Geen schaduwen of versieringen.
2. **Beeld voorop.** Covers groot en scherp, zoals de foto's in een nieuwsapp; het nieuwste of huidige boek groot bovenaan.
3. **Letters met karakter.** Titels in een stevige schreefletter (zoals de Volkskrant); de rest in een eenvoudige, schreefloze letter.
4. **Eén accentkleur.** Zoals rood bij NOS en blauw bij Trouw. Gebruikt voor kleine labels (status, zoals "ANALYSE" bij de Volkskrant) en de actieve knop.
5. **Woordmerk in het midden.** "Boeken" als titel bovenaan in het midden.
6. **Tabjes bovenaan** met een streep onder de actieve: Alles · Aan het lezen · Gelezen · Wil ik lezen.
7. **Zwevende balk onderin** met de belangrijkste plekken: Boeken, Toevoegen, Zoek, Instellingen.

Gekozen: accentkleur donkergroen (#1F4D3F), de lijst als rijtje (kleine cover links). Titels in de schreefletter van de iPhone (New York), de rest in de systeemletter. De lijst heeft tabjes per status; de balk onderin vervangt de losse +-knop en de link naar Instellingen.

## Buiten Fase 1

Synopsis, informatie over de schrijver, verfilmingen, boekentips (Fase 2). Delen met anderen en wekelijkse tips (Fase 3). Geen accounts, geen synchronisatie tussen apparaten, geen betaalde diensten.

## Besluiten

| Datum | Besluit |
|-------|---------|
| 2026-10-23 | Vier statussen: Wil ik lezen, Bezig, Gelezen, Gestopt |
| 2026-10-23 | Sterren: alleen hele sterren, 1 t/m 5 |
| 2026-10-23 | Herlezen vastleggen: per boek één of meer leesdata |
| 2026-10-23 | Bij toevoegen kies je meteen de status (standaard *Wil ik lezen*) |
| 2026-10-23 | Import uit Excel in plaats van Goodreads: de lijst staat in Excel |
| 2026-10-23 | Leesdatum mag alleen maand en jaar zijn (bijv. oktober 2025) |
| 2026-10-23 | Verzamelregels in de Excel-lijst (zoals een trilogie) worden losse boeken |
| 2026-10-23 | Typefouten worden in de Excel-lijst zelf verbeterd, niet door de app |
| 2026-10-23 | Vormgeving naar het voorbeeld van nieuwsapps (Volkskrant, Trouw, NOS); ontwerpronde na stap 6 |
| 2026-10-23 | Verwijderen ook door naar links te vegen in de lijst, met 'Ongedaan maken' in plaats van een bevestigingsvraag |
| 2026-10-23 | Ontwerp: donkergroen, rijtje, tabjes per status, zwevende balk onderin |
| 2026-10-23 | Weigert een bron tijdelijk (daglimiet Google), dan wordt het boek later opnieuw geprobeerd; knop in Instellingen om ontbrekende covers opnieuw te zoeken |
| 2026-10-23 | Geen automatische koppeling met Kobo (geen openbare API, niet gratis te bouwen); wel label 'Wacht op Kobo Plus' bij het boek en een knop 'Zoek bij Kobo' |
| 2026-10-23 | Status 'Bezig' heet in beeld 'Aan het lezen' |
