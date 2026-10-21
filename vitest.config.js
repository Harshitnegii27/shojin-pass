import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, configDefaults } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      'server-only': path.join(root, 'tests/stubs/server-only.js'),
      '@': root,
    },
  },
  test: {
    exclude: [...configDefaults.exclude, '.next/**'],
  },
});
