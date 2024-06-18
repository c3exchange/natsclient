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
};

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
};

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
};

/**
 * Configuration options for storing a value.
 * @interface KvPutOptions
 **/
export interface KvPutOptions {
	/**
	 * The value will be stored only if the previously stored sequence number matches.
	 */
	sequence?: number;
};

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
};
