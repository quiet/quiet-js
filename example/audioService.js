import {
    Receiver,
    Transmitter,
    ab2str,
    loadDependencies,
    profiles,
    str2ab
} from '../src';

class AudioService {
    constructor() {
        this._emscriptenPath =  `/`;
        this._memoryInitializerPath = `/`;

        this._receiver = null;
        this._transmitter = null;
    }

    init() {
        return loadDependencies({
            emscriptenPath: this._emscriptenPath,
            memoryInitializerPath: this._memoryInitializerPath
        });
    }

    startListening(audioStream, onReceive) {
        if (this._receiver) {
            this._receiver.changeAudioStream(audioStream);

            return;
        }

        this._receiver = new Receiver({
            audioStream,
            onReceive: ab => onReceive(ab2str(ab)),
            profile: profiles['ultrasonic-experimental']
        });
    }

    startSending(text) {
        this._text = str2ab(text);

        if (!this._transmitter) {
            this._transmitter = new Transmitter({
                onFinish: () => this._enqueueTransmission(),
                profile: profiles['ultrasonic-experimental']
            });

            this._transmit();
        }
    }

    stopListening() {
        if (this._receiver) {
            this._receiver.destroy();
        }

        this._receiver = null;
    }

    stopSending() {
        this._transmitter.destroy();
        this._transmitter = null;

        clearTimeout(this._nextTransmissionTimeout);
    }

    _enqueueTransmission() {
        clearTimeout(this._nextTransmissionTimeout);

        this._nextTransmissionTimeout = setTimeout(() => {
            this._transmit();
        }, 2000);
    }

    _transmit() {
        if (this._transmitter) {
            this._transmitter.transmit(this._text);
        }
    }
};

export default new AudioService();
