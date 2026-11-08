<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./imgs/conveyor-logo-dark.svg">
    <img src="./imgs/conveyor-logo-light.svg" alt="Socket Conveyor — socket-conveyor-client" width="240">
  </picture>
</p>

# socket-conveyor-client

Dependency-free JavaScript client for [Socket Conveyor](https://github.com/firebrikdotcom/socket-conveyor).
The 2.0.0 release uses native ES modules and the standard WebSocket API.

## Requirements and installation

Use a modern browser with ES modules and WebSocket. Acknowledgements additionally
require `crypto.randomUUID()` (a secure context in browsers). Node consumers need
a global WebSocket implementation; Node 22+ provides it. Development and coverage
checks use Node 22+ and npm. CI checks supported Node 22, 24 and 26 releases.
No package-level Node engine floor is imposed on browser consumers.

```sh
npm install socket-conveyor-client
```

## Usage

In a bundler or Node ES module:

```js
import Conveyor from 'socket-conveyor-client';

const connection = new Conveyor({
    uri: '127.0.0.1',
    port: 8181,
    channel: 'actions-channel',
    onMessage: (data, fd) => console.log(data, fd),
    onReady: () => connection.send('Welcome!'),
    onError: (error) => console.error(error),
});

// Later, release the socket and all timers (without reconnecting).
// connection.close();
```

This connects to `ws://127.0.0.1:8181` and subscribes to `actions-channel`.
Serve browser examples over HTTP; a direct `<script type="module">` can import
`./node_modules/socket-conveyor-client/index.js` instead of the bare package name.
Use `protocol: 'wss'` and the server's TLS port on HTTPS pages.
Render untrusted message text using `textContent`, rather than `innerHTML`.

## Options

| Option | Default | Purpose |
| --- | --- | --- |
| `protocol`, `uri`, `port` | `'ws'`, `'127.0.0.1'`, `8000` | Connection address |
| `token` | `null` | URL-encoded connection token; also used for channel auth |
| `query` | `''` | Additional already-encoded query string, without `?` |
| `channel` | `null` | Channel to join on open |
| `userId` | `null` | Associate user on open |
| `acknowledge` | `false` | Add UUIDs; retain acknowledgement status for last 20 sends in `messages` |
| `reconnect`, `reconnectDelay` | `false`, `5000` | Reconnect after an unexpected close; milliseconds |
| `healthCheckInterval` | `3000` | Reconnect health poll interval in milliseconds |
| `heartBeat`, `heartBeatInterval` | `true`, `10000` | Send Conveyor's legacy binary heartbeat payload `[137, 0]`; milliseconds |
| `onReady` | no-op | Called after user/channel setup and heartbeat start |
| `onMessage` | no-op | Receives parsed `data` and `fd` |
| `onRawMessage` | no-op | Receives original JSON text |
| `onError` | no-op | Transport errors or invalid JSON/message-object errors |
| `onCloseCallback` | no-op | Observes close events without replacing lifecycle handling |
| `onOpen`, `onClose` | internal handlers | Advanced overrides: replacements must explicitly invoke lifecycle methods if needed |

`send(message, action = 'base-action')` sends a JSON action envelope.
`rawSend(message)` sends only while OPEN; sends while connecting or closed are
ignored, without buffering. `connectChannel()` and `assocUser(userId)` send the
corresponding protocol actions. `close(code = 1000, reason = '')` stops reconnection
and clears timers. Malformed incoming messages call `onError` and are not delivered.
The heartbeat is application data, not a WebSocket control ping.
The historical README's `listen`, `setOption` and `onReconnectCallback` were never
implemented and are not supported options/methods.

## Migrating from 1.2.9

Version 2 declares `type: module`, matching the existing `export default` source.
Use ESM `import` or dynamic `import()` from CommonJS. Auth tokens are now escaped,
so supply the original token rather than a pre-encoded value. Connecting sends are
ignored instead of throwing; malformed messages reach `onError`. Disconnects clear
heartbeat timers and only schedule one retry. Connection URLs are no longer logged.

## Development and release

```sh
npm ci --ignore-scripts
npm run lint
npm test
npm run test:coverage
npm pack --dry-run
npm publish --dry-run --ignore-scripts
```

Coverage checks require at least 95% lines/functions and 90% branches for `index.js`.
Tests include socket lifecycle, wire envelopes, acknowledgement tracking, timers,
URL encoding, invalid input, and a native WebSocket loopback handshake.

The npm package identity remains `socket-conveyor-client`; the registry lists
`savioresende` as maintainer. No publishing workflow existed. CI deliberately
validates only; it cannot publish. After candidate approval, an authorized maintainer
can run the checks, `npm pack`, inspect the tarball, then publish that exact tarball
using `npm publish ./socket-conveyor-client-2.0.0.tgz` and create tag `v2.0.0`.
Registry permissions/2FA must be verified by that maintainer before publishing.

## License

MIT. Copyright © 2022 Savio Resende. See [LICENSE](./LICENSE).
