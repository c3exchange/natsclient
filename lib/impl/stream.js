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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NatsClientStreamImpl = void 0;
const nats_1 = require("nats");
const consumer_1 = require("./consumer");
const errors_1 = require("../helpers/errors");
// -----------------------------------------------------------------------------
class NatsClientStreamImpl {
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
                throw new Error('NatsClient: Connection is closed');
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
                    throw new Error('NatsClient: not found');
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
    delete() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsClient: Connection is closed');
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
                throw new Error('NatsClient: Connection is closed');
            }
            // Get stream and message
            try {
                m = yield this.stream.getMessage({
                    seq: sequence
                });
            }
            catch (err) {
                // Change error if message is not found
                if ((0, errors_1.isStreamMessageNotFoundError)(err)) {
                    throw new Error('NatsClient: not found');
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
                throw new Error('NatsClient: Connection is closed');
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
                throw new Error('NatsClient: Connection is closed');
            }
            // Validate options
            if (!/[0-9A-Za-z_-]/ui.test(name)) {
                throw new Error('NatsClient: invalid consumer name');
            }
            // Get consumer by name
            let consumer;
            try {
                consumer = yield this.js.consumers.get(this.stream.name, name);
            }
            catch (err) {
                // Change error if stream is not found
                if ((0, errors_1.isStreamNotFoundError)(err)) {
                    throw new Error('NatsClient: not found');
                }
                throw err;
            }
            // Wrap
            return new consumer_1.NatsClientConsumerImpl(name, consumer, this.internals);
        });
    }
    /**
     * @inheritdoc
     */
    createConsumer(name, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            let doUpdate = false;
            if (this.internals.isClosed()) {
                throw new Error('NatsClient: Connection is closed');
            }
            // Validate options
            if (!/[0-9A-Za-z_-]/ui.test(name)) {
                throw new Error('NatsClient: invalid consumer name');
            }
            let existingAction = 'update';
            if (opts.existingAction === 'update' || opts.existingAction === 'keep' || opts.existingAction === 'fail') {
                existingAction = opts.existingAction;
            }
            else if (typeof opts.existingAction !== 'undefined') {
                throw new Error('NatsClient: invalid action if the stream already exists');
            }
            // Quick path, try to get an existing consumer first
            try {
                const consumer = yield this.getConsumer(name);
                if (consumer) {
                    if (existingAction == 'keep') {
                        return consumer;
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
            // Configure the consumer settings
            const addUpdateOptions = {
                name,
                durable_name: name,
                ack_policy: nats_1.AckPolicy.Explicit,
                deliver_policy: nats_1.DeliverPolicy.New,
                filter_subject: opts.subjectFilter,
                max_ack_pending: -1
            };
            if (typeof opts.deliverPolicy === 'string') {
                switch (opts.deliverPolicy) {
                    case 'new':
                        break;
                    case 'last':
                        addUpdateOptions.deliver_policy = nats_1.DeliverPolicy.Last;
                        break;
                    case 'all':
                        addUpdateOptions.deliver_policy = nats_1.DeliverPolicy.All;
                        break;
                    case 'sequence':
                        addUpdateOptions.deliver_policy = nats_1.DeliverPolicy.StartSequence;
                        if (typeof opts.deliverStartSequence !== 'number' || opts.deliverStartSequence < 0) {
                            throw new Error('NatsClient: Invalid delivery start sequence number in options');
                        }
                        addUpdateOptions.opt_start_seq = opts.deliverStartSequence;
                        break;
                    case 'time':
                        addUpdateOptions.deliver_policy = nats_1.DeliverPolicy.StartTime;
                        if (!(opts.deliverStartTime && opts.deliverStartTime instanceof Date)) {
                            throw new Error('NatsClient: Invalid delivery start sequence number in options');
                        }
                        addUpdateOptions.opt_start_time = opts.deliverStartTime.toISOString();
                        break;
                    case 'subject-last':
                        addUpdateOptions.deliver_policy = nats_1.DeliverPolicy.LastPerSubject;
                        break;
                    default:
                        throw new Error('NatsClient: Invalid delivery policy in options');
                }
            }
            else if (typeof opts.deliverPolicy !== 'undefined' && opts.deliverPolicy !== 'new') {
                throw new Error('NatsClient: Invalid delivery policy in options');
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
                        throw new Error('NatsClient: not found');
                    }
                    throw err;
                }
            }
            // Done
            return this.getConsumer(name);
        });
    }
    /**
     * @inheritdoc
     */
    deleteConsumer(name) {
        return __awaiter(this, void 0, void 0, function* () {
            let consumer;
            try {
                consumer = yield this.getConsumer(name);
            }
            catch (err) {
                if (err.message && err.message.indexOf('not found') >= 0) {
                    return;
                }
                throw err;
            }
            yield consumer.delete();
        });
    }
}
exports.NatsClientStreamImpl = NatsClientStreamImpl;
;
//# sourceMappingURL=stream.js.map