
import common from './rollup.config.common'
import prod from './rollup.config.prod'

export default {
  ... common,
  plugins: [
    ... common.plugins,
    ... prod.plugins,
  ],
  output: {
    file: 'dist/quiet.js',
    format: 'iife',
    name: 'Quiet',
  },
}