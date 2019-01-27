import { getMicStream } from './rtc';
import audioService from './audioService';

require('./stylesheets/bootstrap.css');
require('./stylesheets/bootstrap-theme.css');
require('./stylesheets/github-dark.css');
require('./stylesheets/styles.css');

const receiveButton = document.getElementById('receive-button');
const receiveProfileSelect = document.getElementById('receive-profile-select');
const receivedText = document.getElementById('received-text');

const sendButton = document.getElementById('send-button');
const sendProfileSelect = document.getElementById('send-profile-select');
const textToSend = document.getElementById('text-to-send');

let audioStream = null;

audioService.init()
.then(() => getMicStream())
.then(webrtcAudioStream => {
    audioStream = webrtcAudioStream;
})
.then(() => {
    audioService.getProfiles().forEach(profileName => {
        const option = document.createElement('option');
        option.value = profileName;
    
        option.text = profileName;

        sendProfileSelect.appendChild(option);
        receiveProfileSelect.appendChild(option.cloneNode(true));
    });
})
.then(() => {
    sendButton.addEventListener('click', () => {
        sendButton.disabled = true;

        audioService.send(textToSend.value, sendProfileSelect.value)
            .catch(error => console.error('error while sending', error))
            .then(() => sendButton.disabled = false);
    });
})
.then(() => {
    let hasReceivedText = false;

    receiveButton.innerText = 'Start Receiving';

    function onReceiveCallback(text) {
        if (hasReceivedText) {
            receivedText.innerText += text;
        } else {
            hasReceivedText = true;

            receivedText.innerText = text;
        }
    }

    receiveButton.addEventListener('click', () => {
        if (audioService.isReceiving()) {
            audioService.stopReceiving();
            receiveButton.innerText = 'Start Receiving';

            return;
        }

        audioService.startReceiving(
            audioStream,
            receiveProfileSelect.value,
            onReceiveCallback
        );

        receiveButton.innerText = 'Stop Receiving';

        receivedText.classList.remove('hidden');
    });
});
