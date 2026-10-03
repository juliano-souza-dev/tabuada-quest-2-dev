# Tabuada Quest multiplayer server

Authoritative multiplayer mutations run in Firebase Cloud Functions.

## Endpoints

- `ensureBoss`: creates the shared boss state atomically.
- `bossDamage`: authenticates the Firebase ID token and applies boss damage in a Realtime Database transaction. Repeated `shotId` values are ignored.

Clients can still read room state and write only their own presence/movement record. Direct client writes to `bosses` and `events` are denied by Realtime Database rules.

## Deploy

From the repository root, with the Firebase CLI authenticated for project `tabuadaquest2`:

```sh
npm install -g firebase-tools
firebase use tabuadaquest2
firebase deploy --only functions,database
```

Cloud Functions use Node 20 and region `southamerica-east1`.

Do not place service-account keys in this repository. Cloud Functions use Firebase Admin application-default credentials.
