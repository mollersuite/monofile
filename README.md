<h1 align="center"><img src="./assets/icons/icon.svg" height="24"> monofile</h1>
<img src="http://fyle.uk/PHZUY">
<p align="center">The open-source, Discord-based file sharing service.<br><a href="https://fyle.uk">Flagship instance</a> &mdash; <a href="https://beta.fyle.uk">Live test instance</a></p>

<br>

## Setup

First, install monofile's prerequisites...
```
npm i
```

Then, add your bot token...
```
echo "TOKEN=INSERT-TOKEN.HERE" > .env
```
and, in addition, SMTP authentication...
```
echo "\nMAIL_USER=user@example.com" > .env
echo "\nMAIL_PASS=password here" > .env
```

Invite your bot to a server, and create a new `config.json` in the project root:
```js
// config.json
{
    "maxDiscordFiles": 20,
    "maxDiscordFileSize": 26214400,
    "targetGuild": "1024080490677936248",
    "targetChannel": "1024080525993971913",
    "requestTimeout":120000,
    "maxUploadIdLength":30,

    "accounts": {
        "registrationEnabled": true,
        "requiredForUpload": false
    },

    "webdrop": {
        "accountRequired": false
    },

    "mail": { // nodemailer transport options
        "host": "smtp.fastmail.com", // or your mail provider of choice
        "port": 465,
        "secure": true,
        "auth": {
            "user": "REPLACE-WITH-YOUR-ALIAS@YOURDOMAIN.COM",
            "pass": "REPLACE-WITH-YOUR-GENERATED-PASSWORD"
        }
    }
}
```

Then, compile:
```
tsc && sass src/style:out/style && rollup -c
```
and start.
```
npm start
```

monofile should now be running on either `env.MONOFILE_PORT` or port `3000`.

## Disclaimer

Although we believe monofile is not against Discord's developer terms of service, Etcetera is not liable if Discord takes action against you for running an instance.

## License

Code written by Etcetera is currently licensed under [Unlicense](./LICENSE).

Icons under `/assets/icons` were created by Microsoft, and as such are licensed under [different terms](./assets/icons/README.md) (MIT).
