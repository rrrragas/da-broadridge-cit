import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure/util tests run in Node. For DOM-dependent block tests, add jsdom:
    //   npm i -D jsdom  →  set environment: 'jsdom'
    environment: 'node',
    include: ['test/**/*.test.js', 'blocks/**/*.test.js'],
  },
});
