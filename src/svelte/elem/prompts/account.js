import { fetchAccountData, account, refreshNeeded } from "../stores.mjs"
import { get } from "svelte/store";

export function deleteAccount(optPicker) {
    optPicker.picker("What should we do with your files?",[
        {
            name: "Delete my files",
            icon: "/static/assets/icons/admin/delete_file.svg",
            description: "Your files will be permanently deleted",
            id: true
        },
        {
            name: "Do nothing",
            icon: "/static/assets/icons/file.svg",
            description: "Your files will not be affected",
            id: false
        }
    ]).then((exp) => {
        if (exp) {
            let deleteFiles = exp.selected

            optPicker.picker(`Enter your username to continue.`,[
                {
                    name: "Enter your username",
                    icon: "/static/assets/icons/person.svg",
                    inputSettings: {},
                    id:"username"
                },
                {
                    name: `Delete account ${deleteFiles ? "& files" : ""}`,
                    icon: "/static/assets/icons/delete_account.svg",
                    description: `This cannot be undone.`,
                    id: true
                }
            ]).then((fin) => {
                if (fin && fin.selected) {
                    if (fin.username != (get(account)||{}).username) {
                        optPicker.picker("Incorrect username. Please try again.",[])
                        return
                    }
                    
                    fetch(`/auth/delete_account`,{method:"POST", body:JSON.stringify({
                        deleteFiles
                    })}).then((response) => {
                        
                        if (response.status != 200) {
                            optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                        }
        
                        fetchAccountData()
                    })
                    
                }
            })
        }
    })
}

export function userChange(optPicker) {
    optPicker.picker("Change username",[
        {
            name: "New username",
            icon: "/static/assets/icons/person.svg",
            id: "username",
            inputSettings: {}
        },
        {
            name: "Update username",
            icon: "/static/assets/icons/update.svg",
            description: "",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/auth/change_username`,{method:"POST", body:JSON.stringify({
                username:exp.username
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                }

                fetchAccountData()
            })
        }
    })
}

export function forgotPassword(optPicker) {
    optPicker.picker("Forgot your password?",[
        {
            name: "Username",
            icon: "/static/assets/icons/person.svg",
            id: "user",
            inputSettings: {}
        },
        {
            name: "OK",
            icon: "/static/assets/icons/update.svg",
            description: "",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/auth/request_emergency_login`,{method:"POST", body:JSON.stringify({
                account:exp.user
            })}).then((response) => {
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                } else {
                    optPicker.picker(`Please follow the instructions sent to your inbox.`,[])
                }
            })
        }
    })
}

export function emailPotentialRemove(optPicker) {
    optPicker.picker("What would you like to do?",[
        {
            name: "Set a new email",
            icon: "/static/assets/icons/change_email.svg",
            description: "",
            id: "set"
        },
        {
            name: "Disconnect email",
            icon: "/static/assets/icons/disconnect_email.svg",
            description: "",
            id: "disconnect"
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            switch (exp.selected) {
                case "set": 
                    emailChange(optPicker);
                case "disconnect":
                    fetch("/auth/remove_email", {method: "POST"}).then((response) => {
                        if (response.status != 200) {
                            optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                        }
                        
                        fetchAccountData()
                    })
            }
        }
    })
}

export function emailChange(optPicker) {
    optPicker.picker("Change email",[
        {
            name: "New email",
            icon: "/static/assets/icons/mail.svg",
            id: "email",
            inputSettings: {}
        },
        {
            name: "Request email change",
            icon: "/static/assets/icons/update.svg",
            description: "",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/auth/request_email_change`,{method:"POST", body:JSON.stringify({
                email:exp.email
            })}).then((response) => {
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                } else {
                    optPicker.picker(`Please continue to your inbox at ${exp.email.split("@")[1]} and click on the attached link.`,[])
                }
            })
        }
    })
}

export function pwdChng(optPicker) {
    optPicker.picker("Change password",[
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
            description: "This will log you out of all sessions",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/auth/change_password`,{method:"POST", body:JSON.stringify({
                password:exp.password
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                }

                fetchAccountData()
            })
        }
    })
}

export function customcss(optPicker) {
    optPicker.picker("Set custom CSS",[
        {
            name: "Enter a file ID",
            icon: "/static/assets/icons/file.svg",
            id: "fileid",
            inputSettings: {}
        },
        {
            name: "OK",
            icon: "/static/assets/icons/update.svg",
            description: "Refresh to apply changes",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/auth/customcss`,{method:"POST", body:JSON.stringify({
                fileId:exp.fileid
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                }

                fetchAccountData()
                refreshNeeded.set(true);
            })
        }
    })
}


export function embedColor(optPicker) {
    optPicker.picker("Set embed color",[
        {
            name: "FFFFFF",
            icon: "/static/assets/icons/pound.svg",
            id: "color",
            inputSettings: {}
        },
        {
            name: "OK",
            icon: "/static/assets/icons/update.svg",
            description: "",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/auth/embedcolor`,{method:"POST", body:JSON.stringify({
                color:exp.color
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                }

                fetchAccountData()
            })
        }
    })
}


export function embedSize(optPicker) {
    optPicker.picker("Set embed image size",[
        {
            name: "Large",
            icon: "/static/assets/icons/image.svg",
            description: "",
            id: true
        },
        {
            name: "Small",
            icon: "/static/assets/icons/small_image.svg",
            description: "",
            id: false
        }
    ]).then((exp) => {
        if (exp && exp.selected !== null) {
            fetch(`/auth/embedsize`,{method:"POST", body:JSON.stringify({
                largeImage:exp.selected
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                }

                fetchAccountData()
            })
        }
    })
}