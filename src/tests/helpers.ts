import colors from 'ansi-colors';
import { Client } from '..';

// -----------------------------------------------------------------------------

export const getTimestamp = (): string => {
	const now = new Date();
	const hours = String(now.getUTCHours()).padStart(2, '0');
	const minutes = String(now.getUTCMinutes()).padStart(2, '0');
	const seconds = String(now.getUTCSeconds()).padStart(2, '0');
	const milliseconds = String(now.getUTCMilliseconds()).padStart(3, '0');

	return `${hours}:${minutes}:${seconds}.${milliseconds}`;
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
	client.on('status', (connection) => {
		log(client.name + '/Status: ' + connection);
	});
};
