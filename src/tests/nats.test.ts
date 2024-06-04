import test, { ExecutionContext } from 'ava';
import { NatsClient } from '../index';
import { NatsMessage } from '../types';
import { loadConfig, sleep, encodeMsg, decodeMsg, generateTestMsg, verifyTestMsg, monitorClientAndLog, getTimestamp } from './helpers';

// -----------------------------------------------------------------------------

test.before('Loading settings...', () => {
	loadConfig();
});

test('NatsClient basic test', async (t: ExecutionContext) => {
	if (typeof process.env['NATS_TEST_HOST'] !== 'string' || process.env['NATS_TEST_HOST'].length == 0) {
		t.fail('NATS_TEST_HOST not found. Cannot continue this test.');
	}
	if (typeof process.env['NATS_TEST_JWT'] !== 'string' || process.env['NATS_TEST_JWT'].length == 0) {
		t.fail('NATS_TEST_JWT not found. Cannot continue this test.');
	}
	if (typeof process.env['NATS_TEST_NKEY_SEED'] !== 'string' || process.env['NATS_TEST_NKEY_SEED'].length == 0) {
		t.fail('NATS_TEST_JWT not found. Cannot continue this test.');
	}

	let producer!: NatsClient;
	let consumer!: NatsClient;
	try {
		// Connect to the test server
		t.log(getTimestamp() + ' | Connecting...');
		producer = await NatsClient.create({
			servers: process.env['NATS_TEST_HOST'],
			jwt: process.env['NATS_TEST_JWT'],
			nkeySeed: process.env['NATS_TEST_NKEY_SEED'],
			name: 'NatsClient-basic-test-producer'
		});
		monitorClientAndLog(t, producer);
		consumer = await NatsClient.create({
			servers: process.env['NATS_TEST_HOST'],
			jwt: process.env['NATS_TEST_JWT'],
			nkeySeed: process.env['NATS_TEST_NKEY_SEED'],
			name: 'NatsClient-basic-test-consumer'
		});
		monitorClientAndLog(t, consumer);

		let receivedAll = 0;
		const receivedAllValues = new Map<number, boolean>();
		let receivedOdd = 0;
		const receivedOddValues = new Map<number, boolean>();
		let receivedEven = 0;
		const receivedEvenValues = new Map<number, boolean>();
		let asyncFail = '';

		// Set up subscriptions
		t.log(getTimestamp() + ' | Subscribing consumers...');
		consumer.subscribe('TEST_CHANNEL.*', async (msg: NatsMessage) => {
			const s = decodeMsg(msg.message);
			t.log(getTimestamp() + ' | [TEST_CHANNEL.*] Received: ' + s);

			const value = verifyTestMsg(s);
			if (value < 1 || value > 10) {
				if (asyncFail.length == 0) {
					asyncFail = 'Unexpected value';
				}
				return;
			}
			if (receivedAllValues.has(value)) {
				if (asyncFail.length == 0) {
					asyncFail = 'Value already received';
				}
				return;
			}

			receivedAllValues.set(value, true);
			receivedAll += 1;
		});

		consumer.subscribe('TEST_CHANNEL.ODD', async (msg: NatsMessage) => {
			const s = decodeMsg(msg.message);
			t.log(getTimestamp() + ' | [TEST_CHANNEL.ODD] Received: ' + s);

			const value = verifyTestMsg(s);
			if (value < 1 || value > 10 || (value & 1) == 0) {
				if (asyncFail.length == 0) {
					asyncFail = 'Unexpected value';
				}
				return;
			}
			if (receivedOddValues.has(value)) {
				if (asyncFail.length == 0) {
					asyncFail = 'Value already received';
				}
				return;
			}

			receivedOddValues.set(value, true);
			receivedOdd += 1;
		});

		consumer.subscribe('TEST_CHANNEL.EVEN', async (msg: NatsMessage) => {
			const s = decodeMsg(msg.message);
			t.log(getTimestamp() + ' | [TEST_CHANNEL.EVEN] Received: ' + s);

			const value = verifyTestMsg(s);
			if (value < 1 || value > 10 || (value & 1) != 0) {
				if (asyncFail.length == 0) {
					asyncFail = 'Unexpected value';
				}
				return;
			}
			if (receivedEvenValues.has(value)) {
				if (asyncFail.length == 0) {
					asyncFail = 'Value already received';
				}
				return;
			}

			receivedEvenValues.set(value, true);
			receivedEven += 1;
		});

		// Publish messages from 1 to 10
		t.log(getTimestamp() + ' | Publishing messages...');
		for (let i = 1; i <= 10; i++) {
			const msg = encodeMsg(generateTestMsg(i));
			const subject = 'TEST_CHANNEL.' + (((i & 1) == 0) ? 'EVEN' : 'ODD');
			producer.publish(subject, msg);
		}

		// Wait until completed for 10 seconds
		t.log(getTimestamp() + ' | Waiting 10 seconds...');
		let completed = false;
		for (let timer = 100; timer > 0; timer--) {
			await sleep(100);
			if (asyncFail.length > 0) {
				t.fail(asyncFail);
			}
			if (receivedAll == 10 && receivedEven == 5 && receivedOdd == 5) {
				completed = true;
				break;
			}
		}
		if (completed) {
			t.log(getTimestamp() + ' | Done!');
		}
		else {
			t.fail('Not all messages were received in a timely fashion');
		}
	}
	finally {
		// Close
		if (consumer) {
			await consumer.close();
		}
		if (producer) {
			await producer.close();
		}
	}

	// Done
	t.pass();
});
