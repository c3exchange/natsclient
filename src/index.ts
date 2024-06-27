import * as nats from 'nats';
export * from './types';
import { ClientOptions, Message, MessageCallback, MessageHeaders, StreamOptions, StreamPublishOptions, StreamPublishedInfo, Stream, KvBucket, KvBucketOptions, ClientCredentialsJWT, ClientCredentialsLegacy, ClientCredentialsToken, ClientEventsMap } from './types';
import { StreamImpl } from './impl/stream';
import { NoopKvCodecs, SharedInternals } from './impl/internals';
import { isLastMsgIdMismatchError, isLastSequenceMismatchError, isStreamAlreadyExistsError, isStreamNotFoundError } from './helpers/errors';
import { EventEmitter } from 'node:events';
import { KvBucketImpl } from './impl/kv';
import { validateSubject } from './helpers/validators';

// -----------------------------------------------------------------------------

/**
 * Implements a connector to a NATS.io JetStream instance.
 * @class Client
 */
export class Client extends EventEmitter<ClientEventsMap> {
	private js: nats.JetStreamClient;
	private internals: SharedInternals;

	/**
	 * Creates a new NATS.io/JetStream client object.
	 * @async
	 * @method create
	 * @param {ClientOptions} opts - Configuration options.
	 * @returns {Client} - The client accessor.
	 */
	public static async create(opts: ClientOptions): Promise<Client> {
		const auth: any = {};

		// Validate options
		if (typeof opts !== 'object' || Array.isArray(opts)) {
			throw new Error('NatsJetstreamClient: invalid configuration options');
		}

		// Validate servers list
		let servers: string[] = [];
		if (typeof opts.servers === 'string') {
			if (opts.servers.length == 0) {
				throw new Error('NatsJetstreamClient: invalid server(s) list provided');
			}
			servers = opts.servers.split(',').map((server) => server.trim());
		}
		else if (Array.isArray(opts.servers)) {
			opts.servers.forEach((server) => {
				if (typeof server !== 'string') {
					throw new Error('NatsJetstreamClient: invalid server(s) list provided');
				}
				servers.push(...server.split(',').map((s) => s.trim()));
			});
		}
		else {
			throw new Error('NatsJetstreamClient: invalid server(s) list provided');
		}
		if (servers.length == 0) {
			throw new Error('NatsJetstreamClient: invalid server(s) list provided');
		}
		for (const server of servers) {
			if (server.length == 0) {
				throw new Error('NatsJetstreamClient: invalid server(s) list provided');
			}
		}

		// Validate credentials
		if (typeof opts.credentials !== 'object' || Array.isArray(opts.credentials)) {
			throw new Error('NatsJetstreamClient: invalid credentials provided');
		}
		if (typeof (opts.credentials as ClientCredentialsToken).token === 'string') {
			const cred = opts.credentials as ClientCredentialsToken;

			if (cred.token.length == 0) {
				throw new Error('NatsJetstreamClient: invalid credentials provided');
			}

			auth.token = cred.token;
		}
		else if (typeof (opts.credentials as ClientCredentialsJWT).jwt === 'string') {
			let nkeySeed: Uint8Array;

			const cred = opts.credentials as ClientCredentialsJWT;
			const parts = cred.jwt.split('.');
			if (parts.length !== 3 || parts[0].length == 0 || parts[1].length == 0 || parts[2].length == 0) {
				throw new Error('NatsJetstreamClient: invalid credentials provided');
			}

			// Validate key seed
			if (typeof cred.nkeySeed !== 'string' || cred.nkeySeed.length == 0) {
				throw new Error('NatsJetstreamClient: invalid credentials provided');
			}
			try {
				nkeySeed = new Uint8Array(Buffer.from(cred.nkeySeed, 'utf8'));
			}
			catch (_err: any) {
				throw new Error('NatsJetstreamClient: invalid credentials provided');
			}

			// Create JWT authenticator
			auth.authenticator = nats.jwtAuthenticator(cred.jwt, nkeySeed);
		}
		else if (typeof (opts.credentials as ClientCredentialsLegacy).username === 'string') {
			const cred = opts.credentials as ClientCredentialsLegacy;

			if (typeof cred.password !== 'string' || cred.username.length == 0 || cred.password.length == 0) {
				throw new Error('NatsJetstreamClient: invalid credentials provided');
			}

			auth.user = cred.username;
			auth.pass = cred.password;
		}
		else {
			throw new Error('NatsJetstreamClient: invalid credentials provided');
		}

		// Build TLS options
		let tls: nats.TlsOptions | undefined;
		if (opts.tls !== 'never') {
			if (opts.tls && opts.tls !== 'auto') {
				if (opts.tls === 'always') {
					tls = {
						handshakeFirst: true
					};
				}
				else if (typeof opts.tls === 'object' && (!Array.isArray(opts.tls))) {
					tls = {
						handshakeFirst: opts.tls.enforce === true,
						certFile: opts.tls.certFile,
						cert: opts.tls.cert,
						caFile: opts.tls.caFile,
						ca: opts.tls.ca,
						keyFile: opts.tls.keyFile,
						key: opts.tls.key
					};
				}
				else {
					throw new Error('NatsJetstreamClient: invalid TLS settings');
				}
			}
			else {
				tls = {}
			}
		}

		// Connect to server
		const conn = await nats.connect({
			servers,
			debug: opts.debug,
			...auth,
			maxReconnectAttempts: -1,
			reconnectTimeWait: 500,
			timeout: 10000,
			name: opts.name,
			noEcho: opts.enableEcho ? false : true,
			tls,
			ignoreAuthErrorAbort: false,
			reconnect: true
		});

		// Get stream mamanger
		const jsm = await conn.jetstreamManager();

		// Create and return our new
		return new Client(opts.name, conn, jsm);
	};

	/**
	 * @constructor
	 * @param {NatsConnection} conn - Established connection to server
	 * @param {JetStreamManager} jsm - JetStream manager
	 */
	protected constructor(private _name: string, private conn: nats.NatsConnection, private jsm: nats.JetStreamManager) {
		super();
		this.js = jsm.jetstream();
		this.internals = new SharedInternals(this.conn);
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
	 * @param {MessageHeaders} headers - Optional headers associated to the message.
	 */
	public publish(subject: string, message: Uint8Array, headers?: MessageHeaders): void {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Validate subject
		if (!validateSubject(subject, false)) {
			throw new Error('NatsJetstreamClient: invalid subject');
		}

		// Configure publish options
		const publishOpts: nats.PublishOptions = {};
		if (headers) {
			publishOpts.headers = new nats.MsgHdrsImpl();
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
	 * @async
	 * @param {string} subject - The topic to subscribe.
	 * @param {MessageCallback} cb - Asynchronous callback to call when a new message arrives.
	 */
	public async subscribe(subject: string, cb: MessageCallback): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Validate subject
		if (!validateSubject(subject, true)) {
			throw new Error('NatsJetstreamClient: invalid subject');
		}

		// Check if a subscription already exists
		if (this.internals.hasSubscription(subject)) {
			throw new Error('NatsJetstreamClient: already subscribed');
		}

		// Promisify callback
		const wrappedCb = (msg: Message): Promise<void> => {
			try {
				const result = cb(msg);
				return Promise.resolve(result);
			}
			catch (err: any) {
				return Promise.reject(err);
			}
		};

		// Create a new one
		const subscription = this.conn.subscribe(subject);
		this.internals.addSubscription(subscription);

		// Start a background worker that "listens" for incoming messages
		(async (_that) => {
			for await (const m of subscription) {
				if (_that.internals.isClosed()) {
					break;
				}

				const msg: Message = {
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
					await wrappedCb(msg);
				}
				catch (_err: any) {
					// Eat errors raised by the callback
				}
			}
		})(this).catch(() => null).finally(() => {
			this.unsubscribe(subject);
		});

		// Ensure the subscription message is sent before retuning
		await this.conn.flush();
	}

	/**
	 * Destroys an active subscription for ephemeral messages on the given subject.
	 * It does not throw errors if the connection is closed or the subscription does not exists.
	 * @async
	 * @method unsubscribe
	 * @param {string} subject - The topic to unsubscribe.
	 */
	public async unsubscribe(subject: string) {
		if (!this.internals.isClosed()) {
			// Find the subscription
			const subscription = this.internals.getAndRemoveSubscription(subject);
			if (subscription) {
				// Unsubscribe
				subscription.unsubscribe();

				// Ensure the unsubscription message is sent before retuning
				await this.conn.flush();
			}
		}
	}

	/**
	 * Gets an existing JetStream stream.
	 * @async
	 * @method getStream
	 * @param {string} name - Name of the message store.
	 * @returns {Stream} - The stream accessor.
	 */
	public async getStream(name: string): Promise<Stream | null> {
		let stream: nats.Stream;

		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Validate options
		if (!/[0-9A-Za-z_-]/ui.test(name)) {
			throw new Error('NatsJetstreamClient: invalid stream name');
		}

		// Get stream by name
		try {
			stream = await this.jsm.streams.get(name);
		}
		catch (err: any) {
			// Return null if stream is not found
			if (isStreamNotFoundError(err)) {
				return null;
			}
			throw err;
		}

		// Wrap
		return new StreamImpl(stream, this.jsm, this.internals);
	}

	/**
	 * Creates a new JetStream stream.
	 * @async
	 * @method createStream
	 * @param {string} name - Name of the message store.
	 * @param {StreamOptions} opts - Stream configuration options.
	 * @returns {Stream} - The stream accessor.
	 */
	public async createStream(name: string, opts: StreamOptions): Promise<Stream> {
		let doUpdate = false;

		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Validate options
		if (!/[0-9A-Za-z_-]/ui.test(name)) {
			throw new Error('NatsJetstreamClient: invalid stream name');
		}
		let subjects: string[];
		if (typeof opts.subjects === 'string') {
			subjects = [ opts.subjects ];
		}
		else if (Array.isArray(opts.subjects)) {
			subjects = opts.subjects;
		}
		else {
			throw new Error('NatsJetstreamClient: invalid subjects in options');
		};
		// Validate subjects
		for (const subject of subjects) {
			if (!validateSubject(subject, true)) {
				throw new Error('NatsJetstreamClient: invalid subject');
			}
		}

		if (typeof opts.duplicateWindowTimeoutMs !== 'undefined') {
			if (typeof opts.duplicateWindowTimeoutMs !== 'number' || opts.duplicateWindowTimeoutMs < 1) {
				throw new Error('NatsJetstreamClient: invalid duplicate window timeout in options');
			}
		}

		let existingAction = 'update';
		if (opts.existingAction === 'update' || opts.existingAction === 'keep' || opts.existingAction === 'fail' ) {
			existingAction = opts.existingAction;
		}
		else if (typeof opts.existingAction !== 'undefined') {
			throw new Error('NatsJetstreamClient: invalid action if the stream already exists');
		}

		// Quick path, try to get an existing stream first
		try {
			const stream = await this.getStream(name);
			if (stream) {
				if (existingAction == 'keep') {
					return stream;
				}
				if (existingAction == 'fail') {
					throw new Error('NatsJetstreamClient: already exists');
				}
				doUpdate = true;
			}
		}
		catch (_err: any) {
			// Ignore errors
		};

		// Configure new stream settings
		const addUpdateOptions: Partial<nats.StreamConfig> = {
			name,
			...(opts.description && opts.description.length > 0 && {
				description: opts.description
			}),
			retention: (!opts.discardAckMessages) ? nats.RetentionPolicy.Limits : nats.RetentionPolicy.Workqueue,
			storage: nats.StorageType.File,
			max_consumers: -1,
			subjects,
			max_bytes: opts.maxStorageSizeInBytes ?? 1024 * 1024 * 1024,
			discard: nats.DiscardPolicy.Old,
			deny_delete: opts.disallowDelete ?? false,
			deny_purge: opts.disallowDelete ?? false,
			duplicate_window: nats.nanos((opts.duplicateWindowTimeoutMs) ? opts.duplicateWindowTimeoutMs : 60 * 1000), // 1 minute
			...(opts.numReplicas && {
				num_replicas: opts.numReplicas
			}),
			...((opts.cluster || opts.tags) && {
				cluster: opts.cluster,
				tags: opts.tags
			})
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
					throw new Error('NatsJetstreamClient: unexpected not found');
				}
				throw err;
			}
		}

		// Done
		const stream = await this.getStream(name);
		if (!stream) {
			throw new Error('NatsJetstreamClient: unexpected not found');
		}
		return stream;
	}

	/**
	 * Deletes an existing JetStream stream.
	 * It does not throw errors if the stream does not exists.
	 * @async
	 * @method destroyStream
	 * @param {string} name - Name of the stream to delete.
	 */
	public async destroyStream(name: string): Promise<void> {
		const stream = await this.getStream(name);
		if (stream) {
			await stream.destroy();
		}
	}


	/**
	 * Gets an existing KV bucket.
	 * @async
	 * @method getKvBucket
	 * @param {string} name - Name of the bucket.
	 * @returns {KvBucket} - The KeyValue bucket accessor.
	 */
	public async getKvBucket(name: string): Promise<KvBucket | null> {
		let kv: nats.KV;

		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Validate options
		if (!/[0-9A-Za-z_-]/ui.test(name)) {
			throw new Error('NatsJetstreamClient: invalid bucket name');
		}

		// Get bucket by name
		try {
			// We must verify if the underlying stream does exist because the javascript SDK does not do it :(
			await this.jsm.streams.get('KV_' + name);
			kv = await this.js.views.kv(name, {
				streamName: 'KV_' + name,
				codec: NoopKvCodecs(),
				bindOnly: true
			});
		}
		catch (err: any) {
			// Return null if bucket is not found
			if (isStreamNotFoundError(err)) {
				return null;
			}
			throw err;
		}

		// Wrap
		return new KvBucketImpl(kv, this.internals);
	}

	/**
	 * Creates a new KV bucket.
	 * @async
	 * @method createKvBucket
	 * @param {string} name - Name of the bucket.
	 * @param {KvBucketOptions} opts - Bucket configuration options.
	 * @returns {KvBucket} - The KeyValue bucket accessor.
	 */
	public async createKvBucket(name: string, opts?: KvBucketOptions): Promise<KvBucket> {
		let kv: nats.KV;

		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Validate options
		if (!/[0-9A-Za-z_-]/ui.test(name)) {
			throw new Error('NatsJetstreamClient: invalid bucket name');
		}

		// Configure new bucket settings
		const createBucketOptions: Partial<nats.KvOptions> = {
			streamName: 'KV_' + name,
			codec: NoopKvCodecs(),
			allow_direct: false,
			max_bytes: (opts && opts.maxStorageSizeInBytes) ? opts.maxStorageSizeInBytes : 1024 * 1024,
			maxBucketSize: (opts && opts.maxStorageSizeInBytes) ? opts.maxStorageSizeInBytes : 1024 * 1024,
			...(opts && {
				...(opts.description && opts.description.length > 0 && {
					description: opts.description
				}),
				history: opts.maxHistory,
				ttl: opts.ttl,
				storage: nats.StorageType.File,
				...(opts.numReplicas && {
					replicas: opts.numReplicas
				}),
				...((opts.cluster || opts.tags) && {
					cluster: opts.cluster,
					tags: opts.tags
				})
			})
		};
		// Create bucket
		try {
			kv = await this.js.views.kv(name, createBucketOptions);
		}
		catch (err: any) {
			// Change error if bucket is not found
			if (isStreamNotFoundError(err)) {
				throw new Error('NatsJetstreamClient: unexpected not found');
			}
			throw err;
		}

		// Wrap
		return new KvBucketImpl(kv, this.internals);
	}

	/**
	 * Deletes an existing KV bucket.
	 * It does not throw errors if the bucket does not exists.
	 * @async
	 * @method destroyKvBucket
	 * @param {string} name - Name of the bucket to delete.
	 */
	public async destroyKvBucket(name: string): Promise<void> {
		// A KV bucket is a special stream with a given prefix
		return this.destroyStream('KV_' + name);
	}

	/**
	 * Delivers a persistent message
	 * @async
	 * @method publishToStream
	 * @param {string} subject - The message's topic.
	 * @param {Uint8Array} message - The message to send
	 * @param {MessageHeaders} headers - Optional headers associated to the message.
	 * @param {StreamPublishOptions} opts - Extended message options.
	 * @returns {StreamPublishedInfo} - Published message details.
	 */
	public async publishToStream(subject: string, message: Uint8Array, headers?: MessageHeaders, opts?: StreamPublishOptions): Promise<StreamPublishedInfo> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Validate subject
		if (!validateSubject(subject, false)) {
			throw new Error('NatsJetstreamClient: invalid subject');
		}

		// Build message publish parameters based on the provided options
		const publishOpts: Partial<nats.JetStreamPublishOptions> = {};
		if (headers) {
			publishOpts.headers = new nats.MsgHdrsImpl();
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
		let pa: nats.PubAck;
		try {
			pa = await this.js.publish(subject, message, publishOpts);
		}
		catch (err: any) {
			if (isLastMsgIdMismatchError(err)) {
				throw new Error('NatsJetstreamClient: last message id mismatch');
			}
			if (isLastSequenceMismatchError(err)) {
				throw new Error('NatsJetstreamClient: last sequence mismatch');
			}
			throw err;
		}

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
						_that.emit('status', 'connected');
						break;
					case 'disconnect':
						_that.emit('status', 'disconnected');
						break;
 				}
			}
		})(this).catch((_err: any) => {
			console.log(_err);
		});
	}
};
