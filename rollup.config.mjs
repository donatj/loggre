import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/index.ts',
	output: [
		{
			file: 'dist/main.js',
			format: 'esm',
			sourcemap: true
		},
	],
	plugins: [
		nodeResolve({
			browser: true,
			preferBuiltins: false
		}),
		commonjs(),
		typescript({
			sourceMap: true,
			inlineSources: false
		}),

		// production && terser()
	]
};
