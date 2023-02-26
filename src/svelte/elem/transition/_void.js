import { circIn, circOut } from "svelte/easing"

export function _void(node, { duration, easingFunc, op, prop, rTarg }) {
    let rect = node.getBoundingClientRect()

    return {
        duration: duration||300,
        css: t => {
            let eased = (easingFunc || circIn)(t)

            return `
                white-space: nowrap;
                ${prop||"height"}: ${(eased)*(rect[rTarg||prop||"height"])}px;
                padding: 0px;
                opacity:${eased};
                overflow: clip;
            `
        }
    }
}