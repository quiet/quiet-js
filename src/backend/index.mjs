
import ScriptProcessorBackend from './scriptprocessor.mjs'
import WorkletBackend from './worklet.mjs'

const isWorkletSupported = ( ) =>
    typeof AudioWorkletNode === 'function'

export default isWorkletSupported( )
    ? WorkletBackend
    : ScriptProcessorBackend