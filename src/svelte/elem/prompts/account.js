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
                            optPicker.picker(`${response.status} ${response.statusText}`,[])
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
                    optPicker.picker(`${response.status} ${response.statusText}`,[])
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
                    optPicker.picker(`${response.status} ${response.statusText}`,[])
                } else {
                    optPicker.picker(`Please follow the instructions sent to your inbox.`,[])
                }
            })
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
                    optPicker.picker(`${response.status} ${response.statusText}`,[])
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
                    optPicker.picker(`${response.status} ${response.statusText}`,[])
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
                    optPicker.picker(`${response.status} ${response.statusText}`,[])
                }

                fetchAccountData()
                refreshNeeded.set(true);
            })
        }
    })
}