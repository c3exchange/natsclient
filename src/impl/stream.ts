import * as nats from 'nats';
import { Consumer, Stream, StreamInfo, ConsumerOptions, StreamMessage, StreamMessageCallback } from '../types';
import { SharedInternals } from './internals';
import { ConsumerImpl } from './consumer';
import { isStreamConsumerAlreadyExistsError, isStreamConsumerNotFoundError, isStreamMessageNotFoundError, isStreamNotFoundError } from '../helpers/errors';

// -----------------------------------------------------------------------------

/**
 * @inheritdoc
 */
export class StreamImpl implements Stream {
	private js: nats.JetStreamClient;

	constructor(private stream: nats.Stream, private jsm: nats.JetStreamManager, private internals: SharedInternals) {
		this.js = this.jsm.jetstream();
	}

	/**
	 * @inheritdoc
	 */
	public async info(): Promise<StreamInfo> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Get stream information
		let si: nats.StreamInfo;
		try {
			si = await this.stream.info(false, {
				deleted_details: false
			});
		}
		catch (err: any) {
			// Change error if message is not found
			if (isStreamMessageNotFoundError(err)) {
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
	}

	/**
	 * @inheritdoc
	 */
	public async destroy(): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Delete stream
		try {
			await this.jsm.streams.delete(this.stream.name);
		}
		catch (err: any) {
			// Ignore error if message is not found
			if (!isStreamNotFoundError(err)) {
				throw err;
			}
		}
	}

	/**
	 * @inheritdoc
	 */
	public async getMessage(sequence: number): Promise<StreamMessage | null> {
		let m: nats.StoredMsg;

		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Get stream and message
		try {
			m = await this.stream.getMessage({
				seq: sequence
			});
		}
		catch (err: any) {
			// Return null if message is not found
			if (isStreamMessageNotFoundError(err)) {
				return null;
			}
			throw err;
		}

		// Create result
		const msg: StreamMessage =  {
			subject: m.subject,
			message: m.data,
			sequence: m.seq,
			timestamp: m.time,
		};
		if (m.header) {
			msg.headers = {}
			for (const [key, value] of m.header) {
				msg.headers[key] = value.length > 0 ? value[0] : '';
			}
		}

		// Done
		return msg;
	}

	/**
	 * @inheritdoc
	 */
	public async deleteMessage(sequence: number): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Delete message
		try {
			await this.stream.deleteMessage(sequence, true);
		}
		catch (err: any) {
			// Ignore error if message is not found
			if (!isStreamMessageNotFoundError(err)) {
				throw err;
			}
		}
	}

	/**
	 * @inheritdoc
	 */
	public async getConsumer(name: string): Promise<Consumer | null> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Validate options
		if (!/[0-9A-Za-z_-]/ui.test(name)) {
			throw new Error('NatsJetstreamClient: invalid consumer name');
		}

		// Get consumer by name
		let consumer: nats.Consumer;
		try {
			consumer = await this.js.consumers.get(this.stream.name, name);
		}
		catch (err: any) {
			// Return null if consumer is not found
			if (isStreamConsumerNotFoundError(err)) {
				return null;
			}
			throw err;
		}

		// Wrap
		return new ConsumerImpl(name, consumer, this.internals);
	}

	/**
	 * @inheritdoc
	 */
	public async createConsumer(name: string, opts: ConsumerOptions): Promise<Consumer> {
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
		if (opts.existingAction === 'update' || opts.existingAction === 'keep' || opts.existingAction === 'fail' ) {
			existingAction = opts.existingAction;
		}
		else if (typeof opts.existingAction !== 'undefined') {
			throw new Error('NatsJetstreamClient: invalid action if the stream already exists');
		}
		let filter_subjects: string[] | undefined;
		if (typeof opts.subjectFilters !== 'undefined') {
			if (typeof opts.subjectFilters === 'string') {
				filter_subjects = [ opts.subjectFilters ];
			}
			else if (Array.isArray(opts.subjectFilters)) {
				filter_subjects = opts.subjectFilters;
			}
			else {
				throw new Error('NatsJetstreamClient: invalid consumer\'s filter subject');
			}
		}

		// Quick path, try to get an existing consumer first
		try {
			const consumer = await this.getConsumer(name);
			if (consumer) {
				if (existingAction == 'keep') {
					return consumer;
				}
				if (existingAction == 'fail') {
					throw new Error('NatsJetstreamClient: Already exists');
				}
				doUpdate = true;
			}
		}
		catch (_err: any) {
			// Ignore errors
		};

		// Configure the consumer settings
		const addUpdateOptions: Partial<nats.ConsumerConfig> = {
			name,
			durable_name: name,
			ack_policy: nats.AckPolicy.Explicit,
			deliver_policy: nats.DeliverPolicy.All,
			filter_subjects,
			max_ack_pending: -1
		};
		if (typeof opts.deliverPolicy === 'string') {
			switch (opts.deliverPolicy) {
				case'all':
					break;

				case 'new':
					addUpdateOptions.deliver_policy = nats.DeliverPolicy.New;
					break;

				case'last':
					addUpdateOptions.deliver_policy = nats.DeliverPolicy.Last;
					break;

				case'sequence':
					addUpdateOptions.deliver_policy = nats.DeliverPolicy.StartSequence;
					if (typeof opts.deliverStartSequence !== 'number' || opts.deliverStartSequence < 0) {
						throw new Error('NatsJetstreamClient: invalid delivery start sequence number in options');
					}
					addUpdateOptions.opt_start_seq = opts.deliverStartSequence;
					break;

				case'time':
					addUpdateOptions.deliver_policy = nats.DeliverPolicy.StartTime;
					if (!(opts.deliverStartTime && opts.deliverStartTime instanceof Date)) {
						throw new Error('NatsJetstreamClient: invalid delivery start sequence number in options');
					}
					addUpdateOptions.opt_start_time = opts.deliverStartTime.toISOString();
					break;

				case'subject-last':
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
				await this.jsm.consumers.add(this.stream.name, addUpdateOptions);
			}
			catch (err: any) {
				// Ignore error if the consumer already exists
				if (!isStreamConsumerAlreadyExistsError(err)) {
					throw err;
				}
				doUpdate = true;
			}
		}

		if (doUpdate) {
			// Update stream
			try {
				await this.jsm.consumers.update(this.stream.name, name, addUpdateOptions);
			}
			catch (err: any) {
				// Change error if stream is not found
				if (isStreamConsumerNotFoundError(err)) {
					throw new Error('NatsJetstreamClient: unexpected not found');
				}
				throw err;
			}
		}

		// Done
		const consumer = await this.getConsumer(name);
		if (!consumer) {
			throw new Error('NatsJetstreamClient: unexpected not found');
		}
		return consumer;
	}

	/**
	 * @inheritdoc
	 */
	public async deleteConsumer(name: string): Promise<void> {
		const consumer = await this.getConsumer(name);
		if (consumer) {
			await consumer.destroy();
		}
	}

	/**
	 * @inheritdoc
	 */
	public async subscribeConsumer(name: string, cb: StreamMessageCallback): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Get the consumer
		const consumer = await this.getConsumer(name);
		if (!consumer) {
			throw new Error('NatsJetstreamClient: consumer not found');
		}

		// And subscribe
		await consumer.subscribe(cb);
	}

	/**
	 * @inheritdoc
	 */
	public async unsubscribeConsumer(name: string): Promise<void> {
		// Shortcut for getting the consumer and unsubscribing it
		if (!this.internals.isClosed()) {
			// Find the subscription
			const consumerMessages = this.internals.getAndRemoveConsumerSubscription(name);
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
