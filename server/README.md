# Tabuada Quest authoritative realtime server

Servidor Node.js + WebSocket responsável pela verdade canônica do mundo quando o jogador está online.

## Contrato de autoridade

- **Online:** Node/WebSocket é autoridade de jogadores remotos, NPCs, bosses e demais entidades dinâmicas migradas para o protocolo.
- **Offline:** o cliente mantém uma instância local independente do mundo.
- **Reconexão:** a instância online volta a ser carregada do servidor. O estado dinâmico offline não é mesclado com o mundo online.
- **Firebase:** fica como ponte para autenticação, conteúdo canônico e persistência do progresso do jogador. Firebase não simula o mundo realtime.

O progresso persistente do jogador continua local-first. Compras, munições, navios, canhões, itens e recompensas são gravados no cache da conta e sincronizados com Firebase quando a conexão estiver disponível.

## Termux

```sh
pkg update
pkg install nodejs git
git clone https://github.com/juliano-souza-dev/tabuada-quest-2-dev.git
cd tabuada-quest-2-dev/server
npm install
npm start
```

Após atualizar o repositório:

```sh
cd ~/tabuada-quest-2-dev
git pull
cd server
npm install
npm start
```

O servidor escuta em `0.0.0.0:8080` e publica snapshots a 20 Hz.

Para desenvolvimento no mesmo aparelho:

```
ws://127.0.0.1:8080
```

Para outro aparelho na mesma rede, use o IP do host. Em produção o cliente usa o endpoint configurado em `src/config/firebase-public.json`.

## Health

```sh
curl http://127.0.0.1:8080/health
```

Exemplo com mundo ativo:

```json
{"ok":true,"rooms":1,"players":2,"entities":6,"uptime":120}
```

`rooms: 0` significa que o processo está vivo, mas nenhum cliente entrou em uma sala WebSocket.
