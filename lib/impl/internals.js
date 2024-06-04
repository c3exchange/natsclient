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
exports.NatsClientSharedInternals = void 0;
// -----------------------------------------------------------------------------
class NatsClientSharedInternals {
    constructor() {
        this.subscriptions = new Map();
        this.consumerSubscriptions = new Map();
        this.closed = false;
        this.nextId = 0;
    }
    isClosed() {
        return this.closed;
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.closed = true;
            // Destroy all stream subscriptions/consumers
            for (const [_, consumerMessages] of this.consumerSubscriptions) {
                try {
                    yield consumerMessages.close();
                }
                catch (_) {
                    // Ingore errors
                }
            }
            this.consumerSubscriptions.clear();
            // Destroy all subscriptions
            for (const [_, subscription] of this.subscriptions) {
                subscription.unsubscribe();
            }
            this.subscriptions.clear();
        });
    }
    getNextId() {
        this.nextId += 1;
        if (this.nextId > 9007199254740991) {
            this.nextId = 1;
        }
        return this.nextId.toString();
    }
    hasSubscription(subject) {
        return this.subscriptions.has(subject);
    }
    addSubscription(subscription) {
        this.subscriptions.set(subscription.getSubject(), subscription);
    }
    getAndRemoveSubscription(subject) {
        const subscription = this.subscriptions.get(subject);
        if (subscription) {
            this.subscriptions.delete(subject);
        }
        return subscription;
    }
    hasConsumerSubscription(consumerName) {
        return this.consumerSubscriptions.has(consumerName);
    }
    addConsumerSubscription(consumerName, consumerMessages) {
        this.consumerSubscriptions.set(consumerName, consumerMessages);
    }
    getAndRemoveConsumerSubscription(consumerName) {
        const consumerMessages = this.consumerSubscriptions.get(consumerName);
        if (consumerMessages) {
            this.consumerSubscriptions.delete(consumerName);
        }
        return consumerMessages;
    }
}
exports.NatsClientSharedInternals = NatsClientSharedInternals;
//# sourceMappingURL=internals.js.map