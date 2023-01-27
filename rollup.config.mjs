import svelte from 'rollup-plugin-svelte'
import resolve from "@rollup/plugin-node-resolve"

export default {
    input: "src/script/client/main.js",
    output: {
        file: 'out/script/client/bundle.js',
        format: 'esm',
        sourcemap:true
    },
    plugins: [
        resolve(),
        svelte({})
    ]
}