import { spawn } from 'child_process';
import { glob } from 'glob';
import path from 'path';

// -----------------------------------------------------------------------------

const runChild = (filename: string, args: string[]): Promise<number> => {
	return new Promise((resolve) => {
		const child = spawn('node', [ '--enable-source-maps', filename ].concat(args));

		child.stdout.on('data', (data) => {
			process.stdout.write(data);
		});
		child.stderr.on('data', (data) => {
			process.stderr.write(data);
		});
		child.on('close', (code) => {
			resolve(code || 0);
		});
	});
};

const runTests = async (): Promise<boolean> => {
	let result = true;

	const args = process.argv.slice(2);
	const files = await glob('*.test.js', {
		cwd: __dirname,
		nodir: true
	});
	for (const file of files) {
		const filename = path.join(__dirname, file);
		const code = await runChild(filename, args);
		if (code != 0) {
			result = false;
		}
	}

	return result;
}

runTests().then((result) => {
	if (!result) {
		process.exit(1);
	}
});
