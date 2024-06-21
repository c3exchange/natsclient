import { strict as assert } from 'node:assert';
import { Client, Message } from '..';
import { loadConfig, encodeMsg, decodeMsg, generateTestMsg, verifyTestMsg, log, sleep, monitorClientAndLog, getConfig } from './helpers';

// -----------------------------------------------------------------------------

const runTests = async () => {
	log('Starting NATS test', 'title');

	loadConfig();

	// Connect to the test server
	log('Connecting...');
	const producer = await Client.create({
		...getConfig(),
		name: 'NatsJetstreamClient-basic-test-producer'
	});
	monitorClientAndLog(producer);
	const consumer = await Client.create({
		...getConfig(),
		name: 'NatsJetstreamClient-basic-test-consumer'
	});
	monitorClientAndLog(consumer);

	let receivedAll = 0;
	const receivedAllValues = new Map<number, boolean>();
	let receivedOdd = 0;
	const receivedOddValues = new Map<number, boolean>();
	let receivedEven = 0;
	const receivedEvenValues = new Map<number, boolean>();

	// Set up subscriptions
	log('Subscribing consumers...');
	consumer.subscribe('TEST_CHANNEL.*', async (msg: Message) => {
		const s = decodeMsg(msg.message);
		log('[TEST_CHANNEL.*] Received: ' + s);

		const value = verifyTestMsg(s);
		if (value < 1 || value > 10) {
			assert.fail('Unexpected value');
			return;
		}
		if (receivedAllValues.has(value)) {
			assert.fail('Value already received');
			return;
		}

		receivedAllValues.set(value, true);
		receivedAll += 1;
	});

	consumer.subscribe('TEST_CHANNEL.ODD', async (msg: Message) => {
		const s = decodeMsg(msg.message);
		log('[TEST_CHANNEL.ODD] Received: ' + s);

		const value = verifyTestMsg(s);
		if (value < 1 || value > 10 || (value & 1) == 0) {
			assert.fail('Unexpected value');
			return;
		}
		if (receivedOddValues.has(value)) {
			assert.fail('Value already received');
			return;
		}

		receivedOddValues.set(value, true);
		receivedOdd += 1;
	});

	consumer.subscribe('TEST_CHANNEL.EVEN', async (msg: Message) => {
		const s = decodeMsg(msg.message);
		log('[TEST_CHANNEL.EVEN] Received: ' + s);

		const value = verifyTestMsg(s);
		if (value < 1 || value > 10 || (value & 1) != 0) {
			assert.fail('Unexpected value');
			return;
		}
		if (receivedEvenValues.has(value)) {
			assert.fail('Value already received');
			return;
		}

		receivedEvenValues.set(value, true);
		receivedEven += 1;
	});

	// Publish messages from 1 to 10
	log('Publishing messages...');
	for (let i = 1; i <= 10; i++) {
		const msg = encodeMsg(generateTestMsg(i));
		const subject = 'TEST_CHANNEL.' + (((i & 1) == 0) ? 'EVEN' : 'ODD');
		producer.publish(subject, msg);
	}

	// Wait until completed for 10 seconds
	log('Waiting 10 seconds...');
	let completed = false;
	for (let timer = 100; timer > 0; timer--) {
		await sleep(100);

		if (receivedAll == 10 && receivedEven == 5 && receivedOdd == 5) {
			completed = true;
			break;
		}
	}
	if (completed) {
		log('Done!', 'success');
	}
	else {
		log('Not all messages were received in a timely fashion', 'error');
		assert.fail();
	}

	// Close
	if (consumer) {
		await consumer.close();
	}
	if (producer) {
		await producer.close();
	}
};

runTests().catch((err: any) => {
	console.error(err);
	process.exit(1);
});
