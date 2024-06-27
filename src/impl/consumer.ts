import * as nats from 'nats';
import { Consumer, StreamMessageAck, StreamMessageCallback } from '../types';
import { isStreamConsumerNotFoundError } from '../helpers/errors';
import { SharedInternals } from './internals';
import 'util'
// -----------------------------------------------------------------------------

/**
 * @inheritdoc
 */
export class ConsumerImpl implements Consumer {
	constructor(private name: string, private consumer: nats.Consumer, private internals: SharedInternals) {
	}

	/**
	 * @inheritdoc
	 */
	public async destroy(): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
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
	public async subscribe(cb: StreamMessageCallback): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Check if a subscription already exists
		if (this.internals.hasConsumerSubscription(this.name)) {
			throw new Error('NatsJetstreamClient: already subscribed');
		}

		// Promisify callback
		const wrappedCb = (msg: StreamMessageAck): Promise<boolean | undefined> => {
			try {
				const result = cb(msg);
				return Promise.resolve(result);
			}
			catch (err: any) {
				return Promise.reject(err);
			}
		};

		// Start consuming messages
		const consumerMessages = await this.consumer.consume();
		this.internals.addConsumerSubscription(this.name, consumerMessages);

		(async (consumerMessages) => {
			for await (const m of consumerMessages) {
				if (this.internals.isClosed()) {
					break;
				}

				const msg: StreamMessageAck = {
					subject: m.subject,
					message: m.data,
					sequence: m.seq,
					timestamp: new Date(nats.millis(m.info.timestampNanos)),
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
					const ret = await wrappedCb(msg);
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

		// Ensure the subscription message is sent before retuning
		await this.internals.flush();
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

					// Ensure the subscription message is sent before retuning
					await this.internals.flush();
				}
				catch (_err: any) {
					// Ingore errors
				}
			}
		}
	}
};
