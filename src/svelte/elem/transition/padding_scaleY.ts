import { circIn, circOut } from "svelte/easing"

function padding_scaleY(node: HTMLElement, options?: { duration?: number, easingFunc?: (a: number) => number, padY?: number, padX?: number, op?: boolean }) {
    const { duration = 300, easingFunc = circOut, padY, padX, op } = options ?? {}
    let rect = node.getBoundingClientRect()

    return {
        duration,
        css: (t:number) => {
            let eased = easingFunc(t)

            return `
                height: ${eased*(rect.height-(padY||0))}px;
                ${padX&&padY ? `padding: ${(eased)*(padY)}px ${(padX)}px;` : ""}
                ${op ? `opacity: ${eased};` : ""}
            `
        }
    }
}
    
export {padding_scaleY}