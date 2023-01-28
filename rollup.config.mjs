import svelte from 'rollup-plugin-svelte'
import resolve from "@rollup/plugin-node-resolve"

export default {
    input: "src/client/main.js",
    output: {
        file: 'out/client/bundle.js',
        format: 'esm',
        sourcemap:true
    },
    plugins: [
        resolve(),
        svelte({})
    ]
}