import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import Conveyor from '../index.js';

class Socket {
    static OPEN = 1;
    static CLOSED = 3;
    static instances = [];
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; Socket.instances.push(this); }
    send(data) { assert.equal(this.readyState, Socket.OPEN); this.sent.push(data); }
    open() { this.readyState = 1; this.onopen({ type: 'open' }); }
    close(code, reason) { this.code = code; this.reason = reason; this.readyState = 3; this.onclose({ type: 'close' }); }
}
let timers;
let originalSocket;
beforeEach(() => {
    originalSocket = globalThis.WebSocket;
    globalThis.WebSocket = Socket;
    Socket.instances = [];
    timers = new Map();
    let id = 0;
    mock.method(globalThis, 'setInterval', (fn) => { timers.set(++id, fn); return id; });
    mock.method(globalThis, 'setTimeout', (fn) => { timers.set(++id, fn); return id; });
    mock.method(globalThis, 'clearInterval', (key) => timers.delete(key));
    mock.method(globalThis, 'clearTimeout', (key) => timers.delete(key));
});
afterEach(() => { globalThis.WebSocket = originalSocket; mock.restoreAll(); });

test('default URL and startup are idempotent; connecting sends are ignored', () => {
    const c = new Conveyor();
    assert.equal(c.ws.url, 'ws://127.0.0.1:8000');
    c.start(); c.rawSend('early');
    assert.equal(Socket.instances.length, 1);
    c.ws.open(); c.ws.onerror(new Error('ignored by default')); c.send('hello');
    assert.deepEqual(JSON.parse(c.ws.sent[0]), { action: 'base-action', data: 'hello' });
    timers.get(c.heartBeatInterval)();
    assert.deepEqual([...c.ws.sent[1]], [137, 0]);
    c.close(); assert.equal(timers.size, 0);
    c.rawSend('closed');
});

test('URL encodes auth token and supports query with or without auth', () => {
    for (const [options, suffix] of [
        [{ token: 'a&? #', query: 'x=1' }, '?token=a%26%3F%20%23&x=1'],
        [{ token: 'a' }, '?token=a'], [{ query: 'x=1' }, '?x=1'],
    ]) {
        const c = new Conveyor({ ...options, protocol: 'wss', uri: 'example.com', port: 443 });
        assert.equal(c.ws.url, `wss://example.com:443${suffix}`); c.close();
    }
});

test('open associates user and channel before ready; repeated heartbeat replaces timer', () => {
    let ready = false;
    const c = new Conveyor({ userId: 7, channel: 'chat', token: 'secret', onReady: () => { ready = true; } });
    c.ws.open();
    assert.equal(ready, true);
    assert.deepEqual(c.ws.sent.map(JSON.parse), [
        { action: 'assoc-user-to-fd-action', userId: 7 },
        { action: 'channel-connect', channel: 'chat', auth: 'secret' },
    ]);
    c.startHeartBeat(); assert.equal(timers.size, 1); c.close();
});

test('disabled heartbeat and no channel send nothing', () => {
    const c = new Conveyor({ heartBeat: false }); c.ws.open();
    assert.equal(timers.size, 0); assert.deepEqual(c.ws.sent, []); c.close();
});

test('messages dispatch raw payload, data and descriptor; malformed payload reports errors', () => {
    const errors = []; const raw = []; const messages = [];
    const c = new Conveyor({ onError: e => errors.push(e), onRawMessage: e => raw.push(e), onMessage: (...args) => messages.push(args) });
    c.ws.onmessage({ data: '{"data":"hello","fd":12}' });
    assert.deepEqual(raw, ['{"data":"hello","fd":12}']); assert.deepEqual(messages, [['hello', 12]]);
    for (const data of ['{', 'null', '42', '[]']) c.ws.onmessage({ data });
    assert.equal(errors.length, 4);
    c.ws.onerror(new Error('transport')); assert.equal(errors.length, 5); c.close();
});

test('acknowledgements correlate IDs and retain only the latest twenty messages', () => {
    const c = new Conveyor({ acknowledge: true }); c.ws.open();
    for (let i = 0; i < 21; i++) c.send(i, 'custom');
    assert.equal(c.messages.length, 20); assert.equal(c.messages[0].data.data, 1);
    const id = c.messages[0].id;
    assert.match(id, /^[\da-f-]{36}$/);
    c.ws.onmessage({ data: JSON.stringify({ data: id }) });
    assert.equal(c.messages[0].ack, true); assert.equal(c.messages[1].ack, false); c.close();
});

test('disconnect clears heartbeat and deduplicates reconnect; stale close cannot destroy new socket', () => {
    let closed = 0;
    const c = new Conveyor({ reconnect: true, onCloseCallback: () => closed++ });
    const old = c.ws; old.open(); old.close();
    assert.equal(closed, 1); assert.equal(c.ws, null);
    timers.get(c.healthCheckInterval)();
    assert.equal(timers.size, 2);
    const callback = timers.get(c.reconnectTimeout); timers.delete(c.reconnectTimeout); callback();
    const next = c.ws; next.open(); old.onclose({});
    assert.equal(c.ws, next); assert.equal(closed, 1);
    timers.get(c.healthCheckInterval)(); assert.equal(c.reconnectTimeout, null);
    c.close(1001, 'done'); assert.equal(next.code, 1001); assert.equal(next.reason, 'done');
    assert.equal(timers.size, 0);
});

test('close cancels pending reconnect and works after remote close', () => {
    const c = new Conveyor({ reconnect: true }); c.ws.close(); c.close();
    assert.equal(timers.size, 0); c.onClose(); assert.equal(timers.size, 0);
});

test('custom open and close handlers retain explicit lifecycle control', () => {
    let opened = false; let closed = false;
    const c = new Conveyor({ onOpen: () => { opened = true; }, onClose: () => { closed = true; } });
    c.ws.open(); c.close(); assert.equal(opened, true); assert.equal(closed, true);
});


test('ignored acknowledged sends do not generate IDs or evict transmitted history', () => {
    const c = new Conveyor({ acknowledge: true });
    c.send('connecting');
    assert.deepEqual(c.messages, []);
    c.ws.open();
    for (let i = 0; i < 20; i++) c.send(i);
    const history = structuredClone(c.messages);
    c.ws.close();
    for (let i = 0; i < 21; i++) c.send('disconnected');
    assert.deepEqual(c.messages, history);
    c.close();
});
