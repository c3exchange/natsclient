import { JetStreamManager, NatsConnection } from 'nats';
import { EventEmitter } from 'node:events';

/**
 * NATS/JetStream client side configuration options.
 * @interface NatsClientOptions
 */
export interface NatsClientOptions {
	/**
	 * List of servers to use. in [{protocol}://]{host}[:{port}] format.
	 * @type {string|string[]}
	 */
	servers: string | string[];
	/**
	 * Configure if a secure channel must be used.
	 * @type {NatsClientTlsConfig | 'enforce' | 'never' | 'auto'}
	 * @default "auto"
	 */
	tls?: NatsClientTlsConfig | "enforce" | "never" | "auto";
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
 * TLS configuration options used while connecting to a server.
 * @interface NatsClientTlsConfig
 */
export interface NatsClientTlsConfig {
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
 * @interface NatsMessage
 */
export interface NatsMessage {
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
	 * @type {NatsMessageHeaders | undefined}
	 */
	headers?: NatsMessageHeaders;
}
/**
 * Contents of a presistnt message.
 * @interface NatsStreamMessage
 */
export interface NatsStreamMessage extends NatsMessage {
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
 * @interface NatsStreamMessageAck
 */
export interface NatsStreamMessageAck extends NatsStreamMessage {
	/**
	 * Call this method to acknowledge reception and handling of this message.
	 * @method ack
	 */
	ack: () => void;
	/**
	 * Indicate to the JetStream server that processing of the message failed,
	 * and that it should be resent after the spefied number of milliseconds.
	 * @param {number|undefined} millis
	 */
	nak: (millis?: number) => void;
}
/**
 * A set of key/value items that will be associated to a given message.
 * @interface NatsMessageHeaders
 **/
export interface NatsMessageHeaders {
	[key: string]: string;
}
/**
 * Configuration options for a JetStream's stream being created or updated.
 * @interface NatsStreamOptions
 **/
export interface NatsStreamOptions {
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
	 * @type {number}
	 */
	maxStorageSizeInBytes: number;
	/**
	 * Persist messages until full capacity or discard them when a consumer acknowledges it.
	 * @type {boolean|undefined}
	 */
	discardAckMessages?: boolean;
	/**
	 * If deletion of messages on this strean is allowed.
	 * @type {boolean|undefined}
	 */
	disallowDelete?: boolean;
	/**
	 * Time in milliseconds to check for duplicated messages if an ID is provided. Defaults to 1 minute.
	 * @type {number|undefined}
	 * @default 60000
	 */
	duplicateWindowTimeoutMs?: number;
	/**
	 * Action to execute if the stream already exists. Can be: update, keep original or fail.
	 * @type {'update'|'keep'|'fail'|undefined}
	 * @default update
	 */
	existingAction?: "update" | "keep" | "fail";
}
/**
 * Configuration options for a JetStream's consumer being created or updated.
 * @interface NatsConsumerOptions
 **/
export interface NatsConsumerOptions {
	/**
	 * The topic to subscribe. If not specified, the stream's filter will be used.
	 * @type {string|undefined}
	 */
	subjectFilter?: string;
	/**
	 * Indicates the start point to use to deliver messages.
	 *   All: Start receiving from the earliest available message.
	 *   New: Start receiving messages that were created after the consumer was created.
	 *   Last: Start receiving messages with the last message added to the stream, or the
	 *         last message in the stream that matches the consumer's filter subject if defined.
	 *   Subject-Last: Start with the latest one for each filtered subject currently in the stream.
	 *   Sequence: Start at the first message having the sequence number or the next one available.
	 *   Time: Start with messages on or after this time.
	 * @type {'all' | 'new' | 'last' | 'sequence' | 'time' | 'subject-last'}
	 * @default new
	 */
	deliverPolicy?: "all" | "new" | "last" | "sequence" | "time" | "subject-last";
	/**
	 * The sequence from which to start delivery messages.
	 * @type {number|undefined}
	 */
	deliverStartSequence?: number;
	/**
	 * The date time from which to start delivering messages
	 * @type {Date|undefined}
	 */
	deliverStartTime?: Date;
	/**
	 * Action to execute if the stream already exists. Can be: update, keep original or fail.
	 * @type {'update'|'keep'|'fail'|undefined}
	 * @default update
	 */
	existingAction?: "update" | "keep" | "fail";
}
/**
 * Configuration options for a persistent message about to be publised.
 * @interface NatsStreamPublishOptions
 **/
export interface NatsStreamPublishOptions {
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
 * @interface NatsStreamPublishedInfo
 **/
export interface NatsStreamPublishedInfo {
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
 * Details about a stream.
 * @interface NatsClientStreamInfo
 **/
export interface NatsClientStreamInfo {
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
 * @interface NatsClientStream
 */
export interface NatsClientStream {
	/**
	 * Gets stream information.
	 * @async
	 * @method info
	 */
	info: () => Promise<NatsClientStreamInfo>;
	/**
	 * Instructs the server to delete this stream.
	 * @async
	 * @method delete
	 */
	delete: () => Promise<void>;
	/**
	 * Gets an existing JetStream stream's message.
	 * @async
	 * @method getMessage
	 * @param {number} sequence - Sequence number of the message to obtain.
	 */
	getMessage: (sequence: number) => Promise<NatsStreamMessage>;
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
	 */
	getConsumer: (name: string) => Promise<NatsClientConsumer>;
	/**
	 * Creates a new JetStream consumer.
	 * @async
	 * @method createConsumer
	 * @param {string} name - Name of the consumer.
	 * @param {NatsClientConsumer} opts - Consumer configuration options.
	 */
	createConsumer: (name: string, opts: NatsConsumerOptions) => Promise<NatsClientConsumer>;
	/**
	 * Deletes an existing JetStream consumer.
	 * It does not throw errors if the consumer does not exists.
	 * @async
	 * @method deleteConsumer
	 * @param {string} name - Name of the consumer to delete.
	 */
	deleteConsumer: (name: string) => Promise<void>;
}
/**
 * Warps a JetStream stream consumer.
 * @interface NatsClientConsumer
 */
export interface NatsClientConsumer {
	/**
	 * Instructs the server to delete this consumer.
	 * @async
	 * @method delete
	 */
	delete: () => Promise<void>;
	/**
	 * Starts a subscription for messages based on the given stream and consumer.
	 * @async
	 * @method subscribe
	 * @param {NatsStreamMessageCallback} cb - Asynchronous callback to call when a new message arrives.
	 */
	subscribe: (cb: NatsStreamMessageCallback) => Promise<void>;
	/**
	 * Ends the subscription.
	 * It does not throw errors if the connection is closed or the subscription does not exists.
	 * @async
	 * @method subscribe
	 */
	unsubscribe: () => Promise<void>;
}
/**
 * Defines the callback function's signature when an ephemeral message is received.
 * @callback NatsMessageCallback
 * @param {NatsMessage} msg - The received ephemeral message.
 */
export type NatsMessageCallback = (msg: NatsMessage) => Promise<void>;
/**
 * Defines the callback function's signature when a persistent message is received.
 * @callback NatsStreamMessageCallback
 * @param {NatsStreamMessageAck} msg - The received persistent message with acknowledgment capabilities.
 * @returns {Promise<boolean | undefined>} - If a boolean is returned, the message will be automatically acknowledged or non-acknowledged.
 */
export type NatsStreamMessageCallback = (msg: NatsStreamMessageAck) => Promise<boolean | undefined>;
/**
 * Implements a connector to a NATS.io JetStream instance.
 * @class NatsClient
 */
export declare class NatsClient extends EventEmitter {
	private _name;
	private conn;
	private jsm;
	private js;
	private internals;
	/**
	 * Creates a new NATS.io/JetStream client object.
	 * @async
	 * @method create
	 * @param {NatsClientOptions} opts - Configuration options.
	 * @returns {NatsClient}
	 */
	static create(opts: NatsClientOptions): Promise<NatsClient>;
	/**
	 * @constructor
	 * @param {NatsConnection} conn - Established connection to server
	 * @param {JetStreamManager} jsm - JetStream manager
	 */
	protected constructor(_name: string, conn: NatsConnection, jsm: JetStreamManager);
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
	 * @param {NatsMessageHeaders} headers - Optional headers associated to the message.
	 */
	publish(subject: string, message: Uint8Array, headers?: NatsMessageHeaders): void;
	/**
	 * Creates a subscription for ephemeral messages based on the given subject.
	 * @method subscribe
	 * @param {string} subject - The topic to subscribe.
	 * @param {NatsMessageCallback} cb - Asynchronous callback to call when a new message arrives.
	 */
	subscribe(subject: string, cb: NatsMessageCallback): void;
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
	 */
	getStream(name: string): Promise<NatsClientStream>;
	/**
	 * Creates a new JetStream stream.
	 * @async
	 * @method createStream
	 * @param {string} name - Name of the message store.
	 * @param {NatsStreamOptions} opts - Stream configuration options.
	 */
	createStream(name: string, opts: NatsStreamOptions): Promise<NatsClientStream>;
	/**
	 * Deletes an existing JetStream stream.
	 * It does not throw errors if the stream does not exists.
	 * @async
	 * @method deleteStream
	 * @param {string} name - Name of the stream to delete.
	 */
	deleteStream(name: string): Promise<void>;
	/**
	 * Delivers a persistent message
	 * @async
	 * @method publishToStream
	 * @param {string} subject - The message's topic.
	 * @param {Uint8Array} message - The message to send
	 * @param {NatsMessageHeaders} headers - Optional headers associated to the message.
	 * @param {NatsStreamPublishOptions} opts - Extended message options.
	 */
	publishToStream(subject: string, message: Uint8Array, headers?: NatsMessageHeaders, opts?: NatsStreamPublishOptions): Promise<NatsStreamPublishedInfo>;
	/**
	 * Raises events if the connection is up or down.
	 * @async
	 * @method statusMonitor
	 */
	private statusMonitor;
}

export {};
