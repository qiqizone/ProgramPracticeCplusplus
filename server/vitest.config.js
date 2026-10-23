import { defineConfig } from 'vitest/config';

export default defineConfig({
  ssr: {
    external: ['node:sqlite'],
  },
  test: {
    env: {
      NODE_ENV: 'test',
      DB_PATH: ':memory:',
      JWT_SECRET: 'test-secret',
    },
    testTimeout: 15000,
    server: {
      deps: {
        external: [/^node:/],
      },
    },
  },
});
