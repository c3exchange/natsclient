import { Consumer, ConsumerOptions } from './consumers';
import { StreamMessage, StreamMessageCallback } from './messages';

// -----------------------------------------------------------------------------

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
	existingAction?: 'update' | 'keep' | 'fail';

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
};

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
};

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
};

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
};

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
};
