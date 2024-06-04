import { ExecutionContext } from 'ava';
import { config as dotEnvConfig } from 'dotenv';
import path from 'path';
import { NatsClient } from '..';

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
	dotEnvConfig({
		path: path.resolve(process.cwd(), 'tests.env'),
		override: true
	});
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

export const monitorClientAndLog = (t: ExecutionContext, client: NatsClient) => {
	client.on('status', (status: Record<string, any>) => {
		t.log('[' + client.name + '] status: ' + status.connection);
	});
};
