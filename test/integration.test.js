import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import Conveyor from '../index.js';

test('native WebSocket exchanges Conveyor envelopes over a real loopback connection', { timeout: 5000 }, async () => {
    const server = createServer();
    const sockets = new Set();
    let client;
    const received = new Promise((resolve, reject) => {
        server.on('upgrade', (request, socket) => {
            sockets.add(socket);
            socket.on('error', reject);
            const accept = createHash('sha1').update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
            socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
            let buffer = Buffer.alloc(0);
            socket.on('data', chunk => {
                buffer = Buffer.concat([buffer, chunk]);
                if (buffer.length < 6) return;
                const length = buffer[1] & 127;
                if (buffer.length < 6 + length) return;
                try {
                    assert.equal(buffer[0], 0x81);
                    assert.ok(buffer[1] & 0x80);
                    const payload = Buffer.from(buffer.subarray(6, 6 + length));
                    for (let i = 0; i < length; i++) payload[i] ^= buffer[2 + i % 4];
                    resolve(JSON.parse(payload));
                    const reply = Buffer.from(JSON.stringify({ data: 'reply', fd: 9 }));
                    socket.write(Buffer.concat([Buffer.from([0x81, reply.length]), reply]));
                } catch (error) { reject(error); }
            });
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const reply = new Promise((resolve, reject) => {
            client = new Conveyor({ port: server.address().port, heartBeat: false,
                onReady: () => client.send('hello', 'echo'),
                onMessage: (data, fd) => resolve({ data, fd }), onError: reject });
        });
        assert.deepEqual(await received, { action: 'echo', data: 'hello' });
        assert.deepEqual(await reply, { data: 'reply', fd: 9 });
    } finally {
        client?.close();
        for (const socket of sockets) socket.destroy();
        await new Promise(resolve => server.close(resolve));
    }
});
