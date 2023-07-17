import { defineConfig } from 'vite'
// Example with Vue
import vue from '@vitejs/plugin-vue'
import { ssr } from 'vite-plugin-ssr/plugin';

export default defineConfig({
    plugins: [
        vue(),
        ssr(),
    ],
    
    meteor: {
        clientEntry: 'imports/ui/main.ts',
    },
})