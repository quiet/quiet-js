
import { SAMPLE_BUFFER_SIZE } from './constants'
import profiles, { profileKeys } from '../profiles.mjs'

export const $interface = Symbol( 'audioBackendInterface' )

class EventEmitter {
    constructor( ) {
        this.registry = { }
    }

    on( e, fn ) {
        if( e in this.registry ) {
            return this.registry[ e ].push( fn )
        }
        return this.registry[ e ] = [ fn ]
    }

    once( e, fn ) {
        const closure = ( ... args ) => {
            fn( ... args )
            this.off( e, closure )
        }
        
        this.on( e, closure )
    }

    off( e, fn ) {
        if( ! e in this.registry ) {
            return
        }

        const filtered = this.registry[ e ].filter( f => f !== fn )
        if( filtered.length ) {
            return this.registry[ e ] = filtered
        }
        return delete this.registry[ e ]
    }

    emit( e, ... args ) {
        if( ! e in this.registry ) {
            return;
        }

        this.registry[ e ].forEach( f => f( ... args ) )
    }
}

class NotImplementedError extends Error {
    constructor( ) {
        super( 'Not implemented' )
        this.name = this.constructor.name
    }
}

export default class GenericAudioBackend extends EventEmitter {
    constructor( profileKey ) {
        super( )
        this.context = new AudioContext( {
            latencyHint: 'playback'
        } )
        this.profileKey = profileKey
        this.profile = profiles[ profileKey ]
    }

    getContext( ) {
        return this.context
    }

    getQuietParams( ) {
        return {
            profiles,
            activeProfileKey: this.profileKey,
            bufferSize: SAMPLE_BUFFER_SIZE,
            sampleRate: this.context.sampleRate,
        }
    }

    async createAudioNode( ) {
        throw new NotImplementedError
    }

    destroyAudioNode( node ) {
        const audioNodeInterface = node[ $interface ]
        audioNodeInterface && audioNodeInterface.destroy( )
    }

    start( ) {
        throw new NotImplementedError
    }

    stop( ) {
        throw new NotImplementedError
    }
}
