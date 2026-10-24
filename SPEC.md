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
| Gedownload in Kobo | Aan/uit: het boek staat al op de Kobo. Zet *Wacht op Kobo Plus* uit (en andersom) | nee |
| Papieren boek gekocht | Aan/uit: het boek ligt als papieren boek klaar | nee |
| Categorie | Eén van: Thriller & spanning, Oorlog & geschiedenis, Sport, Biografie & levensverhaal, Journalistiek & samenleving, Roman & humor, Geloof & zingeving, Overig. Bij toevoegen doet de app een voorstel (eerst op basis van andere boeken van dezelfde schrijver, anders de onderwerpen bij Google Books of Open Library); de gebruiker kiest zelf | nee |
| Synopsis | Korte beschrijving (achterflaptekst), automatisch opgehaald bij Google Books of Open Library; een bestaande synopsis wordt nooit overschreven | nee |
| Opmerking | Korte toevoeging uit de Excel-lijst, bijvoorbeeld de serie ("Amos Decker 1") | nee |
| Toegevoegd op | Automatisch | ja |
| Bron | Hoe het boek erin kwam: getypt, scan, foto, Excel-import | ja |

## Schermen

0. **Startscherm** (boven de lijst) — groet met datum; groot het boek dat je nu leest, met de wazige cover als achtergrond (meerdere: veeg opzij); rijen covers *Onlangs gelezen* (laatste leesdatum eerst) en *Wil ik lezen* (laatst toegevoegd eerst), elk met *Alles ›* naar die tab in de lijst. Volgorde: *Onlangs gelezen*, *Boekennieuws*, *Wil ik lezen*, *Tips voor jou*, en dan *Al je boeken*.
1. **Lijst** — alle boeken met cover, titel, auteur, status en sterren. Naar links vegen toont een rode knop Verwijder (zoals Apple Mail); daarna kan het 5 seconden ongedaan worden gemaakt. Bovenin een zoekveld. Sorteren op: laatst toegevoegd (standaard), titel, auteur, laatste leesdatum, sterren. *Toon*: alles, één categorie, *Nog geen categorie*, *Wacht op Kobo Plus*, *Gedownload in Kobo* of *Papieren boek gekocht*; werkt samen met de tabs en het zoekveld, en de keuze blijft bewaard.
2. **Toevoegen** — twee manieren: titel of ISBN typen, streepjescode scannen met de camera (ZXing, alleen geldige ISBN's met controlecijfer). Altijd eerst een voorstel tonen ("Bedoel je dit boek?") voordat het wordt opgeslagen.
3. **Boek** — rechtsboven *Deel*: opent het deelmenu met een tekst: vaste opening ("Hé, hier een leuke boekentip voor je:"), titel en auteur, categorie en (bij gelezen) sterren, bij gelezen de recensie (hooguit 600 tekens), de synopsis (hooguit 350 tekens, afgekapt op een hele zin) en zoeklinks naar Kobo en bol.com (op ISBN, anders titel en auteur). Bij aan het lezen of wil ik lezen een korte zin in plaats van oordeel en recensie. Zonder deelmenu wordt de tekst gekopieerd. Alle gegevens; synopsis onder 'Over het boek' (eerste regels, met Lees meer); cover kiezen uit alle uitgaven die Google Books en Open Library kennen (of zelf zoeken op internet) of een eigen foto; categorie kiezen (nog een keer tikken haalt hem weg); onder *Kobo en boek* de labels Wacht op Kobo Plus, Gedownload in Kobo en Papieren boek gekocht aan/uit, en een knop Zoek bij Kobo (opent kobo.com met titel en auteur ingevuld); sterren, status, leesdata en recensie aanpassen; onder de recensie *Hulp van Claude*: steekwoorden kiezen, eventueel eigen woorden en een lengte, dan opent claude.ai (of de Claude-app) met de opdracht ingevuld (en gekopieerd als reserve); de recensie die Claude schrijft plakt de gebruiker met één knop terug. Gratis, geen sleutel, de app zelf praat met geen AI-dienst; een leesdatum toevoegen bij herlezen; verwijderen (met bevestiging).
4. **Profiel** (rond icoon rechtsboven) — profielfoto (tik op het rondje; vierkant uit het midden, 400 bij 400 pixels, op het toestel bewaard en mee in de backup; ook te zien in het icoon rechtsboven), naam, over mij, lezersprofiel (vanzelf bewaard) en een rij met de vijfsterrenboeken. De naam komt in de groet op het startscherm. Bovenaan statistieken, die alleen tellen vanaf een startmaand (*Telt vanaf*; standaard de maand waarin de statistieken voor het eerst werden geopend, bewaard in het profiel en mee in de backup). Alleen leesdatums vanaf die maand tellen; de oude lijst zonder datums blijft erbuiten, zodat het beeld niet scheef wordt. Te zien: drie tegels (gelezen, deze maand, gemiddelde sterren), *Per maand* (hooguit twaalf maanden), *Per jaar* (zodra er twee jaren zijn), *Wat je leest* (per categorie met gemiddelde sterren) en de schrijvers die hij het vaakst las (minstens twee boeken). Zonder lezingen: een korte uitleg. Bewaard in de app (vakje 'instellingen') en mee in de backup (backup-versie 2; versie 1 blijft terug te zetten).
5. **Instellingen** — backup maken, backup terugzetten, Excel importeren, covers opnieuw zoeken, *Covers zelf nalopen* (lijst van boeken zonder cover, per boek *Zoek* in Google Afbeeldingen en *Plak* een gekopieerde afbeelding; ook in *Kies een cover* bij een boek), Excel-export. Onderaan *Over deze app*: uitklapbare uitleg in gewone taal (waar gegevens staan, wat over internet gaat, covers en synopsis, hoe de tips leren, wat de app niet kan, waarom zo gebouwd). Verandert er iets aan de werking, dan deze uitleg meteen bijwerken.

## Gedrag

**Gegevens ophalen.** Eerst Open Library, daarna Google Books als aanvulling. Beide gratis. Google Books gebruikt een eigen gratis sleutel (beperkt tot het adres van de app en de Books API), omdat de gedeelde limiet zonder sleutel steeds op was. Lukt ophalen niet, dan kan de gebruiker het boek gewoon met de hand invullen. **Zuinig met Google:** de sleutel mag 1.000 vragen per dag (de teller gaat om 9:00 of 10:00 Nederlandse tijd op nul). Het ophalen op de achtergrond (covers, synopsis) gebruikt er hooguit 600 per dag; de rest blijft voor zoeken en toevoegen. Is de daglimiet bereikt, dan vraagt de app die dag niets meer aan Google en gaat het achtergrondwerk de volgende dag verder; zoeken loopt dan via Open Library. De bronnentest in Instellingen toont hoeveel vragen er vandaag zijn gebruikt. **Storing bij Google:** heeft een boek al een cover en vindt Open Library het boek, dan gaat het ophalen van gegevens gewoon door zonder Google; alleen boeken zonder cover en de synopsis wachten op Google. **Covers bewaren:** Google-covers mag de app niet als bestand opslaan; de service worker bewaart ze wel (hooguit 600, en alleen als er ruim plek is), zodat ze na een herstart meteen zichtbaar zijn.

**Dubbel-waarschuwing.** Bij toevoegen kijkt de app of het boek er al staat: gelijk ISBN, hetzelfde werk bij Open Library (zo worden vertalingen herkend), of dezelfde titel en achternaam van de auteur (hoofdletters, leestekens, lidwoorden vooraan en ondertitels maken niet uit). Dan verschijnt: "Dit boek staat al in je lijst (status: Gelezen, 4 sterren)". De gebruiker kiest zelf of hij het toch toevoegt.

**Zoeken.** Zoekt in titel, auteur en ISBN, terwijl je typt.

**Backup.** Eén JSON-bestand met alle boeken én covers (plus profiel, profielfoto, reacties op tips, openstaande tips en de keuzes in de lijst: sorteren, tab en Toon), te bewaren via het deelmenu (bijvoorbeeld in iCloud Drive). Terugzetten vervangt de huidige lijst pas na een duidelijke bevestiging. Elk boek in de backup wordt eerst gecontroleerd (een kapotte backup wordt geweigerd vóór er iets verandert), en werk op de achtergrond stopt voordat de lijst wordt vervangen. Is de laatste backup ouder dan 14 dagen, dan toont de app een rustige herinnering. **Verhuizen:** onder Backup staat wat er in de backup zit, met hoeveel covers als plaatje en hoeveel alleen als internetadres. *Covers als plaatje vastleggen* bewaart covers die alleen een adres hebben alsnog als plaatje: Google staat dat niet toe, dus de app zoekt dezelfde uitgave (zelfde ISBN) bij Open Library; het adres blijft staan. Wat overblijft staat in *Covers nalopen* onder *Alleen via internet*: cover vasthouden, *Voeg toe aan Foto's*, dan *Foto* (kiezen uit Foto's). *Plak* kan ook, maar bij covers van een andere site zet de iPhone soms alleen een link in het klembord; de melding noemt dan wat er wel in stond.

**Excel-import.** De bestaande boekenlijst (.xlsx) inlezen. Welke kolom wat betekent (titel, auteur, sterren, datum, status …) stellen we vast aan de hand van zijn eigen bestand; bij twijfel vraagt de app het. Covers en ontbrekende gegevens (ISBN, jaar, uitgever) worden daarna op de achtergrond opgehaald, zolang de app open is en er internet is; het gaat de volgende keer vanzelf verder. Titel en auteur uit de lijst blijven altijd zoals de gebruiker ze schreef. Importeren kan pas als er die dag of de dag ervoor een backup is gemaakt. Staat een boek er al en heeft het nog geen sterren, dan vult de import de sterren uit het bestand aan (vooraf getoond); sterren die de gebruiker zelf gaf, blijven staan. Hetzelfde geldt voor een kolom *Categorie*: alleen een lege categorie wordt aangevuld. Een bestand met alleen Auteur, Titel en Categorie is een indeellijst: die vult alleen bestaande boeken aan en voegt nooit boeken toe (niet gevonden boeken worden gemeld). Vooraf een backup; dubbele boeken worden overgeslagen en gemeld, en vooraf toont de app hoeveel boeken er worden toegevoegd. Indeling van het (verbeterde) bestand: kolommen Auteur, Titel, Gelezen (maand), Sterren, Opmerking; alle boeken krijgen status *Gelezen*. Het bestand zelf komt niet in de repository (die is openbaar).

**Excel-export.** Eén .xlsx-bestand met één regel per boek, gesorteerd op achternaam van de auteur, met de velden hierboven als kolommen (zonder cover) en een filter op de kop. Bij herlezen staan alle leesdata in één cel, gescheiden door een puntkomma. Delen via het deelmenu (twee tikken: klaarmaken, dan delen).

## Boekentips (stap 13)

- **Wat:** elke week 16 tips; ongeveer tweederde recent verschenen (afgelopen jaar), eenderde oudere parels, verspreid over minstens vier categorieën. De app toont er 8 tegelijk; reageert de gebruiker, dan schuift de volgende door.
- **Covers:** elke tip krijgt waar mogelijk een `coverUrl` mee (het coverplaatje van de boekpagina op Hebban, gecontroleerd door de wekelijkse taak). Zonder `coverUrl` zoekt de app zelf; een mislukte zoekpoging wordt na drie dagen opnieuw geprobeerd. Met `bijwerkingen` in `tips.json` kan een latere ronde een tip die al op de telefoon staat verbeteren (cover, titel, ISBN, jaar, uitgever, categorie). Zet de gebruiker een tip op zijn lijst, dan neemt het boek de cover van de tip mee.
- **Leren van keuzes:** op de telefoon zelf, zonder dat er iets online gaat. Per categorie en per soort (nieuw of parel) telt *Wil ik lezen* +2, *Al gelezen* +1 en *Niet voor mij* −2; vijfsterrenboeken tellen licht mee voor hun categorie. De tips met de hoogste score staan vooraan. De wekelijkse taak ziet de reacties niet (ze staan alleen op de telefoon); wil de gebruiker dat Claude ook leert, dan deelt hij af en toe een backup in een sessie en past Claude het profiel in de taak aan. Nederlandse uitgaven die in Nederland te krijgen zijn.
- **Vermijden:** heel dikke boeken, literaire romans, Engelstalige boeken. Nooit een boek dat al in de lijst staat (ook niet als vertaling) of eerder met *Niet voor mij* is weggetikt.
- **Op het startscherm:** rij *Tips voor jou* met cover, titel, auteur en één zin waarom. Tik: synopsis en knoppen *Wil ik lezen*, *Al gelezen* (met sterren) en *Niet voor mij*. Reacties gaan mee in de backup. Tips zonder reactie blijven staan als er een nieuwe ronde komt (nieuwe vooraan, hooguit 12 tegelijk); de app bewaart ze op het toestel.
- **Op de Toevoegen-pagina:** dezelfde tips onder elkaar, met de reden erbij en een knop **+** die de tip meteen op *Wil ik lezen* zet. Tikken op een tip opent hem helemaal (zoals op het startscherm). Elke tip heeft een categorie (veld `categorie` in `tips.json`); die krijgt het boek mee.
- **Hoe:** de app haalt `tips.json` op van de eigen site. Een wekelijkse geplande taak van Claude (Routine 'Wekelijkse boekentips', zaterdag 06:38, draait in de vaste bouwsessie omdat alleen die mag schrijven in de repository) zet daar nieuwe tips neer; de gebruiker hoeft niets te doen. De uitleg bij een tip is algemeen ("voor wie houdt van …") en noemt zijn eigen boeken niet. Eens per maand of zo stuurt de gebruiker een backup, zodat de smaak wordt bijgesteld.

## Boekennieuws

- **Wat:** elke week 4 tot 6 korte berichten over boeken en schrijvers die bij de smaak passen: nieuwe boeken van zijn schrijvers, prijzen, verfilmingen, interviews. Elk bericht met een bron en een link; niets verzonnen.
- **Op het startscherm:** onder de tips de rij *Boekennieuws*: drie berichten zichtbaar, de rest onder *Meer nieuws*. Tik op een bericht: het artikel opent. Gaat een bericht over een schrijver uit zijn lijst, dan staat het bovenaan met het label *Schrijver die je leest*; dat bepaalt de app op de telefoon zelf.
- **Hoe:** `nieuws.json` op de eigen site, gemaakt door dezelfde wekelijkse taak als de tips. Het bestand is openbaar en noemt de gebruiker, zijn profiel en zijn lijst niet; nieuws over zijn eigen schrijvers wordt afgewisseld met algemener boekennieuws.

## Veiligheid en betrouwbaarheid

- Alles wat van buiten komt (zoekbronnen, backups, tips) wordt afgeschermd voordat het in beeld komt, ook aanhalingstekens. Als cover worden alleen https-, blob- en ingebakken plaatjes gebruikt.
- Een Content-Security-Policy staat alleen de eigen code toe; geen inline scripts.
- Ophalen op de achtergrond vult alleen velden die nog leeg zijn, in één handeling, en alleen als het nog hetzelfde boek is.
- De service worker wacht hooguit 3 seconden op internet en bewaart alleen goede antwoorden.
- Automatische tests (`npm test`) draaien vóór elke keer online zetten.

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


**Een vleugje kleur (24 okt):** warm papierwit als achtergrond in plaats van wit; een kort gouden streepje (goud uit het logo) boven elke kop; *Tips voor jou* op een zacht groen vlak; elke categorie een eigen gedempte kleur (bolletje met naam in de lijst, gekleurde knoppen bij het boek); de eerste statistiektegel in het groen. Donkere modus doet mee.

## Nog te doen en buiten beeld

Fase 2: startscherm, synopsis en profiel zijn klaar (stap 10–12); boekentips (stap 13), daarna categorieën (stap 14) en statistieken (stap 15); zie CLAUDE.md. Daarna eventueel informatie over de schrijver en verfilmingen. Delen met anderen en wekelijkse tips (Fase 3). Geen accounts, geen synchronisatie tussen apparaten, geen betaalde diensten.

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
| 2026-10-23 | Eerst fase 1 afmaken (stap 7–9), dan startscherm, synopsis en tips |
| 2026-10-23 | Boekentips maakt Claude in een sessie (gratis), niet automatisch via een betaalde AI-dienst |
| 2026-10-23 | Toevoegen via foto van de kaft (stap 9) geschrapt: herkenning op echte kaften te onbetrouwbaar. Scannen en typen blijven |
| 2026-10-23 | Fase 1 afgerond; Fase 2 actief |
| 2026-10-23 | Eigen gratis Google-sleutel voor de Books API, met toestemming van de gebruiker |
| 2026-10-23 | Synopsis: liefst de Nederlandse beschrijving van Google Books, anders die van Open Library; op de achtergrond, na de covers |
| 2026-10-23 | Profielpagina met lezersprofiel; opslag krijgt een tweede vakje (instellingen), backup versie 2 |
| 2026-10-23 | Nieuw logo: witte schreef-B met gouden streep op donkergroen (optie 1) |
| 2026-10-23 | Tips: 8 per week, automatisch via een wekelijkse taak en `tips.json` (openbaar, met algemene uitleg); vermijden: dikke boeken, literaire romans, Engelstalig. Haalt de wekelijkse tip uit fase 3 naar voren |
| 2026-10-23 | Terug naar het startscherm: verder waar je was; onderin op Boeken tikken gaat naar boven |
| 2026-10-23 | Categorieën toegevoegd aan het plan (stap 14), vóór de statistieken |
| 2026-10-23 | Acht categorieën (zie velden); bestaande boeken ingedeeld via een indeellijst die de gebruiker zelf importeert. Het filter op 'Wacht op Kobo Plus' (stap 16) zit in dezelfde Toon-keuze en is daarmee meegebouwd |
| 2026-10-24 | Statistieken tellen pas vanaf een startmaand (oktober 2026), op verzoek van de gebruiker: de oude lijst heeft bijna geen datums en vooral sterren bij topboeken |
| 2026-10-24 | Labels Gedownload in Kobo en Papieren boek gekocht, naast Wacht op Kobo Plus (ook in Toon en de Excel-export) |
| 2026-10-24 | Iets meer kleur, subtiel: warm papierwit, gouden streepjes, groen tipvlak, categoriekleuren |
| 2026-10-24 | Nalooplijst: knop Foto naast Plak, omdat kopiëren van Google-covers op de iPhone geen plaatje opleverde |
| 2026-10-24 | Bij een storing van Google gaan boeken met een cover door op Open Library |
| 2026-10-24 | Tips en nieuws onder de rij Wil ik lezen; covers van tips direct zichtbaar zodra een ronde is bijgewerkt (kleinere plaatjes, 320 pixels) |
| 2026-10-24 | Tips krijgen een cover mee uit Hebban; oude tips kunnen worden bijgewerkt. 'Trage paarden' (Mick Herron) heet in de huidige uitgave 'Slome paarden' |
| 2026-10-24 | Boekennieuws: wekelijks via dezelfde taak als de tips (nieuws.json, openbaar, met bron per bericht) |
| 2026-10-24 | Verhuizen naar een andere telefoon: verhuisoverzicht, covers vastleggen als plaatje, en de backup neemt ook openstaande tips en lijstkeuzes mee |
| 2026-10-24 | Eerste automatische ronde (week 44) kon niet online: een losse taak-sessie mag niet in de repository schrijven. Tips handmatig online gezet (15, één zonder Nederlandse uitgave weggelaten); de taak draait voortaan in de bouwsessie |
| 2026-10-24 | Getest en klaar: recensiehulp via Claude, covers kopiëren en plakken, uitgebreide deeltekst |
| 2026-10-24 | Covers: automatisch de eerste hit van Google Afbeeldingen kan niet (Google's zoekkoppeling is dicht voor nieuwe gebruikers en stopt in januari 2027). Daarom kopiëren en plakken, met een nalooplijst |
| 2026-10-24 | Recensiehulp via de Claude-app (gratis, met een eigen account) in plaats van een AI-dienst met sleutel |
| 2026-10-24 | Getest en klaar: tips op de Toevoegen-pagina, Deel-knop, zuinig met Google, covers bewaren, tips leren van keuzes, profielfoto en de uitleg in Instellingen |
| 2026-10-24 | Profielfoto, apart bewaard in het vakje instellingen en mee in de backup (backup blijft versie 2; een backup zonder foto laat de huidige foto staan) |
| 2026-10-24 | Tips: 16 per week, 8 tegelijk zichtbaar, geordend op de eerdere keuzes |
| 2026-10-24 | Google-daglimiet (1.000) was om 0:10 al op door het achtergrondwerk: budget van 600 voor de achtergrond, stoppen bij de daglimiet, covers bewaard door de service worker |
| 2026-10-24 | Van de werklijst: tips op de Toevoegen-pagina en een boek delen (tekst via het deelmenu, nog geen deelkaart als afbeelding) |
| 2026-10-24 | Stap 15 getest en klaar; daarmee is het stappenplan van fase 2 (10–16) af. Volgende werk komt van de werklijst, in de volgorde van de gebruiker |
| 2026-10-24 | Stap 14 getest en klaar. Statistieken (stap 15) op de profielpagina, zonder grafiekbibliotheek: eenvoudige staafjes in de accentkleur |
