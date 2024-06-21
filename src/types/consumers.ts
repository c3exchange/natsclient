import { StreamMessageCallback } from './messages';

// -----------------------------------------------------------------------------

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
	deliverPolicy?: 'all' | 'new' | 'last' | 'sequence' | 'time' | 'subject-last';

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
	existingAction?: 'update' | 'keep' | 'fail';
};

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
};
