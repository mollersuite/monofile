import { fetchAccountData, fetchFilePointers, account } from "../stores.mjs"
import { get } from "svelte/store";

export function pwdReset(optPicker) {
    optPicker.picker("Reset password",[
        {
            name: "Target user",
            icon: "/static/assets/icons/person.svg",
            id: "target",
            inputSettings: {}
        },
        {
            name: "New password",
            icon: "/static/assets/icons/change_password.svg",
            id: "password",
            inputSettings: {
                password: true
            }
        },
        {
            name: "Update password",
            icon: "/static/assets/icons/update.svg",
            description: "This will log the target user out of all sessions",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/admin/reset`,{method:"POST", body:JSON.stringify({
                target: exp.target,
                password:exp.password
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.statusText}`,[])
                }

            })
        }
    })
}