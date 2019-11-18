
import livereload from 'rollup-plugin-livereload'
import serve from 'rollup-plugin-serve'
import prod from './rollup.config.prod'
import web from './rollup.config.web'

export default {
    ... web,
    plugins: [
        ... web.plugins.filter( plugin => ! prod.plugins.includes( plugin ) ),
        serve( {
            contentBase: 'example',
            open: true,
        } ),
        livereload( 'dist' )
    ]
}