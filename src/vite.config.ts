import { defineConfig } from 'vite';

export default defineConfig({
    root: './src',
    publicDir: './assets',
  build: {
      outDir: '../dist',
      minify: false,
      sourcemap: true,
      manifest: true,
    emptyOutDir: true,
  },
});
