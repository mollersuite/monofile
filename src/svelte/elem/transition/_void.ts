import { circIn, circOut } from "svelte/easing"

export function _void(
    node: HTMLElement, 
    options?: { duration?:number, easingFunc?: (a:number)=>number, prop?:string, rTarg?: "height"|"width"}
) {
    const { duration = 300, easingFunc = circIn, prop, rTarg } = options ?? {}
    let rect = node.getBoundingClientRect()

    return {
        duration,
        css: (t: number) => {
            let eased = easingFunc(t)
            return `
                white-space: nowrap;
                ${prop||"height"}: ${(eased)*(rect[rTarg || (prop && prop in rect) ? prop as keyof Omit<DOMRect, "toJSON"> : "height"])}px;
                padding: 0px;
                opacity:${eased};
                overflow: clip;
            `
        }
    }
}