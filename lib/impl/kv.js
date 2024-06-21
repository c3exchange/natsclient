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
exports.KvBucketImpl = void 0;
const errors_1 = require("../helpers/errors");
// -----------------------------------------------------------------------------
/**
 * @inheritdoc
 */
class KvBucketImpl {
    constructor(kv, internals) {
        this.kv = kv;
        this.internals = internals;
    }
    /**
     * @inheritdoc
     */
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Delete bucket
            try {
                yield this.kv.destroy();
            }
            catch (err) {
                // Ignore error if the bucket is not found
                if (!(0, errors_1.isStreamNotFoundError)(err)) {
                    throw err;
                }
            }
        });
    }
    /**
     * @inheritdoc
     */
    has(key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Get the entry to check if it present
            const entry = yield this.kv.get(key);
            return (entry) ? true : false;
        });
    }
    /**
     * @inheritdoc
     */
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Get entry and return its value
            const entry = yield this.kv.get(key);
            if (!entry) {
                return null;
            }
            // Done
            return {
                value: entry.value,
                timestamp: entry.created,
                sequence: entry.revision
            };
        });
    }
    /**
     * @inheritdoc
     */
    put(key, value, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Configure the put command
            const putOptions = {};
            if (opts) {
                if (typeof opts.sequence !== 'undefined') {
                    putOptions.previousSeq = opts.sequence;
                }
            }
            // Store value
            let seq;
            try {
                seq = yield this.kv.put(key, value, putOptions);
            }
            catch (err) {
                if ((0, errors_1.isLastSequenceMismatchError)(err)) {
                    throw new Error('NatsJetstreamClient: last sequence mismatch');
                }
                throw err;
            }
            // Return sequence number
            return seq;
        });
    }
    /**
     * @inheritdoc
     */
    del(key, opts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            // Configure the delete command
            const deleteOptions = {};
            if (opts) {
                if (typeof opts.sequence !== 'undefined') {
                    deleteOptions.previousSeq = opts.sequence;
                }
            }
            // Delete/purge key
            try {
                if (opts === null || opts === void 0 ? void 0 : opts.purge) {
                    yield this.kv.purge(key, deleteOptions);
                }
                else {
                    yield this.kv.delete(key, deleteOptions);
                }
            }
            catch (err) {
                if ((0, errors_1.isLastSequenceMismatchError)(err)) {
                    throw new Error('NatsJetstreamClient: last sequence mismatch');
                }
                throw err;
            }
        });
    }
    /**
     * @inheritdoc
     */
    keys(filter) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            if (this.internals.isClosed()) {
                throw new Error('NatsJetstreamClient: connection is closed');
            }
            const res = [];
            const iter = yield this.kv.keys(filter);
            try {
                for (var _d = true, iter_1 = __asyncValues(iter), iter_1_1; iter_1_1 = yield iter_1.next(), _a = iter_1_1.done, !_a; _d = true) {
                    _c = iter_1_1.value;
                    _d = false;
                    const key = _c;
                    res.push(key);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = iter_1.return)) yield _b.call(iter_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            // Done
            return res;
        });
    }
}
exports.KvBucketImpl = KvBucketImpl;
;
//# sourceMappingURL=kv.js.map