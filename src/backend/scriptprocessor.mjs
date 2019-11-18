
import GenericAudioBackend, { $interface } from './generic.mjs'
import quietDefinition from '../libquiet/quiet.js'
import {
    INPUT_CHANNELS,
    OUTPUT_CHANNELS,
    SAMPLE_BUFFER_SIZE
} from './constants.mjs'

const compileModule = ( ) =>
    eval( quietDefinition + '; window.Module = quiet()' )

export default class ScriptProcessorBackend extends GenericAudioBackend {
    constructor( profile ) {
        super( profile )
        if( ! window.Module ) {
            compileModule( )
        }
    }

    async createAudioNode( processingCode, params ) {
        const node = this.context.createScriptProcessor(
            SAMPLE_BUFFER_SIZE,
            INPUT_CHANNELS, 
            OUTPUT_CHANNELS
        )
        
        const { destroy, init, process } = eval(`
            ${ processingCode }

            ( ( ) => ( {
                destroy, init, process
            } ) )( )
        ` )

        init( {
            ... this.getQuietParams( ),
            ... params,
        } )

        node[ $interface ] = { destroy }
        node.onaudioprocess = event => {
            const { inputBuffer, outputBuffer } = event
            const input = inputBuffer.getChannelData( 0 )
            const output = outputBuffer.getChannelData( 0 )
            const { checksumFail, stop, value } = process( input, output )
            if( checksumFail ) {
                this.emit( 'error' )
            }
            if( stop ) {
                setTimeout( ( ) => this.emit( 'stopped' ), 250 )
            }
            if( value ) {
                this.emit( 'payload', value )
            }
        }

        return node
    }
}