import { ConsumerMessages, Subscription } from 'nats';

// -----------------------------------------------------------------------------

export class NatsClientSharedInternals {
	private subscriptions = new Map<string, Subscription>();
	private consumerSubscriptions = new Map<string, ConsumerMessages>();
	private closed = false;
	private nextId = 0;

	public isClosed(): boolean {
		return this.closed;
	}

	public async close(): Promise<void> {
		this.closed = true;

		// Destroy all stream subscriptions/consumers
		for (const [_, consumerMessages] of this.consumerSubscriptions) {
			try {
				await consumerMessages.close();
			}
			catch (_: any) {
				// Ingore errors
			}
		}
		this.consumerSubscriptions.clear();

		// Destroy all subscriptions
		for (const [_, subscription] of this.subscriptions) {
			subscription.unsubscribe();
		}
		this.subscriptions.clear();
	}

	public getNextId(): string {
		this.nextId += 1;
		if (this.nextId > 9007199254740991) {
			this.nextId = 1;
		}
		return this.nextId.toString();
	}

	public hasSubscription(subject: string): boolean {
		return this.subscriptions.has(subject);
	}

	public addSubscription(subscription: Subscription): void {
		this.subscriptions.set(subscription.getSubject(), subscription);
	}

	public getAndRemoveSubscription(subject: string): Subscription | undefined {
		const subscription = this.subscriptions.get(subject);
		if (subscription) {
			this.subscriptions.delete(subject);
		}
		return subscription;
	}

	public hasConsumerSubscription(consumerName: string): boolean {
		return this.consumerSubscriptions.has(consumerName);
	}

	public addConsumerSubscription(consumerName: string, consumerMessages: ConsumerMessages): void {
		this.consumerSubscriptions.set(consumerName, consumerMessages);
	}

	public getAndRemoveConsumerSubscription(consumerName: string): ConsumerMessages | undefined {
		const consumerMessages = this.consumerSubscriptions.get(consumerName);
		if (consumerMessages) {
			this.consumerSubscriptions.delete(consumerName);
		}
		return consumerMessages;
	}
}