
import common from './rollup.config.common'
import prod from './rollup.config.prod'

export default {
  ... common,
  plugins: [
    ... common.plugins,
    ... prod.plugins,
  ],
  output: {
    file: 'dist/index.js',
    format: 'cjs',
  },
}