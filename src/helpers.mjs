
const ab2str = buffer => {
    const utf16Codes = new Uint16Array( buffer )
    const totalSize = utf16Codes.length
    const chunkSize = 1e4 // 10000 items at a time
    
    let str = ''
    for( let i = 0; i < totalSize; i += chunkSize ) {
        const slice = utf16Codes.subarray( i, i + chunkSize )
        const utf16 = String.fromCharCode.apply( null, slice )
        str += utf16
    }

    return str
}

const str2ab = str => {
    const buf = new ArrayBuffer( str.length * 2 )
    const view = new Uint16Array( buf )
    for( let i = 0; i < view.length; i ++ ) {
        view[ i ] = str.charCodeAt( i )
    }

    return buf
}

export default {
    ab2str,
    str2ab,
}