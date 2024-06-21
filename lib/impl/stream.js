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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamImpl = void 0;
const nats = __importStar(require("nats"));
const consumer_1 = require("./consumer");
const errors_1 = require("../helpers/errors");
const validators_1 = require("../helpers/validators");
// -----------------------------------------------------------------------------
/**
 * @inheritdoc
 */
class StreamImpl {
    constructor(stream, jsm, internals) {
        this.stream = stream;
        this.jsm = jsm;
        this.internals = internals;
        this.js = this.jsm.jetstream();
    }
    /**
     * @inheritdoc
     */
    info() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Get stream information
            let si;
            try {
                si = yield this.stream.info(false, {
                    deleted_details: false
                });
            }
            catch (err) {
                // Change error if message is not found
                if ((0, errors_1.isStreamMessageNotFoundError)(err)) {
                    throw new Error('NatsJetstreamClient: not found');
                }
                throw err;
            }
            // Build info
            return {
                messages: si.state.messages,
                bytes: si.state.bytes,
                firstSequence: si.state.first_seq,
                firstTimestamp: new Date(si.state.first_ts),
                lastSequence: si.state.last_seq,
                lastTimestamp: new Date(si.state.last_ts)
            };
        });
    }
    /**
     * @inheritdoc
     */
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Delete stream
            try {
                yield this.jsm.streams.delete(this.stream.name);
            }
            catch (err) {
                // Ignore error if message is not found
                if (!(0, errors_1.isStreamNotFoundError)(err)) {
                    throw err;
                }
            }
        });
    }
    /**
     * @inheritdoc
     */
    getMessage(sequence) {
        return __awaiter(this, void 0, void 0, function* () {
            let m;
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Get stream and message
            try {
                m = yield this.stream.getMessage({
                    seq: sequence
                });
            }
            catch (err) {
                // Return null if message is not found
                if ((0, errors_1.isStreamMessageNotFoundError)(err)) {
                    return null;
                }
                throw err;
            }
            // Create result
            const msg = {
                subject: m.subject,
                message: m.data,
                sequence: m.seq,
                timestamp: m.time,
            };
            if (m.header) {
                msg.headers = {};
                for (const [key, value] of m.header) {
                    msg.headers[key] = value.length > 0 ? value[0] : '';
                }
            }
            // Done
            return msg;
        });
    }
    /**
     * @inheritdoc
     */
    deleteMessage(sequence) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Delete message
            try {
                yield this.stream.deleteMessage(sequence, true);
            }
            catch (err) {
                // Ignore error if message is not found
                if (!(0, errors_1.isStreamMessageNotFoundError)(err)) {
                    throw err;
                }
            }
        });
    }
    /**
     * @inheritdoc
     */
    getConsumer(name) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Validate options
            if (!/[0-9A-Za-z_-]/ui.test(name)) {
                throw new Error('NatsJetstreamClient: invalid consumer name');
            }
            // Get consumer by name
            let consumer;
            try {
                consumer = yield this.js.consumers.get(this.stream.name, name);
            }
            catch (err) {
                // Return null if consumer is not found
                if ((0, errors_1.isStreamConsumerNotFoundError)(err)) {
                    return null;
                }
                throw err;
            }
            // Wrap
            return new consumer_1.ConsumerImpl(name, consumer, this.internals);
        });
    }
    /**
     * @inheritdoc
     */
    createConsumer(name, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            let doUpdate = false;
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Validate options
            if (!/[0-9A-Za-z_-]/ui.test(name)) {
                throw new Error('NatsJetstreamClient: invalid consumer name');
            }
            if (typeof opts !== 'object' || Array.isArray(opts)) {
                throw new Error('NatsJetstreamClient: invalid consumer options');
            }
            let existingAction = 'update';
            if (opts.existingAction === 'update' || opts.existingAction === 'keep' || opts.existingAction === 'fail') {
                existingAction = opts.existingAction;
            }
            else if (typeof opts.existingAction !== 'undefined') {
                throw new Error('NatsJetstreamClient: invalid action if the stream already exists');
            }
            let filter_subjects;
            if (typeof opts.subjectFilters !== 'undefined') {
                if (typeof opts.subjectFilters === 'string') {
                    filter_subjects = [opts.subjectFilters];
                }
                else if (Array.isArray(opts.subjectFilters)) {
                    filter_subjects = opts.subjectFilters;
                }
                else {
                    throw new Error('NatsJetstreamClient: invalid consumer\'s filter subject');
                }
                for (const subject of filter_subjects) {
                    if (!(0, validators_1.validateSubject)(subject, true)) {
                        throw new Error('NatsJetstreamClient: invalid consumer\'s filter subject');
                    }
                }
            }
            // Quick path, try to get an existing consumer first
            try {
                const consumer = yield this.getConsumer(name);
                if (consumer) {
                    if (existingAction == 'keep') {
                        return consumer;
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
            // Configure the consumer settings
            const addUpdateOptions = {
                name,
                durable_name: name,
                ack_policy: nats.AckPolicy.Explicit,
                deliver_policy: nats.DeliverPolicy.All,
                filter_subjects,
                max_ack_pending: -1
            };
            if (typeof opts.deliverPolicy === 'string') {
                switch (opts.deliverPolicy) {
                    case 'all':
                        break;
                    case 'new':
                        addUpdateOptions.deliver_policy = nats.DeliverPolicy.New;
                        break;
                    case 'last':
                        addUpdateOptions.deliver_policy = nats.DeliverPolicy.Last;
                        break;
                    case 'sequence':
                        addUpdateOptions.deliver_policy = nats.DeliverPolicy.StartSequence;
                        if (typeof opts.deliverStartSequence !== 'number' || opts.deliverStartSequence < 0) {
                            throw new Error('NatsJetstreamClient: invalid delivery start sequence number in options');
                        }
                        addUpdateOptions.opt_start_seq = opts.deliverStartSequence;
                        break;
                    case 'time':
                        addUpdateOptions.deliver_policy = nats.DeliverPolicy.StartTime;
                        if (!(opts.deliverStartTime && opts.deliverStartTime instanceof Date)) {
                            throw new Error('NatsJetstreamClient: invalid delivery start sequence number in options');
                        }
                        addUpdateOptions.opt_start_time = opts.deliverStartTime.toISOString();
                        break;
                    case 'subject-last':
                        addUpdateOptions.deliver_policy = nats.DeliverPolicy.LastPerSubject;
                        break;
                    default:
                        throw new Error('NatsJetstreamClient: invalid delivery policy in options');
                }
            }
            else if (typeof opts.deliverPolicy !== 'undefined' && opts.deliverPolicy !== 'new') {
                throw new Error('NatsJetstreamClient: invalid delivery policy in options');
            }
            if (!doUpdate) {
                // Create consumer
                try {
                    yield this.jsm.consumers.add(this.stream.name, addUpdateOptions);
                }
                catch (err) {
                    // Ignore error if the consumer already exists
                    if (!(0, errors_1.isStreamConsumerAlreadyExistsError)(err)) {
                        throw err;
                    }
                    doUpdate = true;
                }
            }
            if (doUpdate) {
                // Update stream
                try {
                    yield this.jsm.consumers.update(this.stream.name, name, addUpdateOptions);
                }
                catch (err) {
                    // Change error if stream is not found
                    if ((0, errors_1.isStreamConsumerNotFoundError)(err)) {
                        throw new Error('NatsJetstreamClient: unexpected not found');
                    }
                    throw err;
                }
            }
            // Done
            const consumer = yield this.getConsumer(name);
            if (!consumer) {
                throw new Error('NatsJetstreamClient: unexpected not found');
            }
            return consumer;
        });
    }
    /**
     * @inheritdoc
     */
    destroyConsumer(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const consumer = yield this.getConsumer(name);
            if (consumer) {
                yield consumer.destroy();
            }
        });
    }
    /**
     * @inheritdoc
     */
    subscribeConsumer(name, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Get the consumer
            const consumer = yield this.getConsumer(name);
            if (!consumer) {
                throw new Error('NatsJetstreamClient: consumer not found');
            }
            // And subscribe
            yield consumer.subscribe(cb);
        });
    }
    /**
     * @inheritdoc
     */
    unsubscribeConsumer(name) {
        return __awaiter(this, void 0, void 0, function* () {
            // Shortcut for getting the consumer and unsubscribing it
            if (!this.internals.isClosed()) {
                // Find the subscription
                const consumerMessages = this.internals.getAndRemoveConsumerSubscription(name);
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
exports.StreamImpl = StreamImpl;
;
//# sourceMappingURL=stream.js.map