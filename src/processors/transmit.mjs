
let bufferLength,
    encoderPtr,
    samplesPtr,
    samplesView,
    stopped

function init( {
    activeProfileKey,
    buffer,
    bufferSize,
    profiles,
    sampleRate,
} ) {

    bufferLength = bufferSize
    stopped = false

    const profilePtr = Module.ccall(
        'quiet_encoder_profile_str', 'pointer', [ 'array', 'array' ], [
            Module.intArrayFromString( JSON.stringify( profiles ) ),
            Module.intArrayFromString( activeProfileKey )
        ]
    )

    encoderPtr = Module.ccall(
        'quiet_encoder_create', 'pointer',
        ['pointer', 'number'],
        [ profilePtr, sampleRate ]
    )

    Module.ccall( 'free', null, [ 'pointer' ], [ profilePtr ] )

    const frameLen = Module.ccall(
        'quiet_encoder_get_frame_len', 'number',
        [ 'pointer' ],
        [ encoderPtr ]
    )

    if( frameLen < 1 ) {
        console.log( "bad frameLen" )
        return
    }

    samplesPtr = Module.ccall(
        'malloc', 'pointer',
        [ 'number' ],
        [ bufferSize * 4 ]
    )

    const dwordIndex = samplesPtr / 4
    samplesView = Module.HEAPF32.subarray( dwordIndex, dwordIndex + bufferSize )

    let written = 0
    while( written < buffer.byteLength ) {
        const sliceSize = Math.min( buffer.byteLength - written, frameLen )
        const slice = new Uint8Array( buffer, written, sliceSize )
        const bytes = Module.ccall( 'quiet_encoder_send', 'number',
            [ 'pointer', 'array', 'number' ],
            [ encoderPtr, slice, slice.length ]
        )
        if( bytes < 0 ) {
            throw new Error( "couldn't send via quiet_encoder_send" )
        }

        written += bytes
    }
}

function destroy( ) {
    Module.ccall( 'free', null, [ 'pointer' ], [ samplesPtr ] )
    Module.ccall( 'quiet_encoder_destroy', null, [ 'pointer' ], [ encoderPtr ] )
}

function process( input, output ) {
    // this is needed with the scriptprocessor implementation where the process
    // callback is run a few more times before the node is completely stopped
    if( stopped ) {
        return { }
    }

    const bytes = Module.ccall(
        'quiet_encoder_emit', 'number',
        [ 'pointer', 'pointer', 'number' ],
        [ encoderPtr, samplesPtr, output.length ]
    )

    if( bytes <= 0 ) {
        stopped = true
        return { stop: true }
    }

    output.set( samplesView.subarray( 0, bytes ) )
    output.subarray( bytes ).fill( 0 )

    return { }
}
