import { JetStreamPublishOptions, MsgHdrsImpl, NatsConnection, PublishOptions, Stream } from 'nats';
import { JetStreamClient, JetStreamManager, StreamConfig } from 'nats';
import { DiscardPolicy, RetentionPolicy, StorageType, TlsOptions } from 'nats';
import { connect, jwtAuthenticator, nanos } from 'nats';
import { NatsClientOptions, NatsMessage, NatsMessageCallback, NatsMessageHeaders, NatsStreamOptions, NatsStreamPublishOptions, NatsStreamPublishedInfo, NatsClientStream } from './types';
import { NatsClientStreamImpl } from './impl/stream';
import { NatsClientSharedInternals } from './impl/internals';
import { isStreamAlreadyExistsError, isStreamNotFoundError } from './helpers/errors';
import { EventEmitter } from 'node:events';

// -----------------------------------------------------------------------------

/**
 * Implements a connector to a NATS.io JetStream instance.
 * @class NatsClient
 */
export class NatsClient extends EventEmitter {
	private js: JetStreamClient;
	private internals = new NatsClientSharedInternals();

	/**
	 * Creates a new NATS.io/JetStream client object.
	 * @async
	 * @method create
	 * @param {NatsClientOptions} opts - Configuration options.
	 * @returns {NatsClient}
	 */
	public static async create(opts: NatsClientOptions): Promise<NatsClient> {
		let nkeySeed: Uint8Array;

		// Validate options
		if (typeof opts !== 'object' || Array.isArray(opts)) {
			throw new Error('NatsClient: invalid configuration options');
		}

		// Validate servers list
		let servers: string[] = [];
		if (typeof opts.servers === 'string') {
			if (opts.servers.length == 0) {
				throw new Error('NatsClient: invalid server(s) list provided');
			}
			servers = opts.servers.split(',').map((server) => server.trim());
		}
		else if (Array.isArray(opts.servers)) {
			opts.servers.forEach((server) => {
				if (typeof server !== 'string') {
					throw new Error('NatsClient: invalid server(s) list provided');
				}
				servers.push(...server.split(',').map((s) => s.trim()));
			});
		}
		else {
			throw new Error('NatsClient: invalid server(s) list provided');
		}
		if (servers.length == 0) {
			throw new Error('NatsClient: invalid server(s) list provided');
		}
		for (const server of servers) {
			if (server.length == 0) {
				throw new Error('NatsClient: invalid server(s) list provided');
			}
		}

		// Validate access token (actually this acts as a user name)
		if (typeof opts.jwt !== 'string') {
			throw new Error('NatsClient: invalid credentials provided');
		}
		const parts = opts.jwt.split('.');
		if (parts.length !== 3 || parts[0].length == 0 || parts[1].length == 0 || parts[2].length == 0) {
			throw new Error('NatsClient: invalid credentials provided');
		}

		// Validate key seed (this is the "password")
		if (typeof opts.nkeySeed !== 'string' || opts.nkeySeed.length == 0) {
			throw new Error('NatsClient: invalid credentials provided');
		}
		try {
			nkeySeed = new Uint8Array(Buffer.from(opts.nkeySeed, 'utf8'));
		}
		catch (_err: any) {
			throw new Error('NatsClient: invalid credentials provided');
		}

		// Build TLS options
		let tls: TlsOptions | undefined;
		if (opts.tls !== 'never') {
			if (opts.tls && opts.tls !== 'auto') {
				if (opts.tls === 'enforce') {
					tls = {
						handshakeFirst: true
					};
				}
				else if (typeof opts.tls === 'object' && (!Array.isArray(opts.tls))) {
					tls = {
						handshakeFirst: opts.tls.enforce || false,
						certFile: opts.tls.certFile,
						cert: opts.tls.cert,
						caFile: opts.tls.caFile,
						ca: opts.tls.ca,
						keyFile: opts.tls.keyFile,
						key: opts.tls.key
					};
				}
				else {
					throw new Error('NatsClient: invalid TLS settings');
				}
			}
			else {
				tls = {}
			}
		}

		// Connect to server
		const conn = await connect({
			servers,
			debug: opts.debug,
			authenticator: jwtAuthenticator(opts.jwt, nkeySeed),
			maxReconnectAttempts: -1,
			reconnectTimeWait: 500,
			timeout: 10000,
			name: opts.name,
			noEcho: opts.enableEcho ? false : true,
			tls
		});

		// Get stream mamanger
		const jsm = await conn.jetstreamManager();

		// Create and return our new
		return new NatsClient(opts.name, conn, jsm);
	};

	/**
	 * @constructor
	 * @param {NatsConnection} conn - Established connection to server
	 * @param {JetStreamManager} jsm - JetStream manager
	 */
	protected constructor(private _name: string, private conn: NatsConnection, private jsm: JetStreamManager) {
		super();
		this.js = jsm.jetstream();
		this.statusMonitor();
	}

	/**
	 * Gets the client name.
	 * @property name
	 */
	get name(): string {
		return this._name;
	};

	/**
	 * Closes the connection to the server. Pending messages will be dropped.
	 * @async
	 * @method close
	 */
	public async close(): Promise<void> {
		if (!this.internals.isClosed()) {
			// Destroy all stream subscriptions/consumers
			await this.internals.close();

			// const done = this.conn.closed();

			// Close the connection
			await this.conn.close();

			// await done;
		}
	}

	/**
	 * Delivers an ephemeral message.
	 * @method publish
	 * @param {string} subject - The message's topic.
	 * @param {Uint8Array} message - The message to send
	 * @param {NatsMessageHeaders} headers - Optional headers associated to the message.
	 */
	public publish(subject: string, message: Uint8Array, headers?: NatsMessageHeaders): void {
		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Configure publish options
		const publishOpts: PublishOptions = {};
		if (headers) {
			publishOpts.headers = new MsgHdrsImpl();
			for (const key in headers) {
				if (Object.prototype.hasOwnProperty.call(headers, key)) {
					publishOpts.headers.set(key, headers[key]);
				}
			}
		}

		// Publish message
		this.conn.publish(subject, message, publishOpts);
	}

	/**
	 * Creates a subscription for ephemeral messages based on the given subject.
	 * @method subscribe
	 * @param {string} subject - The topic to subscribe.
	 * @param {NatsMessageCallback} cb - Asynchronous callback to call when a new message arrives.
	 */
	public subscribe(subject: string, cb: NatsMessageCallback): void {
		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Check if a subscription already exists
		if (this.internals.hasSubscription(subject)) {
			throw new Error('NatsClient: Already subscribed');
		}

		// Create a new one
		const subscription = this.conn.subscribe(subject);
		this.internals.addSubscription(subscription);

		// Start a background worker that "listens" for incoming messages
		(async () => {
			for await (const m of subscription) {
				if (this.internals.isClosed()) {
					break;
				}

				const msg: NatsMessage = {
					subject: m.subject,
					message: m.data
				}
				if (m.headers) {
					msg.headers = {}
					for (const [key, value] of m.headers) {
						msg.headers[key] = value.length > 0 ? value[0] : '';
					}
				}

				// Call callback
				try {
					await cb(msg);
				}
				catch (_err: any) {
					// Eat errors raised by the callback
				}
			}
		})().catch(() => null).finally(() => {
			this.unsubscribe(subject);
		});
	}

	/**
	 * Destroys an active subscription for ephemeral messages on the given subject.
	 * It does not throw errors if the connection is closed or the subscription does not exists.
	 * @method unsubscribe
	 * @param {string} subject - The topic to unsubscribe.
	 */
	public unsubscribe(subject: string) {
		if (!this.internals.isClosed()) {
			// Find the subscription
			const subscription = this.internals.getAndRemoveSubscription(subject);
			if (subscription) {
				// Unsubscribe
				subscription.unsubscribe();
			}
		}
	}

	/**
	 * Gets an existing JetStream stream.
	 * @async
	 * @method getStream
	 * @param {string} name - Name of the message store.
	 */
	public async getStream(name: string): Promise<NatsClientStream> {
		let stream: Stream;

		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Validate options
		if (!/[0-9A-Za-z_-]/ui.test(name)) {
			throw new Error('NatsClient: invalid stream name');
		}

		// Get stream by name
		try {
			stream = await this.jsm.streams.get(name);
		}
		catch (err: any) {
			// Change error if stream is not found
			if (isStreamNotFoundError(err)) {
				throw new Error('NatsClient: not found');
			}
			throw err;
		}

		// Wrap
		return new NatsClientStreamImpl(stream, this.jsm, this.internals);
	}

	/**
	 * Creates a new JetStream stream.
	 * @async
	 * @method createStream
	 * @param {string} name - Name of the message store.
	 * @param {NatsStreamOptions} opts - Stream configuration options.
	 */
	public async createStream(name: string, opts: NatsStreamOptions): Promise<NatsClientStream> {
		let doUpdate = false;

		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Validate options
		if (!/[0-9A-Za-z_-]/ui.test(name)) {
			throw new Error('NatsClient: invalid stream name');
		}
		let subjects: string[];
		if (typeof opts.subjects === 'string') {
			subjects = [ opts.subjects ];
		}
		else if (Array.isArray(opts.subjects)) {
			subjects = opts.subjects;
		}
		else {
			throw new Error('NatsClient: invalid subjects in options');
		};
		if (typeof opts.duplicateWindowTimeoutMs !== 'undefined') {
			if (typeof opts.duplicateWindowTimeoutMs !== 'number' || opts.duplicateWindowTimeoutMs < 1) {
				throw new Error('NatsClient: invalid duplicate window timeout in options');
			}
		}

		let existingAction = 'update';
		if (opts.existingAction === 'update' || opts.existingAction === 'keep' || opts.existingAction === 'fail' ) {
			existingAction = opts.existingAction;
		}
		else if (typeof opts.existingAction !== 'undefined') {
			throw new Error('NatsClient: invalid action if the stream already exists');
		}

		// Quick path, try to get an existing stream first
		try {
			const stream = await this.getStream(name);
			if (stream) {
				if (existingAction == 'keep') {
					return stream;
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

		// Configure new stream settings
		const addUpdateOptions: Partial<StreamConfig> = {
			name,
			...(opts.description && opts.description.length > 0 && {
				description: opts.description
			}),
			retention: (!opts.discardAckMessages) ? RetentionPolicy.Limits : RetentionPolicy.Workqueue,
			storage: StorageType.File,
			max_consumers: -1,
			subjects,
			max_bytes: opts.maxStorageSizeInBytes ?? 1024 * 1024 * 1024,
			discard: DiscardPolicy.Old,
			deny_delete: opts.disallowDelete ?? false,
			deny_purge: opts.disallowDelete ?? false,
			duplicate_window: nanos((opts.duplicateWindowTimeoutMs) ? opts.duplicateWindowTimeoutMs : 60 * 1000) // 1 minute
		};

		if (!doUpdate) {
			// Create stream
			try {
				await this.jsm.streams.add(addUpdateOptions);
			}
			catch (err: any) {
				// Ignore error if the stream already exists
				if (!isStreamAlreadyExistsError(err)) {
					throw err;
				}
				doUpdate = true;
			}
		}

		if (doUpdate) {
			// Update stream
			try {
				await this.jsm.streams.update(name, addUpdateOptions);
			}
			catch (err: any) {
				// Change error if stream is not found
				if (isStreamNotFoundError(err)) {
					throw new Error('NatsClient: not found');
				}
				throw err;
			}
		}

		// Done
		return await this.getStream(name);
	}

	/**
	 * Deletes an existing JetStream stream.
	 * It does not throw errors if the stream does not exists.
	 * @async
	 * @method deleteStream
	 * @param {string} name - Name of the stream to delete.
	 */
	public async deleteStream(name: string): Promise<void> {
		let stream: NatsClientStream;

		try {
			stream = await this.getStream(name);
		}
		catch (err: any) {
			if (err.message && err.message.indexOf('not found') >= 0) {
				return;
			}
			throw err;
		}
		await stream.delete();
	}

	/**
	 * Delivers a persistent message
	 * @async
	 * @method publishToStream
	 * @param {string} subject - The message's topic.
	 * @param {Uint8Array} message - The message to send
	 * @param {NatsMessageHeaders} headers - Optional headers associated to the message.
	 * @param {NatsStreamPublishOptions} opts - Extended message options.
	 */
	public async publishToStream(subject: string, message: Uint8Array, headers?: NatsMessageHeaders, opts?: NatsStreamPublishOptions): Promise<NatsStreamPublishedInfo> {
		if (this.internals.isClosed()) {
			throw new Error('NatsClient: Connection is closed');
		}

		// Build message publish parameters based on the provided options
		const publishOpts: Partial<JetStreamPublishOptions> = {};
		if (headers) {
			publishOpts.headers = new MsgHdrsImpl();
			for (const key in headers) {
				if (Object.prototype.hasOwnProperty.call(headers, key)) {
					publishOpts.headers.set(key, headers[key]);
				}
			}
		}
		if (opts) {
			if (opts.msgID) {
				publishOpts.msgID = opts.msgID;
			}
			if (typeof opts.timeoutMs === 'number' && opts.timeoutMs > 1) {
				publishOpts.timeout = opts.timeoutMs;
			}
			if (opts.expectedLastMsgID) {
				publishOpts.expect = {
					lastMsgID: opts.expectedLastMsgID
				}
			}
		}

		// Publish message
		const pa = await this.js.publish(subject, message, publishOpts);

		// Return sequence number and other details
		return {
			sequence: pa.seq,
			duplicate: pa.duplicate
		}
	}

	//--------------------------------------------------------------------------
	// Private methods

	/**
	 * Raises events if the connection is up or down.
	 * @async
	 * @method statusMonitor
	 */
	private statusMonitor(): void {
		(async (_that) => {
			for await (const s of _that.conn.status()) {
				if (_that.conn.isClosed()) {
					break;
				}
				switch (s.type) {
					case 'reconnect':
						_that.emit('status', {
							connection: 'connected'
						});
						break;
					case 'disconnect':
						_that.emit('status', {
							connection: 'disconnected'
						});
						break;
 				}
			}
		})(this).catch((_err: any) => {
			console.log(_err);
		});
	}
};
