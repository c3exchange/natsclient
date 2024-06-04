import js from '@eslint/js';
import tseslint from 'typescript-eslint';


export default [
	js.configs.recommended,
	...tseslint.configs.strict,
	{
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: 'module'
		},
		rules: {
			'max-lines': 'off',
			'quotes': [ 'error', 'single' ],
			'@typescript-eslint/no-explicit-any': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					'args': 'all',
					'argsIgnorePattern': '^_',
					'caughtErrors': 'all',
					'caughtErrorsIgnorePattern': '^_',
					'destructuredArrayIgnorePattern': '^_',
					'varsIgnorePattern': '^_',
					'ignoreRestSiblings': true
				}
			],
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/prefer-ts-expect-error': 'off'
		}
	},
	{
		ignores: [ '.vscode/**/*', '.tsimp/**/*', 'lib/**/*', 'node_modules/**/*' ]
	}
];
