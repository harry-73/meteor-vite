import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { ssr } from 'vite-plugin-ssr/plugin';

export default defineConfig({
    server: {
        port: 5173,
    },
    
    plugins: [
        vue(),
        ssr(),
    ],
    
    meteor: {
        clientEntry: 'imports/ui/ssr-render/App.ts',
        viteMode: 'ssr',
    } satisfies MeteorViteConfig['meteor'],
})