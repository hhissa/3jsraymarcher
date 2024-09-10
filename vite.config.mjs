import glsl from 'vite-plugin-glsl';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [glsl(),],
    optimizeDeps: {
        esbuildOptions: {
            target: 'esnext'
        }
    },
    build: {
        target: "esnext"
    }
});
