import * as nats from 'nats';
import { EventEmitter } from 'node:events';

/**
 * NATS/JetStream client side configuration options.
 * @interface ClientOptions
 */
export interface ClientOptions {
	/**
	 * List of servers to use. in [{protocol}://]{host}[:{port}] format.
	 * @type {string | string[]}
	 */
	servers: string | string[];
	/**
	 * Set the credentials to use when connecting to the server.
	 * @type {ClientCredentials}
	 */
	credentials: ClientCredentials;
	/**
	 * Configure if a secure channel must be used.
	 * @type {ClientTlsConfig | 'enforce' | 'never' | 'auto' | undefined}
	 * @default 'auto'
	 */
	tls?: ClientTlsConfig | "enforce" | "never" | "auto";
	/**
	 * Custom name to identify this client.
	 * @type {string}
	 */
	name: string;
	/**
	 * Instructs the server to also send messages published by this connection to subscribers
	 * registered by it.
	 * @type {boolean | undefined}
	 * @default false
	 */
	enableEcho?: boolean;
	/**
	 * If 'true' the client will print protocol messages sent and received. DO NOT use in production environments.
	 * @type {boolean | undefined}
	 * @default false
	 */
	debug?: boolean;
}
/**
 * Credentials to use when establishing a connection to the server.
 * @interface ClientCredentials
 */
export interface ClientCredentials {
	/**
	 * The JWT describes the account to use and its capabilities.
	 * @type {string}
	 */
	jwt: string;
	/**
	 * The nkeySeed is like a password.
	 * @type {string}
	 */
	nkeySeed: string;
}
/**
 * TLS configuration options used while connecting to a server.
 * @interface ClientTlsConfig
 */
export interface ClientTlsConfig {
	/**
	 * Forces to use TLS.
	 * @type {boolean | undefined}
	 */
	enforce?: boolean;
	/**
	 * Certificate file to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	certFile?: string;
	/**
	 * Certificate to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	cert?: string;
	/**
	 * Certificate authority file to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	caFile?: string;
	/**
	 * Certificate authority to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	ca?: string;
	/**
	 * Private key file to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	keyFile?: string;
	/**
	 * Private key to use in TLS negotiation.
	 * @type {string | undefined}
	 */
	key?: string;
}
/**
 * Contents of an ephemeral message.
 * @interface Message
 */
export interface Message {
	/**
	 * Defines the message's subject.
	 * @type {string}
	 */
	subject: string;
	/**
	 * The message itself.
	 * @type {string}
	 */
	message: Uint8Array;
	/**
	 * Optional set of key/value associated with the message.
	 * @type {MessageHeaders | undefined}
	 */
	headers?: MessageHeaders;
}
/**
 * Contents of a presistnt message.
 * @interface StreamMessage
 */
export interface StreamMessage extends Message {
	/**
	 * The sequence number of the message in the stream.
	 * @type {number}
	 */
	sequence: number;
	/**
	 * The time the message was received.
	 * @type {Date}
	 */
	timestamp: Date;
}
/**
 * A persistent message that must be acknowledged.
 * @interface StreamMessageAck
 */
export interface StreamMessageAck extends StreamMessage {
	/**
	 * Call this method to acknowledge reception and handling of this message.
	 * @method ack
	 */
	ack: () => void;
	/**
	 * Indicate to the JetStream server that processing of the message failed,
	 * and that it should be resent after the spefied number of milliseconds.
	 * @method nak
	 * @param {number|undefined} millis
	 */
	nak: (millis?: number) => void;
}
/**
 * A set of key/value items that will be associated to a given message.
 * @interface MessageHeaders
 **/
export interface MessageHeaders {
	[key: string]: string;
}
/**
 * Defines the callback function's signature when an ephemeral message is received.
 * @callback MessageCallback
 * @param {Message} msg - The received ephemeral message.
 */
export type MessageCallback = (msg: Message) => Promise<void>;
/**
 * Defines the callback function's signature when a persistent message is received.
 * @callback StreamMessageCallback
 * @param {StreamMessageAck} msg - The received persistent message with acknowledgment capabilities.
 * @returns {boolean | undefined} - If a boolean is returned, the message will be automatically acknowledged or non-acknowledged.
 */
export type StreamMessageCallback = (msg: StreamMessageAck) => boolean | undefined | Promise<boolean | undefined>;
/**
 * Configuration options for a JetStream's consumer being created or updated.
 * @interface ConsumerOptions
 **/
export interface ConsumerOptions {
	/**
	 * The topic to subscribe. If not specified, the stream's filter will be used.
	 * @type {string | string[] | undefined}
	 */
	subjectFilters?: string | string[];
	/**
	 * Indicates the start point to use to deliver messages.
	 *   All: Start receiving from the earliest available message.
	 *   New: Start receiving messages that were created after the consumer was created.
	 *   Last: Start receiving messages with the last message added to the stream, or the
	 *         last message in the stream that matches the consumer's filter subject if defined.
	 *   Subject-Last: Start with the latest one for each filtered subject currently in the stream.
	 *   Sequence: Start at the first message having the sequence number or the next one available.
	 *   Time: Start with messages on or after this time.
	 * @type {'all' | 'new' | 'last' | 'sequence' | 'time' | 'subject-last' | undefined}
	 * @default all
	 */
	deliverPolicy?: "all" | "new" | "last" | "sequence" | "time" | "subject-last";
	/**
	 * The sequence from which to start delivery messages.
	 * @type {number | undefined}
	 */
	deliverStartSequence?: number;
	/**
	 * The date time from which to start delivering messages
	 * @type {Date | undefined}
	 */
	deliverStartTime?: Date;
	/**
	 * Action to execute if the stream already exists. Can be: update, keep original or fail.
	 * @type {'update' | 'keep' | 'fail' | undefined}
	 * @default update
	 */
	existingAction?: "update" | "keep" | "fail";
}
/**
 * Warps a JetStream stream consumer.
 * @interface Consumer
 */
export interface Consumer {
	/**
	 * Instructs the server to destroy this consumer.
	 * @async
	 * @method destroy
	 */
	destroy: () => Promise<void>;
	/**
	 * Starts a subscription for messages based on the given stream and consumer.
	 * @async
	 * @method subscribe
	 * @param {StreamMessageCallback} cb - Asynchronous callback to call when a new message arrives.
	 */
	subscribe: (cb: StreamMessageCallback) => Promise<void>;
	/**
	 * Ends the subscription.
	 * It does not throw errors if the connection is closed or the subscription does not exists.
	 * @async
	 * @method unsubscribe
	 */
	unsubscribe: () => Promise<void>;
}
/**
 * Configuration options for a JetStream's stream being created or updated.
 * @interface StreamOptions
 **/
export interface StreamOptions {
	/**
	 * A human-readable description of this strean.
	 * @type {string | undefined}
	 */
	description?: string;
	/**
	 * Subjects that will be stored on this strean.
	 * @type {string | string[]}
	 */
	subjects: string | string[];
	/**
	 * Maximum storage capacity.
	 * @type {number | undefined}
	 * @default 1GB
	 */
	maxStorageSizeInBytes?: number;
	/**
	 * Persist messages until full capacity or discard them when a consumer acknowledges it.
	 * @type {boolean | undefined}
	 */
	discardAckMessages?: boolean;
	/**
	 * If deletion of messages on this strean is allowed.
	 * @type {boolean | undefined}
	 */
	disallowDelete?: boolean;
	/**
	 * Time in milliseconds to check for duplicated messages if an ID is provided. Defaults to 1 minute.
	 * @type {number | undefined}
	 * @default 60000
	 */
	duplicateWindowTimeoutMs?: number;
	/**
	 * Action to execute if the stream already exists. Can be: update, keep original or fail.
	 * @type {'update' | 'keep' | 'fail' | undefined}
	 * @default update
	 */
	existingAction?: "update" | "keep" | "fail";
	/**
	 * How many replicas to keep for each message. Between 1 and 5.
	 * @type {number | undefined}
	 * @default 1
	 */
	numReplicas?: number;
	/**
	 * The cluster to place the stream on.
	 * @type {string | undefined}
	 */
	cluster?: string;
	/**
	 * Additional tags to add in the stream configuration.
	 * @type {string[] | undefined}
	 */
	tags?: string[];
}
/**
 * Details about a stream.
 * @interface StreamInfo
 **/
export interface StreamInfo {
	/**
	 * Number of messages stored in the Stream
	 */
	messages: number;
	/**
	 * Combined size of all messages in the Stream
	 */
	bytes: number;
	/**
	 * Sequence number of the first message in the Stream
	 */
	firstSequence: number;
	/**
	 * The timestamp of the first message in the Stream
	 */
	firstTimestamp: Date;
	/**
	 * Sequence number of the last message in the Stream
	 */
	lastSequence: number;
	/**
	 * The timestamp of the last message in the Stream
	 */
	lastTimestamp: Date;
}
/**
 * Warps a JetStream stream.
 * @interface Stream
 */
export interface Stream {
	/**
	 * Gets stream information.
	 * @async
	 * @method info
	 * @returns {StreamInfo} - Stream details.
	 */
	info: () => Promise<StreamInfo>;
	/**
	 * Instructs the server to delete this stream.
	 * @async
	 * @method destroy
	 */
	destroy: () => Promise<void>;
	/**
	 * Gets an existing JetStream stream's message.
	 * @async
	 * @method getMessage
	 * @param {number} sequence - Sequence number of the message to obtain.
	 * @returns {StreamMessage | null} - Message details, if it does exist.
	 */
	getMessage: (sequence: number) => Promise<StreamMessage | null>;
	/**
	 * Deletes an existing JetStream stream's message.
	 * @async
	 * @method deleteMessage
	 * @param {number} sequence - Message sequence number to delete.
	 */
	deleteMessage: (sequence: number) => Promise<void>;
	/**
	 * Gets an existing JetStream consumer.
	 * @async
	 * @method getConsumer
	 * @param {string} name - Name of the consumer.
	 * @returns {Consumer | null} - The consumer accessor, if it does exist.
	 */
	getConsumer: (name: string) => Promise<Consumer | null>;
	/**
	 * Creates a new JetStream consumer.
	 * @async
	 * @method createConsumer
	 * @param {string} name - Name of the consumer.
	 * @param {ConsumerOptions} opts - Consumer configuration options.
	 * @returns {Consumer} - The consumer accessor.
	 */
	createConsumer: (name: string, opts: ConsumerOptions) => Promise<Consumer>;
	/**
	 * Destroys an existing JetStream consumer.
	 * It does not throw errors if the consumer does not exists.
	 * @async
	 * @method destroyConsumer
	 * @param {string} name - Name of the consumer to delete.
	 */
	destroyConsumer: (name: string) => Promise<void>;
	/**
	 * Starts a subscription for messages based on the given consumer.
	 * @async
	 * @method subscribeConsumer
	 * @param {string} name - Name of the consumer to use.
	 * @param {StreamMessageCallback} cb - Asynchronous callback to call when a new message arrives.
	 */
	subscribeConsumer: (name: string, cb: StreamMessageCallback) => Promise<void>;
	/**
	 * Ends the subscription.
	 * It does not throw errors if the connection is closed or the subscription does not exists.
	 * @async
	 * @param {string} name - Name of the consumer to unsubscribe.
	 * @method unsubscribeConsumer
	 */
	unsubscribeConsumer: (name: string) => Promise<void>;
}
/**
 * Configuration options for a persistent message about to be publised.
 * @interface StreamPublishOptions
 **/
export interface StreamPublishOptions {
	/**
	 * Optional message unique ID.
	 * @type {string|undefined}
	 */
	msgID?: string;
	/**
	 * The number of milliseconds to wait for the acknowledge.
	 * @type {number|undefined}
	 */
	timeoutMs?: number;
	/**
	 * The expected ID of the last stored message.
	 * @type {string|undefined}
	 */
	expectedLastMsgID?: string;
}
/**
 * Details about a persistent message that has been publised.
 * @interface StreamPublishedInfo
 **/
export interface StreamPublishedInfo {
	/**
	 * The message sequence number given by the store.
	 * @type {number}
	 */
	sequence: number;
	/**
	 * For messages with unique ID, this value indicates if an existing message with the same ID already exists.
	 * @type {boolean}
	 */
	duplicate: boolean;
}
/**
 * Configuration options for a JetStream's KV bucket being created or updated.
 * @interface KvBucketOptions
 **/
export interface KvBucketOptions {
	/**
	 * A human-readable description of this strean.
	 * @type {string | undefined}
	 */
	description?: string;
	/**
	 * Number of maximum messages allowed per subject (key).
	 * @type {number | undefined}
	 */
	maxHistory?: number;
	/**
	 * Maximum storage capacity.
	 * @type {number | undefined}
	 * @default 1MB
	 */
	maxStorageSizeInBytes?: number;
	/**
	 * The maximum number of millis the key should live in the KV. The server will automatically remove
	 * keys older than this amount. Note that deletion of delete markers are not performed.
	 * @type {number | undefined}
	 */
	ttl?: number;
	/**
	 * How many replicas to keep for each message. Between 1 and 5.
	 * @type {number | undefined}
	 * @default 1
	 */
	numReplicas?: number;
	/**
	 * The cluster to place the stream on.
	 * @type {string | undefined}
	 */
	cluster?: string;
	/**
	 * Additional tags to add in the stream configuration.
	 * @type {string[] | undefined}
	 */
	tags?: string[];
}
/**
 * Warps a JetStream KV bucket.
 * @interface KvBucket
 */
export interface KvBucket {
	/**
	 * Instructs the server to destroy this key/value bucket.
	 * @async
	 * @method destroy
	 */
	destroy: () => Promise<void>;
	/**
	 * Verifies if the given key is present on the bucket.
	 * @async
	 * @method has
	 * @param {string} key - The key to verify.
	 * @returns {boolean} - If the key does exist.
	 */
	has: (key: string) => Promise<boolean>;
	/**
	 * Gets the value of a given key.
	 * @async
	 * @method get
	 * @param {string} key - The key to retrieve.
	 * @returns {KvEntry | null} - Item entry.
	 */
	get: (key: string) => Promise<KvEntry | null>;
	/**
	 * Stores a new key/value pair.
	 * @async
	 * @method put
	 * @param {string} key - The key.
	 * @param {Uint8Array} value - The value.
	 * @param {KvPutOptions} opts - A set of options.
	 * @returns {number} - The stored entry's sequence number.
	 */
	put: (key: string, value: Uint8Array, opts?: KvPutOptions) => Promise<number>;
	/**
	 * Deletes a key from the bucket.
	 * @async
	 * @method del
	 * @param {string} key - The key to delete.
	 * @param {KvDeleteOptions} opts - A set of options.
	 */
	del: (key: string, opts?: KvDeleteOptions) => Promise<void>;
	/**
	 * Gets a list of keys matching the given filter.
	 * @async
	 * @method keys
	 * @param {string} filter - Filter spec.
	 * @returns {string[]} - An array of matching keys.
	 */
	keys(filter?: string): Promise<string[]>;
}
/**
 * Represents a key/value entry.
 * @interface KvEntry
 **/
export interface KvEntry {
	/**
	 * The value itself.
	 */
	value: Uint8Array;
	/**
	 * The sequence number of the entry in the bucket.
	 * @type {number}
	 */
	sequence: number;
	/**
	 * The time the entry was stored.
	 * @type {Date}
	 */
	timestamp: Date;
}
/**
 * Configuration options for storing a value.
 * @interface KvPutOptions
 **/
export interface KvPutOptions {
	/**
	 * The value will be stored only if the previously stored sequence number matches.
	 */
	sequence?: number;
}
/**
 * Configuration options for deleting a value.
 * @interface KvDeleteOptions
 **/
export interface KvDeleteOptions {
	/**
	 * The value will be deleted only if the previously stored sequence number matches.
	 * @type {number}
	 */
	sequence?: number;
	/**
	 * Deletes a value and the complete history of changes.
	 * @type {boolean}
	 */
	purge?: boolean;
}
/**
 * Implements a connector to a NATS.io JetStream instance.
 * @class Client
 */
export declare class Client extends EventEmitter {
	private _name;
	private conn;
	private jsm;
	private js;
	private internals;
	/**
	 * Creates a new NATS.io/JetStream client object.
	 * @async
	 * @method create
	 * @param {ClientOptions} opts - Configuration options.
	 * @returns {Client} - The client accessor.
	 */
	static create(opts: ClientOptions): Promise<Client>;
	/**
	 * @constructor
	 * @param {NatsConnection} conn - Established connection to server
	 * @param {JetStreamManager} jsm - JetStream manager
	 */
	protected constructor(_name: string, conn: nats.NatsConnection, jsm: nats.JetStreamManager);
	/**
	 * Gets the client name.
	 * @property name
	 */
	get name(): string;
	/**
	 * Closes the connection to the server. Pending messages will be dropped.
	 * @async
	 * @method close
	 */
	close(): Promise<void>;
	/**
	 * Delivers an ephemeral message.
	 * @method publish
	 * @param {string} subject - The message's topic.
	 * @param {Uint8Array} message - The message to send
	 * @param {MessageHeaders} headers - Optional headers associated to the message.
	 */
	publish(subject: string, message: Uint8Array, headers?: MessageHeaders): void;
	/**
	 * Creates a subscription for ephemeral messages based on the given subject.
	 * @method subscribe
	 * @param {string} subject - The topic to subscribe.
	 * @param {MessageCallback} cb - Asynchronous callback to call when a new message arrives.
	 */
	subscribe(subject: string, cb: MessageCallback): void;
	/**
	 * Destroys an active subscription for ephemeral messages on the given subject.
	 * It does not throw errors if the connection is closed or the subscription does not exists.
	 * @method unsubscribe
	 * @param {string} subject - The topic to unsubscribe.
	 */
	unsubscribe(subject: string): void;
	/**
	 * Gets an existing JetStream stream.
	 * @async
	 * @method getStream
	 * @param {string} name - Name of the message store.
	 * @returns {Stream} - The stream accessor.
	 */
	getStream(name: string): Promise<Stream | null>;
	/**
	 * Creates a new JetStream stream.
	 * @async
	 * @method createStream
	 * @param {string} name - Name of the message store.
	 * @param {StreamOptions} opts - Stream configuration options.
	 * @returns {Stream} - The stream accessor.
	 */
	createStream(name: string, opts: StreamOptions): Promise<Stream>;
	/**
	 * Deletes an existing JetStream stream.
	 * It does not throw errors if the stream does not exists.
	 * @async
	 * @method destroyStream
	 * @param {string} name - Name of the stream to delete.
	 */
	destroyStream(name: string): Promise<void>;
	/**
	 * Gets an existing KV bucket.
	 * @async
	 * @method getKvBucket
	 * @param {string} name - Name of the bucket.
	 * @returns {KvBucket} - The KeyValue bucket accessor.
	 */
	getKvBucket(name: string): Promise<KvBucket | null>;
	/**
	 * Creates a new KV bucket.
	 * @async
	 * @method createKvBucket
	 * @param {string} name - Name of the bucket.
	 * @param {KvBucketOptions} opts - Bucket configuration options.
	 * @returns {KvBucket} - The KeyValue bucket accessor.
	 */
	createKvBucket(name: string, opts?: KvBucketOptions): Promise<KvBucket>;
	/**
	 * Deletes an existing KV bucket.
	 * It does not throw errors if the bucket does not exists.
	 * @async
	 * @method destroyKvBucket
	 * @param {string} name - Name of the bucket to delete.
	 */
	destroyKvBucket(name: string): Promise<void>;
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
	publishToStream(subject: string, message: Uint8Array, headers?: MessageHeaders, opts?: StreamPublishOptions): Promise<StreamPublishedInfo>;
	/**
	 * Raises events if the connection is up or down.
	 * @async
	 * @method statusMonitor
	 */
	private statusMonitor;
}

export {};
