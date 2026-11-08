
class Conveyor {
    constructor(options) {
        this.options = {
            protocol: 'ws',
            uri: '127.0.0.1',
            port: 8000,
            token: null,
            query: '',
            channel: null,
            onOpen: (e) => this.onOpen(e),
            onReady: () => {},
            onMessage: () => {},
            onRawMessage: () => {},
            onClose: (e) => this.onClose(e),
            onCloseCallback: () => {},
            onError: () => {},
            reconnect: false,
            reconnectDelay: 5000,
            heartBeat: true,
            heartBeatInterval: 10000,
            healthCheckInterval: 3000,
            userId: null,
            acknowledge: false,
            ...options
        };

        this.ws = null;
        this.messages = [];
        this.stopped = false;
        this.start();

        if (this.options.reconnect) {
            this.healthCheckInterval = setInterval(() => {
                if (this.isClosed()) {
                    this.scheduleReconnect();
                }
            }, this.options.healthCheckInterval);
        }
    }

    isClosed() {
        return !this.ws || this.ws.readyState === WebSocket.CLOSED;
    }

    start() {
        if (!this.isClosed()) {
            return;
        }

        this.stopped = false;
        let url = `${this.options.protocol}://${this.options.uri}:${this.options.port}`;

        if (this.options.token) url += `?token=${encodeURIComponent(this.options.token)}`;
        if (this.options.token && this.options.query.length > 0) url += `&${this.options.query}`;
        if (!this.options.token && this.options.query.length > 0) url += `?${this.options.query}`;

        this.ws = new WebSocket(url);
        this.bindEvents();
    }

    bindEvents() {
        this.ws.onopen = this.options.onOpen;
        const socket = this.ws;
        this.ws.onclose = (e) => {
            if (this.ws === socket) this.options.onClose(e);
        };
        this.ws.onerror = this.options.onError;
        this.ws.onmessage = (e) => this.baseOnMessage(e);
    }

    onOpen(e) {
        if (this.options.userId !== null) {
            this.assocUser(this.options.userId);
        }
        this.connectChannel();
        this.startHeartBeat();
        this.options.onReady();
    }

    onClose(e) {
        clearInterval(this.heartBeatInterval);
        if (this.ws) {
            this.ws = null;
        }

        this.options.onCloseCallback(e);
        this.scheduleReconnect();
    }

    scheduleReconnect() {
        if (!this.options.reconnect || this.stopped || this.reconnectTimeout) return;
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.start();
        }, this.options.reconnectDelay);
    }

    close(code = 1000, reason = '') {
        this.stopped = true;
        clearInterval(this.healthCheckInterval);
        clearInterval(this.heartBeatInterval);
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
        if (this.ws) this.ws.close(code, reason);
    }

    baseOnMessage(e) {
        let parsedData;
        try {
            parsedData = JSON.parse(e.data);
            if (parsedData === null || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
                throw new TypeError('Expected a JSON message object');
            }
        } catch (error) {
            this.options.onError(error);
            return;
        }

        if (this.options.acknowledge) {
            this.messages.map((message, index) => {
                if (parsedData.data === message.id) {
                    this.messages[index].ack = true;
                }
            });
        }

        this.options.onRawMessage(e.data);
        this.options.onMessage(parsedData.data, parsedData.fd);
    }

    send(message, action = 'base-action') {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        let data = {
            action,
            data: message,
        };

        if (!this.options.acknowledge) {
            this.rawSend(JSON.stringify(data));
            return;
        }

        data.id = crypto.randomUUID();

        if (this.messages.length >= 20) this.messages.shift();

        this.messages.push({
            id: data.id,
            data,
            ack: false,
        });

        this.rawSend(JSON.stringify(data));
    }

    rawSend(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        this.ws.send(message);
    }

    connectChannel() {
        if (this.options.channel === null) {
            return;
        }

        this.rawSend(JSON.stringify({
            action: 'channel-connect',
            channel: this.options.channel,
            auth: this.options.token,
        }));
    }

    assocUser(userId) {
        this.rawSend(JSON.stringify({
            action: 'assoc-user-to-fd-action',
            userId,
        }));
    }

    startHeartBeat() {
        clearInterval(this.heartBeatInterval);
        if (!this.options.heartBeat) {
            return;
        }

        this.heartBeatInterval = setInterval(() => {
            const pingFrame = new Uint8Array(2);
            pingFrame[0] = 0x89;
            pingFrame[1] = 0x00;
            this.rawSend(pingFrame);
        }, this.options.heartBeatInterval);
    }
}

export default Conveyor;
