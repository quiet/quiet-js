
import AudioBackend from './backend/index.mjs'
import receiveProcessor from './processors/receive.mjs'

const getUserAudio = async ( ) =>
    navigator.mediaDevices.getUserMedia( {
        audio: {
            echoCancellation: false
        }
    } )

export class Receiver {
    constructor( profileKey ) {
        console.log( 'receiver initialized with profile', profileKey )
        this.audioNode = null
        this.backend = new AudioBackend( profileKey )
    }

    async start( ) {
        this.audioNode = await this.backend.createAudioNode( receiveProcessor )
        return this.resume( )
    }

    on( event, fn ) {
        return this.backend.on( event, fn )
    }

    off( event, fn ) {
        return this.backend.off( event, fn )
    }

    pause( ) {
        this.audioNode.disconnect( )
        this.audioStream.getAudioTracks( )
            .forEach( track => track.stop( ) )
    }

    async resume( ) {
        const context = this.backend.getContext( )

        this.audioStream = await getUserAudio( )
        this.audioInput = context.createMediaStreamSource( this.audioStream )
        this.audioInput
            .connect( this.audioNode )
            .connect( context.destination )

        context.resume( )
    }

    stop( ) {
        this.pause( )
        this.backend.destroyAudioNode( this.audioNode )
        this.audioNode = this.audioStream = this.audioInput = null
    }
}

export default Receiver