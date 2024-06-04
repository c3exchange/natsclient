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
exports.NatsClientConsumerImpl = void 0;
const nats_1 = require("nats");
const errors_1 = require("../helpers/errors");
// -----------------------------------------------------------------------------
class NatsClientConsumerImpl {
    constructor(name, consumer, internals) {
        this.name = name;
        this.consumer = consumer;
        this.internals = internals;
        // this.name = 'consumer' + this.internals.getNextId();
    }
    /**
     * @inheritdoc
     */
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsClient: Connection is closed');
            }
            // Delete consumer
            try {
                yield this.consumer.delete();
            }
            catch (err) {
                // Ignore error if message is not found
                if (!(0, errors_1.isStreamConsumerNotFoundError)(err)) {
                    throw err;
                }
            }
        });
    }
    /**
     * @inheritdoc
     */
    subscribe(cb) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsClient: Connection is closed');
            }
            // Check if a subscription already exists
            if (this.internals.hasConsumerSubscription(this.name)) {
                throw new Error('NatsClient: Already subscribed');
            }
            // Start consuming messages
            const consumerMessages = yield this.consumer.consume();
            this.internals.addConsumerSubscription(this.name, consumerMessages);
            ((consumerMessages) => __awaiter(this, void 0, void 0, function* () {
                var _a, consumerMessages_1, consumerMessages_1_1;
                var _b, e_1, _c, _d;
                try {
                    for (_a = true, consumerMessages_1 = __asyncValues(consumerMessages); consumerMessages_1_1 = yield consumerMessages_1.next(), _b = consumerMessages_1_1.done, !_b; _a = true) {
                        _d = consumerMessages_1_1.value;
                        _a = false;
                        const m = _d;
                        if (this.internals.isClosed()) {
                            break;
                        }
                        const msg = {
                            subject: m.subject,
                            message: m.data,
                            sequence: m.seq,
                            timestamp: new Date((0, nats_1.millis)(m.info.timestampNanos)),
                            ack: () => {
                                if (!this.internals.isClosed()) {
                                    m.ack();
                                }
                            },
                            nak: (millis) => {
                                if (!this.internals.isClosed()) {
                                    m.nak(millis);
                                }
                            }
                        };
                        if (m.headers) {
                            msg.headers = {};
                            for (const [key, value] of m.headers) {
                                msg.headers[key] = value.length > 0 ? value[0] : '';
                            }
                        }
                        // Call callback
                        try {
                            const ret = yield cb(msg);
                            if (typeof ret === 'boolean' && (!this.internals.isClosed())) {
                                if (ret) {
                                    m.ack();
                                }
                                else {
                                    m.nak();
                                }
                            }
                        }
                        catch (_err) {
                            // Eat errors raised by the callback but tell the server that
                            // processing failed.
                            if (!this.internals.isClosed()) {
                                m.nak();
                            }
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_a && !_b && (_c = consumerMessages_1.return)) yield _c.call(consumerMessages_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }))(consumerMessages).catch((_err) => {
                // console.error(_err);
            }).finally(() => {
                this.unsubscribe();
            });
        });
    }
    /**
     * @inheritdoc
     */
    unsubscribe() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.internals.isClosed()) {
                // Find the subscription
                const consumerMessages = this.internals.getAndRemoveConsumerSubscription(this.name);
                if (consumerMessages) {
                    // Unsubscribe
                    try {
                        yield consumerMessages.close();
                    }
                    catch (_err) {
                        // Ingore errors
                    }
                }
            }
        });
    }
}
exports.NatsClientConsumerImpl = NatsClientConsumerImpl;
;
//# sourceMappingURL=consumer.js.map