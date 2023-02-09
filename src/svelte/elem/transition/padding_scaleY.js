import { circIn, circOut } from "svelte/easing"

export function padding_scaleY(node, { duration, easingFunc, padY, padX, op }) {
    let rect = node.getBoundingClientRect()

    return {
        duration: duration||300,
        css: t => {
            let eased = (easingFunc || circOut)(t)

            return `
                height: ${eased*(rect.height-(padY||0))}px;
                ${padX&&padY ? `padding: ${(eased)*(padY)}px ${(padX)}px;` : ""}
                ${op ? `opacity: ${eased};` : ""}
            `
        }
    }
}