
import AudioBackend from './backend/index.mjs'
import transmitProcessor from './processors/transmit.mjs'

export default class Transmitter {
    constructor( profileKey ) {
        this.backend = new AudioBackend( profileKey )
    }

    async waitForStopped( ) {
        return new Promise( y => this.backend.once( 'stopped', y ) )
    }

    async send( buffer ) {
        const context = this.backend.getContext( )
        this.audioNode = await this.backend.createAudioNode(
            transmitProcessor, { buffer }, [ buffer ]
        )

        this.audioNode.connect( context.destination )
        await this.waitForStopped( )
        this.audioNode.disconnect( )
        this.backend.destroyAudioNode( this.audioNode )
    }
}
