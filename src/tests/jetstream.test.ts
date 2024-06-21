import { strict as assert } from 'node:assert';
import { Client, StreamMessageAck } from '..';
import { loadConfig, encodeMsg, generateTestMsg, verifyTestMsg, log, sleep, monitorClientAndLog, getConfig } from './helpers';

// -----------------------------------------------------------------------------

const runTests = async () => {
	log('Starting JetStream test', 'title');

	loadConfig();

	// Connect to the test server
	log('Connecting...');
	const producer = await Client.create({
		...getConfig(),
		name: 'NatsJetstreamJsClient-jetstream-test-producer'
	});
	monitorClientAndLog(producer);
	const consumer1 = await Client.create({
		...getConfig(),
		name: 'NatsJetstreamJsClient-jetstream-test-consumer1'
	});
	monitorClientAndLog(consumer1);
	const consumer2A = await Client.create({
		...getConfig(),
		name: 'NatsJetstreamJsClient-jetstream-test-consumer2a'
	});
	monitorClientAndLog(consumer2A);
	const consumer2B = await Client.create({
		...getConfig(),
		name: 'NatsJetstreamJsClient-jetstream-test-consumer2b'
	});
	monitorClientAndLog(consumer2B);

	// Create stream store
	log('Creating stream...');
	await producer.destroyStream('NatsJetstreamJsClient-TestStore');
	await producer.createStream('NatsJetstreamJsClient-TestStore', {
		subjects: 'JET_TEST_CHANNEL.*',
		maxStorageSizeInBytes: 1024 * 1024 // 1MB
	});

	// Get stream for consumers
	log('Creating consumers...');
	const consumerStream1 = await consumer1.getStream('NatsJetstreamJsClient-TestStore');
	assert(consumerStream1, 'NatsJetstreamJsClient-TestStore not found');

	await consumerStream1.destroyConsumer('JsNatsJetstreamClient-TestConsumer1');
	const consumerConsumer1 = await consumerStream1.createConsumer('NatsJetstreamJsClient-TestConsumer1', {
		subjectFilters: 'JET_TEST_CHANNEL.ODD',
		deliverPolicy: 'last'
	});

	const consumerStream2A = await consumer2A.getStream('NatsJetstreamJsClient-TestStore');
	assert(consumerStream2A, 'NatsJetstreamJsClient-TestStore not found');
	await consumerStream2A.destroyConsumer('JsNatsJetstreamClient-TestConsumer2');
	const consumerConsumer2A = await consumerStream2A.createConsumer('NatsJetstreamJsClient-TestConsumer2', {
		subjectFilters: 'JET_TEST_CHANNEL.EVEN',
		deliverPolicy: 'last'
	});

	const consumerStream2B = await consumer2B.getStream('NatsJetstreamJsClient-TestStore');
	assert(consumerStream2B, 'NatsJetstreamJsClient-TestStore not found');
	const consumerConsumer2B = await consumerStream2B.getConsumer('NatsJetstreamJsClient-TestConsumer2');
	assert(consumerConsumer2B, 'NatsJetstreamJsClient-TestConsumer2 not found');

	// Get current stream information
	const lastSequenceInStream = (await consumerStream1.info()).lastSequence;

	let receivedOdd = 0;
	const receivedOddValues = new Map<number, boolean>();
	let receivedEven = 0;
	const receivedEvenValues = new Map<number, boolean>();

	// Set up subscriptions
	log('Subscribing consumers...');
	await consumerConsumer1.subscribe(async (msg: StreamMessageAck): Promise<boolean | undefined> => {
		const s = Buffer.from(msg.message).toString('utf8');
		log('[JET_TEST_CHANNEL.ODD] Received: ' + s);

		const value = verifyTestMsg(s);
		if (msg.sequence <= lastSequenceInStream) {
			log('  From a previous run');
			return true; // ACK
		}
		if (value < 1 || value > 10 || (value & 1) == 0) {
			assert.fail('Unexpected value');
			return false; // NAK
		}
		if (receivedOddValues.has(value)) {
			assert.fail('Value already received');
			return false; // NAK
		}

		receivedOddValues.set(value, true);
		receivedOdd += 1;
		return true; // ACK
	});

	await consumerConsumer2A.subscribe(async (msg: StreamMessageAck): Promise<boolean | undefined> => {
		const s = Buffer.from(msg.message).toString('utf8');
		log('[JET_TEST_CHANNEL.EVEN/A] Received: ' + s);

		const value = verifyTestMsg(s);
		if (msg.sequence <= lastSequenceInStream) {
			log('  From a previous run');
			return true; // ACK
		}
		if (value < 1 || value > 10 || (value & 1) != 0) {
			assert.fail('Unexpected value');
			return false; // NAK
		}
		if (receivedEvenValues.has(value)) {
			assert.fail('Value already received');
			return false; // NAK
		}

		receivedEvenValues.set(value, true);
		receivedEven += 1;
		return true; // ACK
	});

	await consumerConsumer2B.subscribe(async (msg: StreamMessageAck): Promise<boolean | undefined> => {
		const s = Buffer.from(msg.message).toString('utf8');
		log('[JET_TEST_CHANNEL.EVEN/B] Received: ' + s);

		const value = verifyTestMsg(s);
		if (msg.sequence <= lastSequenceInStream) {
			log('  From a previous run');
			return true; // ACK
		}
		if (value < 1 || value > 10 || (value & 1) != 0) {
			assert.fail('Unexpected value');
			return false; // NAK
		}
		if (receivedEvenValues.has(value)) {
			assert.fail('Value already received');
			return false; // NAK
		}

		receivedEvenValues.set(value, true);
		receivedEven += 1;
		return true; // ACK
	});

	// Publish messages from 1 to 10
	log('Publishing messages...');
	for (let i = 1; i <= 10; i++) {
		const msg = encodeMsg(generateTestMsg(i));
		const subject = 'JET_TEST_CHANNEL.' + (((i & 1) == 0) ? 'EVEN' : 'ODD');
		await producer.publishToStream(subject, msg, {
			'number': i.toString()
		});
	}

	// Wait until completed for 10 seconds
	log('Waiting 10 seconds...');
	let completed = false;
	for (let timer = 100; timer > 0; timer--) {
		await sleep(100);

		if (receivedOdd == 5 && receivedEven == 5) {
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
	if (consumer2B) {
		await consumer2B.close();
	}
	if (consumer2A) {
		await consumer2A.close();
	}
	if (consumer1) {
		await consumer1.close();
	}
	if (producer) {
		await producer.close();
	}
};

runTests().catch((err: any) => {
	console.error(err);
	process.exit(1);
});
