import test, { ExecutionContext } from 'ava';
import { NatsClient } from '../index';
import { loadConfig, encodeMsg, generateTestMsg, verifyTestMsg, sleep, monitorClientAndLog, getTimestamp } from './helpers';
import { NatsStreamMessageAck } from '../types';

// -----------------------------------------------------------------------------

test.before('Loading settings...', () => {
	loadConfig();
});

test('NatsClient JetStream test', async (t: ExecutionContext) => {
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
	let consumer1!: NatsClient;
	let consumer2A!: NatsClient;
	let consumer2B!: NatsClient;
	try {
		// Connect to the test server
		t.log(getTimestamp() + ' | Connecting...');
		producer = await NatsClient.create({
			servers: process.env['NATS_TEST_HOST'],
			jwt: process.env['NATS_TEST_JWT'],
			nkeySeed: process.env['NATS_TEST_NKEY_SEED'],
			name: 'NatsClient-jetstream-test-producer'
		});
		monitorClientAndLog(t, producer);
		consumer1 = await NatsClient.create({
			servers: process.env['NATS_TEST_HOST'],
			jwt: process.env['NATS_TEST_JWT'],
			nkeySeed: process.env['NATS_TEST_NKEY_SEED'],
			name: 'NatsClient-jetstream-test-consumer1'
		});
		monitorClientAndLog(t, consumer1);
		consumer2A = await NatsClient.create({
			servers: process.env['NATS_TEST_HOST'],
			jwt: process.env['NATS_TEST_JWT'],
			nkeySeed: process.env['NATS_TEST_NKEY_SEED'],
			name: 'NatsClient-jetstream-test-consumer2a'
		});
		monitorClientAndLog(t, consumer2A);
		consumer2B = await NatsClient.create({
			servers: process.env['NATS_TEST_HOST'],
			jwt: process.env['NATS_TEST_JWT'],
			nkeySeed: process.env['NATS_TEST_NKEY_SEED'],
			name: 'NatsClient-jetstream-test-consumer2b'
		});
		monitorClientAndLog(t, consumer2B);

		// Create stream store
		t.log(getTimestamp() + ' | Creating stream...');
		await producer.createStream('JsNatsClient-TestStore', {
			subjects: 'JET_TEST_CHANNEL.*',
			maxStorageSizeInBytes: 1024 * 1024 // 1MB
		});

		// Get stream for consumers
		t.log(getTimestamp() + ' | Creating consumers...');
		const consumerStream1 = await consumer1.getStream('JsNatsClient-TestStore');
		await consumerStream1.deleteConsumer('JsNatsClient-TestConsumer1');
		const consumerConsumer1 = await consumerStream1.createConsumer('JsNatsClient-TestConsumer1', {
			subjectFilter: 'JET_TEST_CHANNEL.ODD',
			deliverPolicy: 'last'
		});

		const consumerStream2A = await consumer2A.getStream('JsNatsClient-TestStore');
		await consumerStream2A.deleteConsumer('JsNatsClient-TestConsumer2');
		const consumerConsumer2A = await consumerStream2A.createConsumer('JsNatsClient-TestConsumer2', {
			subjectFilter: 'JET_TEST_CHANNEL.EVEN',
			deliverPolicy: 'last'
		});

		const consumerStream2B = await consumer2B.getStream('JsNatsClient-TestStore');
		const consumerConsumer2B = await consumerStream2B.createConsumer('JsNatsClient-TestConsumer2', {
			subjectFilter: 'JET_TEST_CHANNEL.EVEN',
			deliverPolicy: 'last'
		});

		// Get current stream information
		const lastSequenceInStream = (await consumerStream1.info()).lastSequence;

		/*
		// Publish messages from 1 to 10
		for (let i = 1; i <= 10; i++) {
			const msg = encodeMsg(generateTestMsg(i));
			const subject = 'JET_TEST_CHANNEL.' + (((i & 1) == 0) ? 'EVEN' : 'ODD');
			await producer.publishToStream(subject, msg, {
				'number': i.toString()
			});
		}
		*/

		let receivedOdd = 0;
		const receivedOddValues = new Map<number, boolean>();
		let receivedEven = 0;
		const receivedEvenValues = new Map<number, boolean>();
		let asyncFail = '';

		// Set up subscriptions
		t.log(getTimestamp() + ' | Subscribing consumers...');
		await consumerConsumer1.subscribe(async (msg: NatsStreamMessageAck): Promise<boolean | undefined> => {
			const s = Buffer.from(msg.message).toString('utf8');
			t.log(getTimestamp() + ' | [JET_TEST_CHANNEL.ODD] Received: ' + s);

			const value = verifyTestMsg(s);
			if (msg.sequence <= lastSequenceInStream) {
				t.log('  From a previous run');
				return true; // ACK
			}
			if (value < 1 || value > 10 || (value & 1) == 0) {
				if (asyncFail.length == 0) {
					asyncFail = 'Unexpected value';
				}
				return false; // NAK
			}
			if (receivedOddValues.has(value)) {
				if (asyncFail.length == 0) {
					asyncFail = 'Value already received';
				}
				return false; // NAK
			}

			receivedOddValues.set(value, true);
			receivedOdd += 1;
			return true; // ACK
		});

		await consumerConsumer2A.subscribe(async (msg: NatsStreamMessageAck): Promise<boolean | undefined> => {
			const s = Buffer.from(msg.message).toString('utf8');
			t.log(getTimestamp() + ' | [JET_TEST_CHANNEL.EVEN/A] Received: ' + s);

			const value = verifyTestMsg(s);
			if (msg.sequence <= lastSequenceInStream) {
				t.log('  From a previous run');
				return true; // ACK
			}
			if (value < 1 || value > 10 || (value & 1) != 0) {
				if (asyncFail.length == 0) {
					asyncFail = 'Unexpected value';
				}
				return false; // NAK
			}
			if (receivedEvenValues.has(value)) {
				if (asyncFail.length == 0) {
					asyncFail = 'Value already received';
				}
				return false; // NAK
			}

			receivedEvenValues.set(value, true);
			receivedEven += 1;
			return true; // ACK
		});

		await consumerConsumer2B.subscribe(async (msg: NatsStreamMessageAck): Promise<boolean | undefined> => {
			const s = Buffer.from(msg.message).toString('utf8');
			t.log(getTimestamp() + ' | [JET_TEST_CHANNEL.EVEN/B] Received: ' + s);

			const value = verifyTestMsg(s);
			if (msg.sequence <= lastSequenceInStream) {
				t.log('  From a previous run');
				return true; // ACK
			}
			if (value < 1 || value > 10 || (value & 1) != 0) {
				if (asyncFail.length == 0) {
					asyncFail = 'Unexpected value';
				}
				return false; // NAK
			}
			if (receivedEvenValues.has(value)) {
				if (asyncFail.length == 0) {
					asyncFail = 'Value already received';
				}
				return false; // NAK
			}

			receivedEvenValues.set(value, true);
			receivedEven += 1;
			return true; // ACK
		});

		// Publish messages from 1 to 10
		t.log(getTimestamp() + ' | Publishing messages...');
		for (let i = 1; i <= 10; i++) {
			const msg = encodeMsg(generateTestMsg(i));
			const subject = 'JET_TEST_CHANNEL.' + (((i & 1) == 0) ? 'EVEN' : 'ODD');
			await producer.publishToStream(subject, msg, {
				'number': i.toString()
			});
		}

		// Wait until completed for 10 seconds
		t.log(getTimestamp() + ' | Waiting 10 seconds...');
		let completed = false;
		for (let timer = 100; timer > 0; timer--) {
			await sleep(100);
			if (asyncFail.length > 0) {
				t.fail(asyncFail);
			}
			if (receivedOdd == 5 && receivedEven == 5) {
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
	}

	// Done
	t.pass();
});
