import { defineConfig } from 'vite'
// Example with Vue
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [
        vue(),
    ],
    
    meteor: {
        clientEntry: 'imports/ui/main.ts',
    },
})