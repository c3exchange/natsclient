import * as nats from 'nats';
import { KvBucket, KvEntry, KvDeleteOptions, KvPutOptions } from '../types';
import { SharedInternals } from './internals';
import { isLastSequenceMismatchError, isStreamNotFoundError } from '../helpers/errors';

// -----------------------------------------------------------------------------

/**
 * @inheritdoc
 */
export class KvBucketImpl implements KvBucket {
	constructor(private kv: nats.KV, private internals: SharedInternals) {
	}

	/**
	 * @inheritdoc
	 */
	public async destroy(): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Delete bucket
		try {
			await this.kv.destroy();
		}
		catch (err: any) {
			// Ignore error if the bucket is not found
			if (!isStreamNotFoundError(err)) {
				throw err;
			}
		}
	}

	/**
	 * @inheritdoc
	 */
	public async has(key: string): Promise<boolean> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Get the entry to check if it present
		const entry = await this.kv.get(key);
		return (entry) ? true : false;
	}

	/**
	 * @inheritdoc
	 */
	public async get(key: string): Promise<KvEntry | null> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Get entry and return its value
		const entry = await this.kv.get(key);
		if (!entry) {
			return null;
		}

		// Done
		return {
			value: entry.value,
			timestamp: entry.created,
			sequence: entry.revision
		}
	}

	/**
	 * @inheritdoc
	 */
	public async put(key: string, value: Uint8Array, opts?: KvPutOptions): Promise<number> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Configure the put command
		const putOptions: Partial<nats.KvPutOptions> = {};
		if (opts) {
			if (typeof opts.sequence !== 'undefined') {
				putOptions.previousSeq = opts.sequence;
			}
		}

		// Store value
		let seq: number;
		try {
			seq  = await this.kv.put(key, value, putOptions);
		}
		catch (err: any) {
			if (isLastSequenceMismatchError(err)) {
				throw new Error('NatsJetstreamClient: Last sequence mismatch');
			}
			throw err;
		}

		// Return sequence number
		return seq;
	}

	/**
	 * @inheritdoc
	 */
	public async del(key: string, opts?: KvDeleteOptions): Promise<void> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		// Configure the delete command
		const deleteOptions: Partial<nats.KvDeleteOptions> = {};
		if (opts) {
			if (typeof opts.sequence !== 'undefined') {
				deleteOptions.previousSeq = opts.sequence;
			}
		}

		// Delete/purge key
		try {
			if (opts?.purge) {
				await this.kv.purge(key, deleteOptions);
			}
			else {
				await this.kv.delete(key, deleteOptions);
			}
		}
		catch (err: any) {
			if (isLastSequenceMismatchError(err)) {
				throw new Error('NatsJetstreamClient: Last sequence mismatch');
			}
			throw err;
		}
	}

	/**
	 * @inheritdoc
	 */
	public async keys(filter?: string): Promise<string[]> {
		if (this.internals.isClosed()) {
			throw new Error('NatsJetstreamClient: connection is closed');
		}

		const res = [];
		const iter = await this.kv.keys(filter);
		for await (const key of iter) {
			res.push(key);
		}

		// Done
		return res;
	}
};
