import { fetchAccountData, account } from "../stores.mjs"
import { get } from "svelte/store";

export function dfv(optPicker) {
    optPicker.picker("Default file visibility",[
        {
            name: "Public",
            icon: "/static/assets/icons/public.svg",
            description: "Everyone can view your uploads",
            id: "public"
        },
        {
            name: "Anonymous",
            icon: "/static/assets/icons/anonymous.svg",
            description: "Your username will be hidden",
            id: "anonymous"
        },
        {
            name: "Private",
            icon: "/static/assets/icons/private.svg",
            description: "Nobody but you can view your uploads",
            id: "private"
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/auth/dfv`,{method:"POST", body:JSON.stringify({
                defaultFileVisibility: exp.selected
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.statusText}`,[])
                }

                fetchAccountData()
            })
        }
    })
}

export function update_all_files(optPicker) {
    optPicker.picker("You sure?",[
        {
            name: "Yeah",
            icon: "/static/assets/icons/update.svg",
            description: `This will make all of your files ${get(account).defaultFileVisibility || "public"}`,
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/files/action`,{method:"POST", body:JSON.stringify({
                target:get(account).files,
                action: {
                    visibility: get(account).defaultFileVisibility
                }
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.statusText}`,[])
                }

                fetchAccountData()
            })
        }
    })
}