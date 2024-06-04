import { NatsClientConsumer, NatsStreamMessageAck, NatsStreamMessageCallback } from '../types';
import { Consumer, millis } from 'nats';
import { isStreamConsumerNotFoundError } from '../helpers/errors';
import { NatsClientSharedInternals } from './internals';

// -----------------------------------------------------------------------------

export class NatsClientConsumerImpl implements NatsClientConsumer {
	constructor(private name: string, private consumer: Consumer, private internals: NatsClientSharedInternals) {
		// this.name = 'consumer' + this.internals.getNextId();
	}

	/**
	 * @inheritdoc
	 */
	public async delete(): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Delete consumer
		try {
			await this.consumer.delete();
		}
		catch (err: any) {
			// Ignore error if message is not found
			if (!isStreamConsumerNotFoundError(err)) {
				throw err;
			}
		}
	}

	/**
	 * @inheritdoc
	 */
	public async subscribe(cb: NatsStreamMessageCallback): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Check if a subscription already exists
		if (this.internals.hasConsumerSubscription(this.name)) {
			throw new Error('NatsClient: Already subscribed');
		}

		// Start consuming messages
		const consumerMessages = await this.consumer.consume();
		this.internals.addConsumerSubscription(this.name, consumerMessages);

		(async (consumerMessages) => {
			for await (const m of consumerMessages) {
				if (this.internals.isClosed()) {
					break;
				}

				const msg: NatsStreamMessageAck = {
					subject: m.subject,
					message: m.data,
					sequence: m.seq,
					timestamp: new Date(millis(m.info.timestampNanos)),
					ack: () => {
						if (!this.internals.isClosed()) {
							m.ack();
						}
					},
					nak: (millis?: number) => {
						if (!this.internals.isClosed()) {
							m.nak(millis);
						}
					}
				}
				if (m.headers) {
					msg.headers = {}
					for (const [key, value] of m.headers) {
						msg.headers[key] = value.length > 0 ? value[0] : '';
					}
				}

				// Call callback
				try {
					const ret = await cb(msg);
					if (typeof ret === 'boolean' && (!this.internals.isClosed())) {
						if (ret) {
							m.ack();
						}
						else {
							m.nak();
						}
					}
				}
				catch (_err: any) {
					// Eat errors raised by the callback but tell the server that
					// processing failed.
					if (!this.internals.isClosed()) {
						m.nak();
					}
				}
			}
		})(consumerMessages).catch((_err: any) => {
			// console.error(_err);
		}).finally(() => {
			this.unsubscribe();
		});
	}

	/**
	 * @inheritdoc
	 */
	public async unsubscribe() {
		if (!this.internals.isClosed()) {
			// Find the subscription
			const consumerMessages = this.internals.getAndRemoveConsumerSubscription(this.name);
			if (consumerMessages) {
				// Unsubscribe
				try {
					await consumerMessages.close();
				}
				catch (_err: any) {
					// Ingore errors
				}
			}
		}
	}
};
