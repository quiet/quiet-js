
import { string } from 'rollup-plugin-string'

export default {
    input: 'src/index.mjs',
    plugins: [
        string( {
            include: [
                'src/libquiet/quiet.js',
                'src/processors/receive.mjs',
                'src/processors/transmit.mjs',
            ]
        } )
    ]
}