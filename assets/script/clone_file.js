document.getElementById("uploadButton").addEventListener("click",() => {
    let ask = prompt("Input a URL to clone.")

    if (ask) {
        let opt = getOptionsForUploading()
        updateBtnTxt("Requesting clone. Please wait.")

        let xmlhttp = new XMLHttpRequest()

        xmlhttp.addEventListener("error",function(e) {
            updateBtnTxt(`Upload failed.<br/>${e.toString()}`)
            console.error(e)
        })

        xmlhttp.addEventListener("load",function() {
            if (xmlhttp.status == 200) {
                document.getElementById("CopyTB").value = `https://${location.hostname}/download/${xmlhttp.responseText}`
                updateBtnTxt(`Upload complete.<br/><a style="color:blue;font-family:monospace;" href="javascript:document.getElementById('CopyTB').focus();document.getElementById('CopyTB').select();document.execCommand('copy');document.getElementById('CopyTB').blur();">Copy URL</a> <a style="color:blue;font-family:monospace;" href="javascript:prompt('This is your download URL.', document.getElementById('CopyTB').value);null">View URL</a>`)
            } else {
                updateBtnTxt(`Upload failed.<br/>${xmlhttp.responseText}`)
            }
        })
        
        xmlhttp.open("POST","/clone")
        xmlhttp.send(JSON.stringify({
            url: ask,
            ...opt
        }))
    }
})