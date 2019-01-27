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

    getProfiles() {
        return Object.keys(profiles);
    }

    init() {
        return loadDependencies({
            emscriptenPath: this._emscriptenPath,
            memoryInitializerPath: this._memoryInitializerPath
        });
    }

    isReceiving() {
        return Boolean(this._receiver);
    }

    startReceiving(audioStream, receiveProfile, onReceive) {
        if (!audioStream || !receiveProfile) {
            console.error('Called startReceiving without a stream or profile.');
            return;
        }

        if (this._receiveProfile !== receiveProfile) {
            this.stopReceiving();
        }

        this._receiver = new Receiver({
            audioStream,
            onReceive: ab => onReceive(ab2str(ab)),
            profile: profiles[receiveProfile]
        });
    }

    stopReceiving() {
        this._receiver && this._receiver.destroy();

        this._receiver = null;
    }

    send(text, sendProfile) {
        if (!text || !text.trim() || !sendProfile) {
            return Promise.reject();
        }

        return new Promise(resolve => {
            const arrayBufferText = str2ab(text);
            const transmitter = new Transmitter({
                onFinish: () => {
                    transmitter.destroy();

                    resolve();
                },
                profile: profiles[sendProfile]
            });

            transmitter.transmit(arrayBufferText);
        });
    }
};

export default new AudioService();
