
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
};

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
};

/**
 * A persistent message that must be acknowledged.
 * @interface StreamMessageAck
 */
export interface StreamMessageAck extends StreamMessage {
	/**
	 * Call this method to acknowledge reception and handling of this message.
	 * @method ack
	 */
	ack: () => void

	/**
	 * Indicate to the JetStream server that processing of the message failed,
	 * and that it should be resent after the spefied number of milliseconds.
	 * @method nak
	 * @param {number|undefined} millis
	 */
	nak: (millis?: number) => void
};

/**
 * A set of key/value items that will be associated to a given message.
 * @interface MessageHeaders
 **/
export interface MessageHeaders {
	[key: string]: string;
};

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
