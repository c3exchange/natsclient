import { strict as assert } from 'node:assert';
import { config as dotEnvConfig } from 'dotenv';
import path from 'path';
import colors from 'ansi-colors';
import { Client, ClientCredentials } from '..';

// -----------------------------------------------------------------------------

interface Config {
	servers: string | string[];
	credentials: ClientCredentials;
};

// -----------------------------------------------------------------------------

export const getTimestamp = (): string => {
	const now = new Date();
	const hours = String(now.getUTCHours()).padStart(2, '0');
	const minutes = String(now.getUTCMinutes()).padStart(2, '0');
	const seconds = String(now.getUTCSeconds()).padStart(2, '0');
	const milliseconds = String(now.getUTCMilliseconds()).padStart(3, '0');

	return `${hours}:${minutes}:${seconds}.${milliseconds}`;
};

export const loadConfig = (): void => {
	log('Loading settings...');

	dotEnvConfig({
		path: path.resolve(process.cwd(), 'tests.env'),
		override: true
	});

	assert(typeof process.env['NATS_TEST_HOST'] === 'string', 'NATS_TEST_HOST not found or empty');
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	assert(process.env['NATS_TEST_HOST']!.length > 0, 'NATS_TEST_HOST not found or empty');

	assert(typeof process.env['NATS_TEST_JWT'] === 'string', 'NATS_TEST_JWT not found or empty');
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	assert(process.env['NATS_TEST_JWT']!.length > 0, 'NATS_TEST_JWT not found or empty');

	assert(typeof process.env['NATS_TEST_NKEY_SEED'] === 'string', 'NATS_TEST_NKEY_SEED not found or empty');
	// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
	assert(process.env['NATS_TEST_NKEY_SEED']!.length > 0, 'NATS_TEST_NKEY_SEED not found or empty');
};

export const getConfig = (): Config => {
	return {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		servers: process.env['NATS_TEST_HOST']!.split(',').map((elem) => elem.trim()),
		credentials: {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			jwt: process.env['NATS_TEST_JWT']!,
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			nkeySeed: process.env['NATS_TEST_NKEY_SEED']!
		}
	};
};

export const log = (msg: string, type?: string): void => {
	if (type === 'title') {
		msg = colors.yellow(msg);
	}
	else if (type === 'success') {
		msg = colors.greenBright(msg);
	}
	else if (type === 'error') {
		msg = colors.redBright(msg);
	}
	console.log(colors.cyan(getTimestamp()) + ' ' + colors.yellow('|') + ' ' + msg);
};

export const errMsg = (err: any): string => {
	if (err.message) {
		return err.message;
	}
	if (err.toString) {
		return err.toString();
	}
	return 'unknown error';
};

export const sleep = async (timeoutMs: number): Promise<void> => {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, timeoutMs);
	});
};

export const encodeMsg = (msg: string): Uint8Array => {
	return new Uint8Array(Buffer.from(msg, 'utf8'));
};

export const decodeMsg = (msg: Uint8Array): string => {
	return Buffer.from(msg).toString('utf8');
};

export const generateTestMsg = (i: number): string => {
	return 'Number ' + i.toString();
};

export const verifyTestMsg = (s: string): number => {
	if (!s.startsWith('Number ')) {
		return -1
	}
	return parseInt(s.substring(7), 10);
};

export const monitorClientAndLog = (client: Client) => {
	client.on('status', (status: Record<string, any>) => {
		log(client.name + '/Status: ' + status.connection);
	});
};
