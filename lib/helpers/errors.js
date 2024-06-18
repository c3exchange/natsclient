"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLastSequenceMismatchError = exports.isLastMsgIdMismatchError = exports.isStreamConsumerAlreadyExistsError = exports.isStreamConsumerNotFoundError = exports.isStreamMessageNotFoundError = exports.isStreamAlreadyExistsError = exports.isStreamNotFoundError = void 0;
const isStreamNotFoundError = (err) => {
    var _a;
    return ((_a = err.api_error) === null || _a === void 0 ? void 0 : _a.err_code) === 10059;
};
exports.isStreamNotFoundError = isStreamNotFoundError;
const isStreamAlreadyExistsError = (err) => {
    var _a;
    return ((_a = err.api_error) === null || _a === void 0 ? void 0 : _a.err_code) === 10058;
};
exports.isStreamAlreadyExistsError = isStreamAlreadyExistsError;
const isStreamMessageNotFoundError = (err) => {
    var _a;
    return ((_a = err.api_error) === null || _a === void 0 ? void 0 : _a.err_code) === 10037;
};
exports.isStreamMessageNotFoundError = isStreamMessageNotFoundError;
const isStreamConsumerNotFoundError = (err) => {
    var _a;
    return ((_a = err.api_error) === null || _a === void 0 ? void 0 : _a.err_code) === 10014;
};
exports.isStreamConsumerNotFoundError = isStreamConsumerNotFoundError;
const isStreamConsumerAlreadyExistsError = (err) => {
    var _a, _b;
    return ((_a = err.api_error) === null || _a === void 0 ? void 0 : _a.err_code) === 10013 || ((_b = err.api_error) === null || _b === void 0 ? void 0 : _b.err_code) === 10105;
};
exports.isStreamConsumerAlreadyExistsError = isStreamConsumerAlreadyExistsError;
const isLastMsgIdMismatchError = (err) => {
    var _a;
    return ((_a = err.api_error) === null || _a === void 0 ? void 0 : _a.err_code) === 10070;
};
exports.isLastMsgIdMismatchError = isLastMsgIdMismatchError;
const isLastSequenceMismatchError = (err) => {
    var _a;
    return ((_a = err.api_error) === null || _a === void 0 ? void 0 : _a.err_code) === 10071;
};
exports.isLastSequenceMismatchError = isLastSequenceMismatchError;
//# sourceMappingURL=errors.js.map