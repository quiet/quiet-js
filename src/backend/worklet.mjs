
import GenericAudioBackend, { $interface } from './generic.mjs'
import quietCode from '../libquiet/quiet.js'

class QuietWorkletNode extends AudioWorkletNode {
    constructor( context ) {
        super( context, 'quiet-worklet-node' )
    }
}

export default class WorkletBackend extends GenericAudioBackend {
    constructor( profile ) {
        super( profile )
    }

    async createAudioNode( processingCode, params = { }, transferable ) {
        const module = `
            ${ quietCode };
            const Module = quiet( )

            ${ processingCode };

            class QuietWorkletProcessor extends AudioWorkletProcessor {
                constructor( ) {
                    super( )
                    this.initialized = false
                    this.port.onmessage = this.onMessage.bind( this )
                }

                onMessage( event ) {
                    const { type, value } = event.data
                    switch( type ) {
                        case 'destroy':
                            destroy( )
                            break
                        case 'params':
                            init( value )
                            this.initialized = true
                            break
                        default:
                            break
                    }
                }

                process( inputs, outputs, parameters ) {
                    if( ! this.initialized ) {
                        return true
                    }

                    const input = inputs[ 0 ][ 0 ]
                    const output = outputs[ 0 ][ 0 ]

                    const { checksumFail, stop, value } =
                        process( input, output )

                    if( checksumFail ) {
                        this.port.postMessage( {
                            type: 'error'
                        } )
                    }
                    if( stop ) {
                        this.port.postMessage( {
                            type: 'stopped'
                        } )
                    }
                    if( value ) {
                        this.port.postMessage( {
                            type: 'payload',
                            value
                        }, [ value ] )
                    }

                    return !stop
                }
            }

            try {
                registerProcessor( 'quiet-worklet-node', QuietWorkletProcessor )
            } catch(e) {

            }
        `
        const blob = new Blob( [ module ], { type: 'text/javascript' } )
        const url = URL.createObjectURL( blob )

        await this.context.audioWorklet.addModule( url )

        const node = new QuietWorkletNode( this.context )
        node.port.onmessage = event =>
            this.emit( event.data.type, event.data.value )

        node.port.postMessage( {
            type: 'params',
            value: {
                ... this.getQuietParams( ),
                ... params,
            }
        }, transferable )

        node[ $interface ] = {
            destroy: ( ) => node.port.postMessage( { type: 'destroy' } )
        }

        return node
    }
}