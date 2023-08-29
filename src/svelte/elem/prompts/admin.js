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
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                }

            })
        }
    })
}

export function chgOwner(optPicker) {
    optPicker.picker("Transfer file ownership",[
        {
            name: "File ID",
            icon: "/static/assets/icons/file.svg",
            id: "file",
            inputSettings: {}
        },
        {
            name: "New owner",
            icon: "/static/assets/icons/person.svg",
            id: "owner",
            inputSettings: {}
        },
        {
            name: "Transfer file ownership",
            icon: "/static/assets/icons/update.svg",
            description: "This will transfer the file to this user",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/admin/transfer`,{method:"POST", body:JSON.stringify({
                owner: exp.owner,
                target: exp.file
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                }

            })
        }
    })
}

export function chgId(optPicker) {
    optPicker.picker("Change file ID",[
        {
            name: "Target file",
            icon: "/static/assets/icons/file.svg",
            id: "file",
            inputSettings: {}
        },
        {
            name: "New ID",
            icon: "/static/assets/icons/admin/change_file_id.svg",
            id: "new",
            inputSettings: {}
        },
        {
            name: "Update",
            icon: "/static/assets/icons/update.svg",
            description: "File will not be available at its old ID",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/admin/idchange`,{method:"POST", body:JSON.stringify({
                target: exp.file,
                new: exp.new
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                }

            })
        }
    })
}

export function delFile(optPicker) {
    optPicker.picker("Delete file",[
        {
            name: "File ID",
            icon: "/static/assets/icons/file.svg",
            id: "file",
            inputSettings: {}
        },
        {
            name: "Delete",
            icon: "/static/assets/icons/admin/delete_file.svg",
            description: "This can't be undone",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/admin/delete`,{method:"POST", body:JSON.stringify({
                target: exp.file
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                }

            })
        }
    })
}

export function elevateUser(optPicker) {
    optPicker.picker("Elevate user",[
        {
            name: "Username",
            icon: "/static/assets/icons/person.svg",
            id: "user",
            inputSettings: {}
        },
        {
            name: "Elevate to admin",
            icon: "/static/assets/icons/update.svg",
            description: "",
            id: true
        }
    ]).then((exp) => {
        if (exp && exp.selected) {
            fetch(`/admin/elevate`,{method:"POST", body:JSON.stringify({
                target: exp.user
            })}).then((response) => {
                
                if (response.status != 200) {
                    optPicker.picker(`${response.status} ${response.headers.get("x-backup-status-message") || response.statusText || ""}`,[])
                }

            })
        }
    })
}

// im really lazy so i just stole this from account.js

export function deleteAccount(optPicker) {
    optPicker.picker("What should we do with the target account's files?",[
        {
            name: "Delete files",
            icon: "/static/assets/icons/admin/delete_file.svg",
            description: "Files will be permanently deleted",
            id: true
        },
        {
            name: "Do nothing",
            icon: "/static/assets/icons/file.svg",
            description: "Files will not be affected",
            id: false
        }
    ]).then((exp) => {
        if (exp) {
            let deleteFiles = exp.selected

            optPicker.picker(`Enter the target account's username to continue.`,[
                {
                    name: "Enter account username",
                    icon: "/static/assets/icons/person.svg",
                    inputSettings: {},
                    id:"username"
                },
                {
                    name: "Optional reason",
                    icon: "/static/assets/icons/more.svg",
                    inputSettings: {},
                    id:"reason"
                },
                {
                    name: `Delete account ${deleteFiles ? "& its files" : ""}`,
                    icon: "/static/assets/icons/delete_account.svg",
                    description: `This cannot be undone.`,
                    id: true
                }
            ]).then((fin) => {
                if (fin && fin.selected) {
                    fetch(`/admin/delete_account`,{method:"POST", body:JSON.stringify({
                        target: fin.username,
                        reason: fin.reason,
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