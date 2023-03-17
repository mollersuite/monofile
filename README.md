# monofile
The open-source, Discord-based file sharing service.
[Live instance](https://fyle.uk)

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

Invite your bot to a server, then give it a channel to post in:
```json
config.json
--------------------------------------------
...
    "targetGuild": "1024080490677936248",
    "targetChannel": "1024080525993971913",
...
```

Then, compile and start.
```
tsc && npm start
```

monofile should now be running on either `env.MONOFILE_PORT` or port `3000`.

## Disclaimer

Although we believe monofile is not against Discord's developer terms of service, monofile's contributors are not liable if Discord takes action against you for running an instance.

## License

Code written by monofile's contributors is currently licensed under [Unlicense](https://github.com/nbitzz/monofile/blob/main/LICENSE).

Icons under `/assets/icons` were created by Microsoft, and as such are licensed under [different terms](https://github.com/nbitzz/monofile/blob/1.3.0/assets/icons/README.md).