# Tabuada Quest realtime server

Servidor Node.js + WebSocket para desenvolvimento multiplayer sem Firebase Blaze.

## Termux

```sh
pkg update
pkg install nodejs git
git clone https://github.com/juliano-souza-dev/tabuada-quest-2-dev.git
cd tabuada-quest-2-dev/server
npm install
npm start
```

O servidor escuta em `0.0.0.0:8080` e publica snapshots a 20 Hz.

Para jogar no mesmo Android em que o Termux está rodando, o cliente pode usar `ws://127.0.0.1:8080`.

Para outro celular ou PC na mesma rede Wi-Fi, troque `multiplayer.websocketURL` em `src/config/firebase-public.json` para `ws://IP_DO_ANDROID:8080`.

Teste de saúde no próprio Android:

```sh
curl http://127.0.0.1:8080/health
```

Firebase continua responsável por autenticação e persistência. Movimento, tiros e boss compartilhado passam pelo WebSocket. Se o WebSocket cair, o cliente mantém a navegação local e tenta reconectar a cada 3 segundos.
