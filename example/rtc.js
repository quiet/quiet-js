export function getAvailableMics() {
    return navigator.mediaDevices.enumerateDevices()
        .then(devices =>
            devices.filter(device => device.kind === 'audioinput'));
}

export function getMicStream(deviceId) {
    let constraints;

    if (deviceId) {
        constraints = {
            audio: {
                deviceId: {
                    exact: deviceId
                }
            }
        };
    } else {
        constraints = { audio: true };
    }

    return window.navigator.mediaDevices.getUserMedia(constraints);
}
