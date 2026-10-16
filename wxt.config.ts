import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  vite: () => ({ plugins: [preact()] }),
  manifest: ({ browser }) => ({
    name: 'CleanerGroupAuctions',
    short_name: 'CGA',
    description: 'A cleaner, faster interface for MyGroupAuctions.com. Not affiliated with MyGroupAuctions.',
    permissions: ['storage'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'cleanergroupauctions@jonoaugustine.github.io',
          // data_collection_permissions needs Firefox 140 on desktop and 142 on Android.
          strict_min_version: '140.0',
          data_collection_permissions: { required: ['none'] },
        },
        gecko_android: { strict_min_version: '142.0' },
      },
    }),
  }),
});
