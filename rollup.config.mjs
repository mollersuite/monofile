import svelte from 'rollup-plugin-svelte'
import resolve from "@rollup/plugin-node-resolve"

export default [
    {
        input: "src/client/index.js",
        output: {
            file: 'out/client/index.js',
            format: 'esm',
            sourcemap:true
        },
        plugins: [
            resolve(),
            svelte({})
        ]
    },
    {
        input: "src/client/collection.js",
        output: {
            file: 'out/client/collection.js',
            format: 'esm',
            sourcemap:true
        },
        plugins: [
            resolve(),
            svelte({})
        ]
    }
]