"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NatsClient = void 0;
const nats_1 = require("nats");
const nats_2 = require("nats");
const nats_3 = require("nats");
const stream_1 = require("./impl/stream");
const internals_1 = require("./impl/internals");
const errors_1 = require("./helpers/errors");
const node_events_1 = require("node:events");
// -----------------------------------------------------------------------------
/**
 * Implements a connector to a NATS.io JetStream instance.
 * @class NatsClient
 */
class NatsClient extends node_events_1.EventEmitter {
    /**
     * Creates a new NATS.io/JetStream client object.
     * @async
     * @method create
     * @param {NatsClientOptions} opts - Configuration options.
     * @returns {NatsClient}
     */
    static create(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            let nkeySeed;
            // Validate options
            if (typeof opts !== 'object' || Array.isArray(opts)) {
                throw new Error('NatsClient: invalid configuration options');
            }
            // Validate servers list
            let servers = [];
            if (typeof opts.servers === 'string') {
                if (opts.servers.length == 0) {
                    throw new Error('NatsClient: invalid server(s) list provided');
                }
                servers = opts.servers.split(',').map((server) => server.trim());
            }
            else if (Array.isArray(opts.servers)) {
                opts.servers.forEach((server) => {
                    if (typeof server !== 'string') {
                        throw new Error('NatsClient: invalid server(s) list provided');
                    }
                    servers.push(...server.split(',').map((s) => s.trim()));
                });
            }
            else {
                throw new Error('NatsClient: invalid server(s) list provided');
            }
            if (servers.length == 0) {
                throw new Error('NatsClient: invalid server(s) list provided');
            }
            for (const server of servers) {
                if (server.length == 0) {
                    throw new Error('NatsClient: invalid server(s) list provided');
                }
            }
            // Validate access token (actually this acts as a user name)
            if (typeof opts.jwt !== 'string') {
                throw new Error('NatsClient: invalid credentials provided');
            }
            const parts = opts.jwt.split('.');
            if (parts.length !== 3 || parts[0].length == 0 || parts[1].length == 0 || parts[2].length == 0) {
                throw new Error('NatsClient: invalid credentials provided');
            }
            // Validate key seed (this is the "password")
            if (typeof opts.nkeySeed !== 'string' || opts.nkeySeed.length == 0) {
                throw new Error('NatsClient: invalid credentials provided');
            }
            try {
                nkeySeed = new Uint8Array(Buffer.from(opts.nkeySeed, 'utf8'));
            }
            catch (_err) {
                throw new Error('NatsClient: invalid credentials provided');
            }
            // Build TLS options
            let tls;
            if (opts.tls !== 'never') {
                if (opts.tls && opts.tls !== 'auto') {
                    if (opts.tls === 'enforce') {
                        tls = {
                            handshakeFirst: true
                        };
                    }
                    else if (typeof opts.tls === 'object' && (!Array.isArray(opts.tls))) {
                        tls = {
                            handshakeFirst: opts.tls.enforce || false,
                            certFile: opts.tls.certFile,
                            cert: opts.tls.cert,
                            caFile: opts.tls.caFile,
                            ca: opts.tls.ca,
                            keyFile: opts.tls.keyFile,
                            key: opts.tls.key
                        };
                    }
                    else {
                        throw new Error('NatsClient: invalid TLS settings');
                    }
                }
                else {
                    tls = {};
                }
            }
            // Connect to server
            const conn = yield (0, nats_3.connect)({
                servers,
                debug: opts.debug,
                authenticator: (0, nats_3.jwtAuthenticator)(opts.jwt, nkeySeed),
                maxReconnectAttempts: -1,
                reconnectTimeWait: 500,
                timeout: 10000,
                name: opts.name,
                noEcho: opts.enableEcho ? false : true,
                tls
            });
            // Get stream mamanger
            const jsm = yield conn.jetstreamManager();
            // Create and return our new
            return new NatsClient(opts.name, conn, jsm);
        });
    }
    ;
    /**
     * @constructor
     * @param {NatsConnection} conn - Established connection to server
     * @param {JetStreamManager} jsm - JetStream manager
     */
    constructor(_name, conn, jsm) {
        super();
        this._name = _name;
        this.conn = conn;
        this.jsm = jsm;
        this.internals = new internals_1.NatsClientSharedInternals();
        this.js = jsm.jetstream();
        this.statusMonitor();
    }
    /**
     * Gets the client name.
     * @property name
     */
    get name() {
        return this._name;
    }
    ;
    /**
     * Closes the connection to the server. Pending messages will be dropped.
     * @async
     * @method close
     */
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.internals.isClosed()) {
                // Destroy all stream subscriptions/consumers
                yield this.internals.close();
                // const done = this.conn.closed();
                // Close the connection
                yield this.conn.close();
                // await done;
            }
        });
    }
    /**
     * Delivers an ephemeral message.
     * @method publish
     * @param {string} subject - The message's topic.
     * @param {Uint8Array} message - The message to send
     * @param {NatsMessageHeaders} headers - Optional headers associated to the message.
     */
    publish(subject, message, headers) {
        if (this.internals.isClosed()) {
            throw new Error('NatsClient: Connection is closed');
        }
        // Configure publish options
        const publishOpts = {};
        if (headers) {
            publishOpts.headers = new nats_1.MsgHdrsImpl();
            for (const key in headers) {
                if (Object.prototype.hasOwnProperty.call(headers, key)) {
                    publishOpts.headers.set(key, headers[key]);
                }
            }
        }
        // Publish message
        this.conn.publish(subject, message, publishOpts);
    }
    /**
     * Creates a subscription for ephemeral messages based on the given subject.
     * @method subscribe
     * @param {string} subject - The topic to subscribe.
     * @param {NatsMessageCallback} cb - Asynchronous callback to call when a new message arrives.
     */
    subscribe(subject, cb) {
        if (this.internals.isClosed()) {
            throw new Error('NatsClient: Connection is closed');
        }
        // Check if a subscription already exists
        if (this.internals.hasSubscription(subject)) {
            throw new Error('NatsClient: Already subscribed');
        }
        // Create a new one
        const subscription = this.conn.subscribe(subject);
        this.internals.addSubscription(subscription);
        // Start a background worker that "listens" for incoming messages
        (() => __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            try {
                for (var _d = true, subscription_1 = __asyncValues(subscription), subscription_1_1; subscription_1_1 = yield subscription_1.next(), _a = subscription_1_1.done, !_a; _d = true) {
                    _c = subscription_1_1.value;
                    _d = false;
                    const m = _c;
                    if (this.internals.isClosed()) {
                        break;
                    }
                    const msg = {
                        subject: m.subject,
                        message: m.data
                    };
                    if (m.headers) {
                        msg.headers = {};
                        for (const [key, value] of m.headers) {
                            msg.headers[key] = value.length > 0 ? value[0] : '';
                        }
                    }
                    // Call callback
                    try {
                        yield cb(msg);
                    }
                    catch (_err) {
                        // Eat errors raised by the callback
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = subscription_1.return)) yield _b.call(subscription_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }))().catch(() => null).finally(() => {
            this.unsubscribe(subject);
        });
    }
    /**
     * Destroys an active subscription for ephemeral messages on the given subject.
     * It does not throw errors if the connection is closed or the subscription does not exists.
     * @method unsubscribe
     * @param {string} subject - The topic to unsubscribe.
     */
    unsubscribe(subject) {
        if (!this.internals.isClosed()) {
            // Find the subscription
            const subscription = this.internals.getAndRemoveSubscription(subject);
            if (subscription) {
                // Unsubscribe
                subscription.unsubscribe();
            }
        }
    }
    /**
     * Gets an existing JetStream stream.
     * @async
     * @method getStream
     * @param {string} name - Name of the message store.
     */
    getStream(name) {
        return __awaiter(this, void 0, void 0, function* () {
            let stream;
            if (this.internals.isClosed()) {
                throw new Error('NatsClient: Connection is closed');
            }
            // Validate options
            if (!/[0-9A-Za-z_-]/ui.test(name)) {
                throw new Error('NatsClient: invalid stream name');
            }
            // Get stream by name
            try {
                stream = yield this.jsm.streams.get(name);
            }
            catch (err) {
                // Change error if stream is not found
                if ((0, errors_1.isStreamNotFoundError)(err)) {
                    throw new Error('NatsClient: not found');
                }
                throw err;
            }
            // Wrap
            return new stream_1.NatsClientStreamImpl(stream, this.jsm, this.internals);
        });
    }
    /**
     * Creates a new JetStream stream.
     * @async
     * @method createStream
     * @param {string} name - Name of the message store.
     * @param {NatsStreamOptions} opts - Stream configuration options.
     */
    createStream(name, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            let doUpdate = false;
            if (this.internals.isClosed()) {
                throw new Error('NatsClient: Connection is closed');
            }
            // Validate options
            if (!/[0-9A-Za-z_-]/ui.test(name)) {
                throw new Error('NatsClient: invalid stream name');
            }
            let subjects;
            if (typeof opts.subjects === 'string') {
                subjects = [opts.subjects];
            }
            else if (Array.isArray(opts.subjects)) {
                subjects = opts.subjects;
            }
            else {
                throw new Error('NatsClient: invalid subjects in options');
            }
            ;
            if (typeof opts.duplicateWindowTimeoutMs !== 'undefined') {
                if (typeof opts.duplicateWindowTimeoutMs !== 'number' || opts.duplicateWindowTimeoutMs < 1) {
                    throw new Error('NatsClient: invalid duplicate window timeout in options');
                }
            }
            let existingAction = 'update';
            if (opts.existingAction === 'update' || opts.existingAction === 'keep' || opts.existingAction === 'fail') {
                existingAction = opts.existingAction;
            }
            else if (typeof opts.existingAction !== 'undefined') {
                throw new Error('NatsClient: invalid action if the stream already exists');
            }
            // Quick path, try to get an existing stream first
            try {
                const stream = yield this.getStream(name);
                if (stream) {
                    if (existingAction == 'keep') {
                        return stream;
                    }
                    if (existingAction == 'fail') {
                        throw new Error('NatsClient: Already exists');
                    }
                    doUpdate = true;
                }
            }
            catch (_err) {
                // Ignore errors
            }
            ;
            // Configure new stream settings
            const addUpdateOptions = Object.assign(Object.assign({ name }, (opts.description && opts.description.length > 0 && {
                description: opts.description
            })), { retention: (!opts.discardAckMessages) ? nats_2.RetentionPolicy.Limits : nats_2.RetentionPolicy.Workqueue, storage: nats_2.StorageType.File, max_consumers: -1, subjects, max_bytes: (_a = opts.maxStorageSizeInBytes) !== null && _a !== void 0 ? _a : 1024 * 1024 * 1024, discard: nats_2.DiscardPolicy.Old, deny_delete: (_b = opts.disallowDelete) !== null && _b !== void 0 ? _b : false, deny_purge: (_c = opts.disallowDelete) !== null && _c !== void 0 ? _c : false, duplicate_window: (0, nats_3.nanos)((opts.duplicateWindowTimeoutMs) ? opts.duplicateWindowTimeoutMs : 60 * 1000) // 1 minute
             });
            if (!doUpdate) {
                // Create stream
                try {
                    yield this.jsm.streams.add(addUpdateOptions);
                }
                catch (err) {
                    // Ignore error if the stream already exists
                    if (!(0, errors_1.isStreamAlreadyExistsError)(err)) {
                        throw err;
                    }
                    doUpdate = true;
                }
            }
            if (doUpdate) {
                // Update stream
                try {
                    yield this.jsm.streams.update(name, addUpdateOptions);
                }
                catch (err) {
                    // Change error if stream is not found
                    if ((0, errors_1.isStreamNotFoundError)(err)) {
                        throw new Error('NatsClient: not found');
                    }
                    throw err;
                }
            }
            // Done
            return yield this.getStream(name);
        });
    }
    /**
     * Deletes an existing JetStream stream.
     * It does not throw errors if the stream does not exists.
     * @async
     * @method deleteStream
     * @param {string} name - Name of the stream to delete.
     */
    deleteStream(name) {
        return __awaiter(this, void 0, void 0, function* () {
            let stream;
            try {
                stream = yield this.getStream(name);
            }
            catch (err) {
                if (err.message && err.message.indexOf('not found') >= 0) {
                    return;
                }
                throw err;
            }
            yield stream.delete();
        });
    }
    /**
     * Delivers a persistent message
     * @async
     * @method publishToStream
     * @param {string} subject - The message's topic.
     * @param {Uint8Array} message - The message to send
     * @param {NatsMessageHeaders} headers - Optional headers associated to the message.
     * @param {NatsStreamPublishOptions} opts - Extended message options.
     */
    publishToStream(subject, message, headers, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsClient: Connection is closed');
            }
            // Build message publish parameters based on the provided options
            const publishOpts = {};
            if (headers) {
                publishOpts.headers = new nats_1.MsgHdrsImpl();
                for (const key in headers) {
                    if (Object.prototype.hasOwnProperty.call(headers, key)) {
                        publishOpts.headers.set(key, headers[key]);
                    }
                }
            }
            if (opts) {
                if (opts.msgID) {
                    publishOpts.msgID = opts.msgID;
                }
                if (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 1) {
                    publishOpts.timeout = opts.timeoutMs;
                }
                if (opts.expectedLastMsgID) {
                    publishOpts.expect = {
                        lastMsgID: opts.expectedLastMsgID
                    };
                }
            }
            // Publish message
            const pa = yield this.js.publish(subject, message, publishOpts);
            // Return sequence number and other details
            return {
                sequence: pa.seq,
                duplicate: pa.duplicate
            };
        });
    }
    //--------------------------------------------------------------------------
    // Private methods
    /**
     * Raises events if the connection is up or down.
     * @async
     * @method statusMonitor
     */
    statusMonitor() {
        ((_that) => __awaiter(this, void 0, void 0, function* () {
            var _a, e_2, _b, _c;
            try {
                for (var _d = true, _e = __asyncValues(_that.conn.status()), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const s = _c;
                    if (_that.conn.isClosed()) {
                        break;
                    }
                    switch (s.type) {
                        case 'reconnect':
                            _that.emit('status', {
                                connection: 'connected'
                            });
                            break;
                        case 'disconnect':
                            _that.emit('status', {
                                connection: 'disconnected'
                            });
                            break;
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }))(this).catch((_err) => {
            console.log(_err);
        });
    }
}
exports.NatsClient = NatsClient;
;
//# sourceMappingURL=index.js.map