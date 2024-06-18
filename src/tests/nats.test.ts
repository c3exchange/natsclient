import test, { ExecutionContext } from 'ava';
import { Client, Message } from '..';
import { loadConfig, sleep, encodeMsg, decodeMsg, generateTestMsg, verifyTestMsg, monitorClientAndLog, getTimestamp, getConfig } from './helpers';

// -----------------------------------------------------------------------------

test.before('Loading settings...', (t: ExecutionContext) => {
	loadConfig(t);
});

test('NATS test', async (t: ExecutionContext) => {
	let producer!: Client;
	let consumer!: Client;
	try {
		// Connect to the test server
		t.log(getTimestamp() + ' | Connecting...');
		producer = await Client.create({
			...getConfig(),
			name: 'NatsJetstreamClient-basic-test-producer'
		});
		monitorClientAndLog(t, producer);
		consumer = await Client.create({
			...getConfig(),
			name: 'NatsJetstreamClient-basic-test-consumer'
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
		consumer.subscribe('TEST_CHANNEL.*', async (msg: Message) => {
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

		consumer.subscribe('TEST_CHANNEL.ODD', async (msg: Message) => {
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

		consumer.subscribe('TEST_CHANNEL.EVEN', async (msg: Message) => {
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
			t.fail(getTimestamp() + ' | Not all messages were received in a timely fashion');
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
