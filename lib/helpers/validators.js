"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSubject = void 0;
const regexPart = /^[0-9A-Za-z_-]{1,32}$/iu;
// -----------------------------------------------------------------------------
const validateSubject = (subject, allowWildcards) => {
    if (typeof subject !== 'string') {
        return false;
    }
    const parts = subject.split('.');
    for (let idx = 0; idx < parts.length; idx++) {
        if (parts[idx] == '>') {
            if ((!allowWildcards) || idx != parts.length - 1) {
                return false;
            }
        }
        else if (parts[idx] == '*') {
            if (!allowWildcards) {
                return false;
            }
        }
        else {
            if (!regexPart.test(parts[idx])) {
                return false;
            }
        }
    }
    return true;
};
exports.validateSubject = validateSubject;
//# sourceMappingURL=validators.js.map