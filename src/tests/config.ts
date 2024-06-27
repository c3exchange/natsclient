import { strict as assert } from 'node:assert';
import { config as dotEnvConfig } from 'dotenv';
import path from 'path';
import { parseArgs } from 'node:util';
import { ClientCredentials, ClientTlsConfig } from '../types';
import { log } from './helpers';

// -----------------------------------------------------------------------------

interface Config {
	servers: string | string[];
	credentials: ClientCredentials;
	debug: boolean;
	tls?: ClientTlsConfig;
};

// -----------------------------------------------------------------------------

let config: Config;

// -----------------------------------------------------------------------------

export const loadConfig = (): void => {
	log('Loading settings...');

	const { values } = parseArgs({
		args: process.argv.slice(2),
		options: {
			env: {
				type: 'string',
				default: 'tests.env'
			},
			debug: {
				type: 'boolean',
				default: false
			},
		}
	});
	dotEnvConfig({
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		path: path.resolve(process.cwd(), values.env!),
		override: true
	});

	assert(typeof process.env['NATS_TEST_HOST'] === 'string', 'NATS_TEST_HOST not found or empty');
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	assert(process.env['NATS_TEST_HOST']!.length > 0, 'NATS_TEST_HOST not found or empty');

	let useTls = false;
	if (process.env['NATS_TEST_HOST'].startsWith('tls://')) {
		useTls = true;
	}

	if (typeof process.env['NATS_TEST_JWT'] === 'string' && process.env['NATS_TEST_JWT'].length > 0) {
		assert(typeof process.env['NATS_TEST_JWT'] === 'string', 'NATS_TEST_JWT not found or empty');
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		assert(process.env['NATS_TEST_JWT']!.length > 0, 'NATS_TEST_JWT not found or empty');

		assert(typeof process.env['NATS_TEST_NKEY_SEED'] === 'string', 'NATS_TEST_NKEY_SEED not found or empty');
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		assert(process.env['NATS_TEST_NKEY_SEED']!.length > 0, 'NATS_TEST_NKEY_SEED not found or empty');
	}
	else if (typeof process.env['NATS_TEST_USER'] === 'string' && process.env['NATS_TEST_USER'].length > 0) {
		assert(typeof process.env['NATS_TEST_USER'] === 'string', 'NATS_TEST_USER not found or empty');
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		assert(process.env['NATS_TEST_USER']!.length > 0, 'NATS_TEST_USER not found or empty');

		assert(typeof process.env['NATS_TEST_PASS'] === 'string', 'NATS_TEST_PASS not found or empty');
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		assert(process.env['NATS_TEST_PASS']!.length > 0, 'NATS_TEST_PASS not found or empty');
	}
	else {
		assert(typeof process.env['NATS_TEST_TOKEN'] === 'string', 'NATS_TEST_JWT, NATS_TEST_USER or NATS_TEST_TOKEN not found or empty');
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		assert(process.env['NATS_TEST_TOKEN']!.length > 0, 'NATS_TEST_TOKEN not found or empty');
	}

	let credentials: any;

	if (typeof process.env['NATS_TEST_JWT'] === 'string' && process.env['NATS_TEST_JWT'].length > 0) {
		credentials = {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			jwt: process.env['NATS_TEST_JWT']!,
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			nkeySeed: process.env['NATS_TEST_NKEY_SEED']!
		}
	}
	else if (typeof process.env['NATS_TEST_USER'] === 'string' && process.env['NATS_TEST_USER'].length > 0) {
		credentials = {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			username: process.env['NATS_TEST_USER']!,
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			password: process.env['NATS_TEST_PASS']!
		}
	}
	else {
		credentials = {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			token: process.env['NATS_TEST_TOKEN']!
		}
	}

	config = {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		servers: process.env['NATS_TEST_HOST']!.split(',').map((elem) => elem.trim()),
		credentials,
		tls: useTls ? {} : 'never',
		debug: values.debug || false
	};
};

export const getConfig = (): Config => {
	return config;
};
