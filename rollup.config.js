import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'sidepanel/index.js',
  output: {
    file: 'dist/sidepanel.bundle.js',
    format: 'iife',
    name: 'ModelMe'
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs(),
    json()
  ]
};
