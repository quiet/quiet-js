import { getAvailableMics, getMicStream } from './rtc';
import audioService from './audioService';

const audioInputSelect = document.getElementById('mic-select');
const autostartReceiverCheckbox
    = document.getElementById('autostart-receiver');
const autostartTransmitterCheckbox
    = document.getElementById('autostart-transmitter');
const transmitStartButton = document.getElementById('transmit-start');
const transmitStopButton = document.getElementById('transmit-stop');
const receiverStartButton = document.getElementById('receiver-start');
const receiverStopButton = document.getElementById('receiver-stop');
const textArea = document.getElementById('transmit-text');

let micStream;

audioService.init()
.then(() => getMicStream())
.then(audioStream => {
    micStream = audioStream;
})
.then(() => getAvailableMics())
.then(devices => devices.forEach(device => {
    const { deviceId, label } = device;
    const option = document.createElement('option');
    option.value = deviceId;

    option.text = label;
    audioInputSelect.appendChild(option);
}))
.then(() => {
    // Initialize receiver button listeners
    receiverStartButton.addEventListener('click', () => {
        const deviceId = audioInputSelect.value;

        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }

        getMicStream(deviceId)
            .then(audioStream => {
                micStream = audioStream;
                audioService.startListening(
                    micStream,
                    message => console.log(message)
                );
            });
    });

    receiverStopButton.addEventListener('click', () => {
        if (micStream) {
            micStream.getTracks().forEach(track => track.stop());
            micStream = null;
        }

        audioService.stopListening();
    });
})
.then(() => {
    // Initialize receiver autostart
    const isAutostartReceiverEnabled = !!localStorage.getItem('autostart');
    autostartReceiverCheckbox.checked = isAutostartReceiverEnabled;

    autostartReceiverCheckbox.addEventListener('change', (event) => {
        if (event.target.checked) {
            localStorage.setItem('autostart', 'true');
        } else {
            localStorage.setItem('autostart', '');
        }
    });

    if (isAutostartReceiverEnabled) {
        const deviceId = audioInputSelect.value;

        return getMicStream(deviceId)
            .then(audioStream => {
                micStream = audioStream;
                audioService.startListening(
                    micStream,
                    message => console.log(message)
                );
            });
    }
})
.then(() => {
    // Initialize transmitter buttons
    transmitStartButton.addEventListener('click', () => {
        const textToSend = textArea.value;
    
        if (!textToSend) {
            return;
        }

        audioService.startSending(textToSend);
    });

    transmitStopButton.addEventListener('click', () => {
        audioService.stopSending();
    });
})
.then(() => {
    // Initialize transmitter autostart
    const isAutostartTransmitterEnabled
        = !!localStorage.getItem('autostart-transmit');
    autostartTransmitterCheckbox.checked = isAutostartTransmitterEnabled;

    autostartTransmitterCheckbox.addEventListener('change', (event) => {
        if (event.target.checked) {
            localStorage.setItem('autostart-transmit', 'true');
        } else {
            localStorage.setItem('autostart-transmit', '');
        }
    });

    if (isAutostartTransmitterEnabled) {
        const textToSend = textArea.value;
    
        if (!textToSend) {
            return;
        }

        audioService.startSending(textToSend);
    }
});
