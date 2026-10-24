// Licht of donker, al vóór de rest van de app laadt (zodat het scherm niet eerst wit oplicht).
// Keuzes: 'avond' (standaard: donker van 20:00 tot 7:00, en altijd als de iPhone donker staat),
// 'iphone' (precies zoals de iPhone), 'licht' en 'donker'.
(function () {
  var AVOND_VAN = 20;
  var OCHTEND_TOT = 7;

  function keuze() {
    try {
      return localStorage.getItem('weergave') || 'avond';
    } catch (e) {
      return 'avond';
    }
  }

  function toepassen() {
    var k = keuze();
    var uur = new Date().getHours();
    var avond = uur >= AVOND_VAN || uur < OCHTEND_TOT;
    var thema = k === 'licht' ? 'licht' : k === 'donker' || (k === 'avond' && avond) ? 'donker' : '';
    var root = document.documentElement;
    if (thema) root.setAttribute('data-thema', thema);
    else root.removeAttribute('data-thema');
    // De balk van de iPhone bovenin in dezelfde kleur als de achtergrond.
    var donker = thema === 'donker' || (!thema && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', donker ? '#121413' : '#fbf9f5');
  }

  toepassen();
  // Elke minuut even kijken, en als de app weer in beeld komt: zo wisselt hij vanzelf om 20:00 en 7:00.
  setInterval(toepassen, 60000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) toepassen();
  });
  window.boekenThema = { toepassen: toepassen };
})();
