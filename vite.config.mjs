import { defineConfig } from "vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { resolve } from "path"
export default defineConfig({
    root: "./src",
    build: {
        outDir: "../dist",
        assetsDir: "static/vite",
        rollupOptions: {
            input: {
                main: resolve(__dirname, "src/index.html"),
                download: resolve(__dirname, "src/download.html"),
                error: resolve(__dirname, "src/error.html"),
            },
        },
    },
    plugins: [svelte({})],
})
