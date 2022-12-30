let FileUpload = document.createElement("input")
FileUpload.setAttribute("type","file")

document.getElementById("uploadButton").addEventListener("click",() => FileUpload.click())

FileUpload.addEventListener("input",() => {
    if (FileUpload.files[0]) {
        let opt = getOptionsForUploading()
        let file = FileUpload.files[0]

        updateBtnTxt("Uploading file. This may take a while, so stay put.")

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

        let fd = new FormData()
        fd.append('file',file)
        
        xmlhttp.open("POST","/upload")
        xmlhttp.setRequestHeader("monofile-upload-id",opt.uploadId)
        xmlhttp.send(fd)

    }
})