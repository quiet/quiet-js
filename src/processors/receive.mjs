
let bufferLength,
    checksumFails,
    decoderPtr,
    framePtr,
    samplesPtr,
    samplesView

function init( {
    activeProfileKey,
    bufferSize,
    profiles,
    sampleRate,
} ) {
    bufferLength = bufferSize

    const profilePtr = Module.ccall(
        'quiet_decoder_profile_str', 'pointer', [ 'array', 'array' ], [
            Module.intArrayFromString( JSON.stringify( profiles ) ),
            Module.intArrayFromString( activeProfileKey )
        ]
    )
    
    decoderPtr = Module.ccall(
        'quiet_decoder_create', 'pointer',
        ['pointer', 'number'],
        [ profilePtr, sampleRate ]
    )
    
    Module.ccall( 'free', null, [ 'pointer' ], [ profilePtr ] )
    
    framePtr = Module.ccall(
        'malloc', 'pointer',
        [ 'number' ],
        [ bufferSize ]
    )

    samplesPtr = Module.ccall(
        'malloc', 'pointer',
        [ 'number' ],
        [ bufferSize * 4 ]
    )
    
    // since pointers are byte indexes in emscripten's fake heap, we need to
    // convert to double word indexes by dividing by ( 32 / 8 )
    const dwordIndex = samplesPtr / 4
    samplesView = Module.HEAPF32.subarray( dwordIndex, dwordIndex + bufferSize )
    
    checksumFails = 0
}

function destroy( ) {
    Module.ccall( 'free', null, [ 'pointer' ], [ samplesPtr ] )
    Module.ccall( 'free', null, [ 'pointer' ], [ framePtr ] )
    Module.ccall( 'quiet_decoder_destroy', null, [ 'pointer' ], [ decoderPtr ] )
}

function process( input, output ) {
    samplesView.set( input )
    
    Module.ccall(
        'quiet_decoder_consume', 'number',
        [ 'pointer', 'pointer', 'number' ],
        [ decoderPtr, samplesPtr, input.length ]
    )

    const currentChecksumFails = Module.ccall(
        'quiet_decoder_checksum_fails', 'number',
        [ 'pointer' ],
        [ decoderPtr ]
    )
    if( currentChecksumFails > checksumFails ) {
        checksumFails = currentChecksumFails
        return { checksumFail: true }
    }

    const read = Module.ccall(
        'quiet_decoder_recv', 'number',
        [ 'pointer', 'pointer', 'number' ],
        [ decoderPtr, framePtr, bufferLength ]
    )

    if( read !== -1 ) {
        const slice = Module.HEAPU8.slice( framePtr, framePtr + read )
        return { value: slice.buffer }
    }

    return { }
}
