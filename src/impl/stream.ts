import { NatsClientConsumer, NatsClientStream, NatsClientStreamInfo, NatsConsumerOptions, NatsStreamMessage } from '../types';
import { AckPolicy, Consumer, ConsumerConfig, DeliverPolicy, JetStreamClient, JetStreamManager, StoredMsg, Stream, StreamInfo } from 'nats';
import { NatsClientConsumerImpl } from './consumer';
import { isStreamConsumerAlreadyExistsError, isStreamConsumerNotFoundError, isStreamMessageNotFoundError, isStreamNotFoundError } from '../helpers/errors';
import { NatsClientSharedInternals } from './internals';

// -----------------------------------------------------------------------------

export class NatsClientStreamImpl implements NatsClientStream {
	private js: JetStreamClient;

	constructor(private stream: Stream, private jsm: JetStreamManager, private internals: NatsClientSharedInternals) {
		this.js = this.jsm.jetstream();
	}

	/**
	 * @inheritdoc
	 */
	public async info(): Promise<NatsClientStreamInfo> {
		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Get stream information
		let si: StreamInfo;
		try {
			si = await this.stream.info(false, {
				deleted_details: false
			});
		}
		catch (err: any) {
			// Change error if message is not found
			if (isStreamMessageNotFoundError(err)) {
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
	}

	/**
	 * @inheritdoc
	 */
	public async delete(): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
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
	public async getMessage(sequence: number): Promise<NatsStreamMessage> {
		let m: StoredMsg;

		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Get stream and message
		try {
			m = await this.stream.getMessage({
				seq: sequence
			});
		}
		catch (err: any) {
			// Change error if message is not found
			if (isStreamMessageNotFoundError(err)) {
				throw new Error('NatsClient: not found');
			}
			throw err;
		}

		// Create result
		const msg: NatsStreamMessage =  {
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
			throw new Error('NatsClient: Connection is closed');
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
	public async getConsumer(name: string): Promise<NatsClientConsumer> {
		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Validate options
		if (!/[0-9A-Za-z_-]/ui.test(name)) {
			throw new Error('NatsClient: invalid consumer name');
		}

		// Get consumer by name
		let consumer: Consumer;
		try {
			consumer = await this.js.consumers.get(this.stream.name, name);
		}
		catch (err: any) {
			// Change error if stream is not found
			if (isStreamNotFoundError(err)) {
				throw new Error('NatsClient: not found');
			}
			throw err;
		}

		// Wrap
		return new NatsClientConsumerImpl(name, consumer, this.internals);
	}

	/**
	 * @inheritdoc
	 */
	public async createConsumer(name: string, opts: NatsConsumerOptions): Promise<NatsClientConsumer> {
		let doUpdate = false;

		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Validate options
		if (!/[0-9A-Za-z_-]/ui.test(name)) {
			throw new Error('NatsClient: invalid consumer name');
		}
		let existingAction = 'update';
		if (opts.existingAction === 'update' || opts.existingAction === 'keep' || opts.existingAction === 'fail' ) {
			existingAction = opts.existingAction;
		}
		else if (typeof opts.existingAction !== 'undefined') {
			throw new Error('NatsClient: invalid action if the stream already exists');
		}

		// Quick path, try to get an existing consumer first
		try {
			const consumer = await this.getConsumer(name);
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
		catch (_err: any) {
			// Ignore errors
		};

		// Configure the consumer settings
		const addUpdateOptions: Partial<ConsumerConfig> = {
			name,
			durable_name: name,
			ack_policy: AckPolicy.Explicit,
			deliver_policy: DeliverPolicy.New,
			filter_subject: opts.subjectFilter,
			max_ack_pending: -1
		};
		if (typeof opts.deliverPolicy === 'string') {
			switch (opts.deliverPolicy) {
				case 'new':
					break;
				case'last':
					addUpdateOptions.deliver_policy = DeliverPolicy.Last;
					break;
				case'all':
					addUpdateOptions.deliver_policy = DeliverPolicy.All;
					break;
				case'sequence':
					addUpdateOptions.deliver_policy = DeliverPolicy.StartSequence;
					if (typeof opts.deliverStartSequence !== 'number' || opts.deliverStartSequence < 0) {
						throw new Error('NatsClient: Invalid delivery start sequence number in options');
					}
					addUpdateOptions.opt_start_seq = opts.deliverStartSequence;
					break;
				case'time':
					addUpdateOptions.deliver_policy = DeliverPolicy.StartTime;
					if (!(opts.deliverStartTime && opts.deliverStartTime instanceof Date)) {
						throw new Error('NatsClient: Invalid delivery start sequence number in options');
					}
					addUpdateOptions.opt_start_time = opts.deliverStartTime.toISOString();
					break;
				case'subject-last':
					addUpdateOptions.deliver_policy = DeliverPolicy.LastPerSubject;
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
					throw new Error('NatsClient: not found');
				}
				throw err;
			}
		}

		// Done
		return this.getConsumer(name);
	}

	/**
	 * @inheritdoc
	 */
	public async deleteConsumer(name: string): Promise<void> {
		let consumer: NatsClientConsumer;

		try {
			consumer = await this.getConsumer(name);
		}
		catch (err: any) {
			if (err.message && err.message.indexOf('not found') >= 0) {
				return;
			}
			throw err;
		}
		await consumer.delete();
	}
};
