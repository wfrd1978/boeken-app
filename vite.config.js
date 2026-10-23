import { defineConfig } from 'vite';

// De app draait op https://wfrd1978.github.io/boeken-app/
export default defineConfig({
  base: '/boeken-app/',
  // Moment van bouwen, zodat de gebruiker in de app ziet welke versie hij heeft.
  define: {
    __VERSIE__: JSON.stringify(
      new Date().toLocaleString('nl-NL', {
        timeZone: 'Europe/Amsterdam',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    ),
  },
});
