"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
exports.Client = void 0;
const nats = __importStar(require("nats"));
__exportStar(require("./types"), exports);
const stream_1 = require("./impl/stream");
const internals_1 = require("./impl/internals");
const errors_1 = require("./helpers/errors");
const node_events_1 = require("node:events");
const kv_1 = require("./impl/kv");
const validators_1 = require("./helpers/validators");
// -----------------------------------------------------------------------------
/**
 * Implements a connector to a NATS.io JetStream instance.
 * @class Client
 */
class Client extends node_events_1.EventEmitter {
    /**
     * Creates a new NATS.io/JetStream client object.
     * @async
     * @method create
     * @param {ClientOptions} opts - Configuration options.
     * @returns {Client} - The client accessor.
     */
    static create(opts) {
        return __awaiter(this, void 0, void 0, function* () {
            const auth = {};
            // Validate options
            if (typeof opts !== 'object' || Array.isArray(opts)) {
                throw new Error('NatsJetstreamClient: invalid configuration options');
            }
            // Validate servers list
            let servers = [];
            if (typeof opts.servers === 'string') {
                if (opts.servers.length == 0) {
                    throw new Error('NatsJetstreamClient: invalid server(s) list provided');
                }
                servers = opts.servers.split(',').map((server) => server.trim());
            }
            else if (Array.isArray(opts.servers)) {
                opts.servers.forEach((server) => {
                    if (typeof server !== 'string') {
                        throw new Error('NatsJetstreamClient: invalid server(s) list provided');
                    }
                    servers.push(...server.split(',').map((s) => s.trim()));
                });
            }
            else {
                throw new Error('NatsJetstreamClient: invalid server(s) list provided');
            }
            if (servers.length == 0) {
                throw new Error('NatsJetstreamClient: invalid server(s) list provided');
            }
            for (const server of servers) {
                if (server.length == 0) {
                    throw new Error('NatsJetstreamClient: invalid server(s) list provided');
                }
            }
            // Validate credentials
            if (typeof opts.credentials !== 'object' || Array.isArray(opts.credentials)) {
                throw new Error('NatsJetstreamClient: invalid credentials provided');
            }
            if (typeof opts.credentials.token === 'string') {
                const cred = opts.credentials;
                if (cred.token.length == 0) {
                    throw new Error('NatsJetstreamClient: invalid credentials provided');
                }
                auth.token = cred.token;
            }
            else if (typeof opts.credentials.jwt === 'string') {
                let nkeySeed;
                const cred = opts.credentials;
                const parts = cred.jwt.split('.');
                if (parts.length !== 3 || parts[0].length == 0 || parts[1].length == 0 || parts[2].length == 0) {
                    throw new Error('NatsJetstreamClient: invalid credentials provided');
                }
                // Validate key seed
                if (typeof cred.nkeySeed !== 'string' || cred.nkeySeed.length == 0) {
                    throw new Error('NatsJetstreamClient: invalid credentials provided');
                }
                try {
                    nkeySeed = new Uint8Array(Buffer.from(cred.nkeySeed, 'utf8'));
                }
                catch (_err) {
                    throw new Error('NatsJetstreamClient: invalid credentials provided');
                }
                // Create JWT authenticator
                auth.authenticator = nats.jwtAuthenticator(cred.jwt, nkeySeed);
            }
            else if (typeof opts.credentials.username === 'string') {
                const cred = opts.credentials;
                if (typeof cred.password !== 'string' || cred.username.length == 0 || cred.password.length == 0) {
                    throw new Error('NatsJetstreamClient: invalid credentials provided');
                }
                auth.user = cred.username;
                auth.pass = cred.password;
            }
            else {
                throw new Error('NatsJetstreamClient: invalid credentials provided');
            }
            // Build TLS options
            let tls;
            if (opts.tls !== 'never') {
                if (opts.tls && opts.tls !== 'auto') {
                    if (opts.tls === 'always') {
                        tls = {
                            handshakeFirst: true
                        };
                    }
                    else if (typeof opts.tls === 'object' && (!Array.isArray(opts.tls))) {
                        tls = {
                            handshakeFirst: opts.tls.enforce === true,
                            certFile: opts.tls.certFile,
                            cert: opts.tls.cert,
                            caFile: opts.tls.caFile,
                            ca: opts.tls.ca,
                            keyFile: opts.tls.keyFile,
                            key: opts.tls.key
                        };
                    }
                    else {
                        throw new Error('NatsJetstreamClient: invalid TLS settings');
                    }
                }
                else {
                    tls = {};
                }
            }
            // Connect to server
            const conn = yield nats.connect(Object.assign(Object.assign({ servers, debug: opts.debug }, auth), { maxReconnectAttempts: -1, reconnectTimeWait: 500, timeout: 10000, name: opts.name, noEcho: opts.enableEcho ? false : true, tls, ignoreAuthErrorAbort: false, reconnect: true }));
            // Get stream mamanger
            const jsm = yield conn.jetstreamManager();
            // Create and return our new
            return new Client(opts.name, conn, jsm);
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
        this.js = jsm.jetstream();
        this.internals = new internals_1.SharedInternals(this.conn);
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
     * @param {MessageHeaders} headers - Optional headers associated to the message.
     */
    publish(subject, message, headers) {
        if (this.internals.isClosed()) {
            throw new Error('NatsJetstreamClient: connection is closed');
        }
        // Validate subject
        if (!(0, validators_1.validateSubject)(subject, false)) {
            throw new Error('NatsJetstreamClient: invalid subject');
        }
        // Configure publish options
        const publishOpts = {};
        if (headers) {
            publishOpts.headers = new nats.MsgHdrsImpl();
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
     * @async
     * @param {string} subject - The topic to subscribe.
     * @param {MessageCallback} cb - Asynchronous callback to call when a new message arrives.
     */
    subscribe(subject, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Validate subject
            if (!(0, validators_1.validateSubject)(subject, true)) {
                throw new Error('NatsJetstreamClient: invalid subject');
            }
            // Check if a subscription already exists
            if (this.internals.hasSubscription(subject)) {
                throw new Error('NatsJetstreamClient: already subscribed');
            }
            // Promisify callback
            const wrappedCb = (msg) => {
                try {
                    const result = cb(msg);
                    return Promise.resolve(result);
                }
                catch (err) {
                    return Promise.reject(err);
                }
            };
            // Create a new one
            const subscription = this.conn.subscribe(subject);
            this.internals.addSubscription(subscription);
            // Start a background worker that "listens" for incoming messages
            ((_that) => __awaiter(this, void 0, void 0, function* () {
                var _a, e_1, _b, _c;
                try {
                    for (var _d = true, subscription_1 = __asyncValues(subscription), subscription_1_1; subscription_1_1 = yield subscription_1.next(), _a = subscription_1_1.done, !_a; _d = true) {
                        _c = subscription_1_1.value;
                        _d = false;
                        const m = _c;
                        if (_that.internals.isClosed()) {
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
                            yield wrappedCb(msg);
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
            }))(this).catch(() => null).finally(() => {
                this.unsubscribe(subject);
            });
            // Ensure the subscription message is sent before retuning
            yield this.conn.flush();
        });
    }
    /**
     * Destroys an active subscription for ephemeral messages on the given subject.
     * It does not throw errors if the connection is closed or the subscription does not exists.
     * @async
     * @method unsubscribe
     * @param {string} subject - The topic to unsubscribe.
     */
    unsubscribe(subject) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.internals.isClosed()) {
                // Find the subscription
                const subscription = this.internals.getAndRemoveSubscription(subject);
                if (subscription) {
                    // Unsubscribe
                    subscription.unsubscribe();
                    // Ensure the unsubscription message is sent before retuning
                    yield this.conn.flush();
                }
            }
        });
    }
    /**
     * Gets an existing JetStream stream.
     * @async
     * @method getStream
     * @param {string} name - Name of the message store.
     * @returns {Stream} - The stream accessor.
     */
    getStream(name) {
        return __awaiter(this, void 0, void 0, function* () {
            let stream;
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Validate options
            if (!/[0-9A-Za-z_-]/ui.test(name)) {
                throw new Error('NatsJetstreamClient: invalid stream name');
            }
            // Get stream by name
            try {
                stream = yield this.jsm.streams.get(name);
            }
            catch (err) {
                // Return null if stream is not found
                if ((0, errors_1.isStreamNotFoundError)(err)) {
                    return null;
                }
                throw err;
            }
            // Wrap
            return new stream_1.StreamImpl(stream, this.jsm, this.internals);
        });
    }
    /**
     * Creates a new JetStream stream.
     * @async
     * @method createStream
     * @param {string} name - Name of the message store.
     * @param {StreamOptions} opts - Stream configuration options.
     * @returns {Stream} - The stream accessor.
     */
    createStream(name, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            let doUpdate = false;
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Validate options
            if (!/[0-9A-Za-z_-]/ui.test(name)) {
                throw new Error('NatsJetstreamClient: invalid stream name');
            }
            let subjects;
            if (typeof opts.subjects === 'string') {
                subjects = [opts.subjects];
            }
            else if (Array.isArray(opts.subjects)) {
                subjects = opts.subjects;
            }
            else {
                throw new Error('NatsJetstreamClient: invalid subjects in options');
            }
            ;
            // Validate subjects
            for (const subject of subjects) {
                if (!(0, validators_1.validateSubject)(subject, true)) {
                    throw new Error('NatsJetstreamClient: invalid subject');
                }
            }
            if (typeof opts.duplicateWindowTimeoutMs !== 'undefined') {
                if (typeof opts.duplicateWindowTimeoutMs !== 'number' || opts.duplicateWindowTimeoutMs < 1) {
                    throw new Error('NatsJetstreamClient: invalid duplicate window timeout in options');
                }
            }
            let existingAction = 'update';
            if (opts.existingAction === 'update' || opts.existingAction === 'keep' || opts.existingAction === 'fail') {
                existingAction = opts.existingAction;
            }
            else if (typeof opts.existingAction !== 'undefined') {
                throw new Error('NatsJetstreamClient: invalid action if the stream already exists');
            }
            // Quick path, try to get an existing stream first
            try {
                const stream = yield this.getStream(name);
                if (stream) {
                    if (existingAction == 'keep') {
                        return stream;
                    }
                    if (existingAction == 'fail') {
                        throw new Error('NatsJetstreamClient: already exists');
                    }
                    doUpdate = true;
                }
            }
            catch (_err) {
                // Ignore errors
            }
            ;
            // Configure new stream settings
            const addUpdateOptions = Object.assign(Object.assign(Object.assign(Object.assign({ name }, (opts.description && opts.description.length > 0 && {
                description: opts.description
            })), { retention: (!opts.discardAckMessages) ? nats.RetentionPolicy.Limits : nats.RetentionPolicy.Workqueue, storage: nats.StorageType.File, max_consumers: -1, subjects, max_bytes: (_a = opts.maxStorageSizeInBytes) !== null && _a !== void 0 ? _a : 1024 * 1024 * 1024, discard: nats.DiscardPolicy.Old, deny_delete: (_b = opts.disallowDelete) !== null && _b !== void 0 ? _b : false, deny_purge: (_c = opts.disallowDelete) !== null && _c !== void 0 ? _c : false, duplicate_window: nats.nanos((opts.duplicateWindowTimeoutMs) ? opts.duplicateWindowTimeoutMs : 60 * 1000) }), (opts.numReplicas && {
                num_replicas: opts.numReplicas
            })), ((opts.cluster || opts.tags) && {
                cluster: opts.cluster,
                tags: opts.tags
            }));
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
                        throw new Error('NatsJetstreamClient: unexpected not found');
                    }
                    throw err;
                }
            }
            // Done
            const stream = yield this.getStream(name);
            if (!stream) {
                throw new Error('NatsJetstreamClient: unexpected not found');
            }
            return stream;
        });
    }
    /**
     * Deletes an existing JetStream stream.
     * It does not throw errors if the stream does not exists.
     * @async
     * @method destroyStream
     * @param {string} name - Name of the stream to delete.
     */
    destroyStream(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const stream = yield this.getStream(name);
            if (stream) {
                yield stream.destroy();
            }
        });
    }
    /**
     * Gets an existing KV bucket.
     * @async
     * @method getKvBucket
     * @param {string} name - Name of the bucket.
     * @returns {KvBucket} - The KeyValue bucket accessor.
     */
    getKvBucket(name) {
        return __awaiter(this, void 0, void 0, function* () {
            let kv;
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Validate options
            if (!/[0-9A-Za-z_-]/ui.test(name)) {
                throw new Error('NatsJetstreamClient: invalid bucket name');
            }
            // Get bucket by name
            try {
                // We must verify if the underlying stream does exist because the javascript SDK does not do it :(
                yield this.jsm.streams.get('KV_' + name);
                kv = yield this.js.views.kv(name, {
                    streamName: 'KV_' + name,
                    codec: (0, internals_1.NoopKvCodecs)(),
                    bindOnly: true
                });
            }
            catch (err) {
                // Return null if bucket is not found
                if ((0, errors_1.isStreamNotFoundError)(err)) {
                    return null;
                }
                throw err;
            }
            // Wrap
            return new kv_1.KvBucketImpl(kv, this.internals);
        });
    }
    /**
     * Creates a new KV bucket.
     * @async
     * @method createKvBucket
     * @param {string} name - Name of the bucket.
     * @param {KvBucketOptions} opts - Bucket configuration options.
     * @returns {KvBucket} - The KeyValue bucket accessor.
     */
    createKvBucket(name, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            let kv;
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Validate options
            if (!/[0-9A-Za-z_-]/ui.test(name)) {
                throw new Error('NatsJetstreamClient: invalid bucket name');
            }
            // Configure new bucket settings
            const createBucketOptions = Object.assign({ streamName: 'KV_' + name, codec: (0, internals_1.NoopKvCodecs)(), allow_direct: false, max_bytes: (opts && opts.maxStorageSizeInBytes) ? opts.maxStorageSizeInBytes : 1024 * 1024 }, (opts && Object.assign(Object.assign(Object.assign(Object.assign({}, (opts.description && opts.description.length > 0 && {
                description: opts.description
            })), { history: opts.maxHistory, ttl: opts.ttl, storage: nats.StorageType.File }), (opts.numReplicas && {
                replicas: opts.numReplicas
            })), ((opts.cluster || opts.tags) && {
                cluster: opts.cluster,
                tags: opts.tags
            }))));
            // Create bucket
            try {
                kv = yield this.js.views.kv(name, createBucketOptions);
            }
            catch (err) {
                // Change error if bucket is not found
                if ((0, errors_1.isStreamNotFoundError)(err)) {
                    throw new Error('NatsJetstreamClient: unexpected not found');
                }
                throw err;
            }
            // Wrap
            return new kv_1.KvBucketImpl(kv, this.internals);
        });
    }
    /**
     * Deletes an existing KV bucket.
     * It does not throw errors if the bucket does not exists.
     * @async
     * @method destroyKvBucket
     * @param {string} name - Name of the bucket to delete.
     */
    destroyKvBucket(name) {
        return __awaiter(this, void 0, void 0, function* () {
            // A KV bucket is a special stream with a given prefix
            return this.destroyStream('KV_' + name);
        });
    }
    /**
     * Delivers a persistent message
     * @async
     * @method publishToStream
     * @param {string} subject - The message's topic.
     * @param {Uint8Array} message - The message to send
     * @param {MessageHeaders} headers - Optional headers associated to the message.
     * @param {StreamPublishOptions} opts - Extended message options.
     * @returns {StreamPublishedInfo} - Published message details.
     */
    publishToStream(subject, message, headers, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Validate subject
            if (!(0, validators_1.validateSubject)(subject, false)) {
                throw new Error('NatsJetstreamClient: invalid subject');
            }
            // Build message publish parameters based on the provided options
            const publishOpts = {};
            if (headers) {
                publishOpts.headers = new nats.MsgHdrsImpl();
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
            let pa;
            try {
                pa = yield this.js.publish(subject, message, publishOpts);
            }
            catch (err) {
                if ((0, errors_1.isLastMsgIdMismatchError)(err)) {
                    throw new Error('NatsJetstreamClient: last message id mismatch');
                }
                if ((0, errors_1.isLastSequenceMismatchError)(err)) {
                    throw new Error('NatsJetstreamClient: last sequence mismatch');
                }
                throw err;
            }
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
                            _that.emit('status', 'connected');
                            break;
                        case 'disconnect':
                            _that.emit('status', 'disconnected');
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
exports.Client = Client;
;
//# sourceMappingURL=index.js.map