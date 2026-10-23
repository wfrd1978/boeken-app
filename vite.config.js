import { defineConfig } from 'vite';

// De app draait op https://wfrd1978.github.io/boeken-app/
export default defineConfig({
  base: '/boeken-app/',
  // SheetJS (Excel) is groot, maar wordt alleen geladen bij importeren en exporteren.
  build: { chunkSizeWarningLimit: 600 },
  // Moment van bouwen, zodat Wilfred in de app ziet welke versie hij heeft.
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
