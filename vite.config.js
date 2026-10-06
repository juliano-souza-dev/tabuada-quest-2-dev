import { defineConfig } from 'vite';

const buildVersion = String(
  process.env.GITHUB_SHA ||
  process.env.VITE_BUILD_VERSION ||
  'dev'
).slice(0, 7);

export default defineConfig({
  base: '/tabuada-quest-2-dev/',
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion)
  },
  plugins: [
    {
      name: 'tabuada-quest-build-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ version: buildVersion })
        });
      }
    }
  ]
});
