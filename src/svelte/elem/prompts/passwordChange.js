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
            name: "OK",
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