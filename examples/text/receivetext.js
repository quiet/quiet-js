(() => {
  window.Quiet.init({
    profilesPath: '/quiet-profiles.json',
    memoryInitializerPath: '/quiet-emscripten.js.mem',
    emscriptenPath: '/quiet-emscripten.js'

  })
  var target
  var content = new ArrayBuffer(0)
  var warningbox

  function onReceive (recvPayload) {
    content = window.Quiet.mergeab(content, recvPayload)
    target.textContent = window.Quiet.ab2str(content)
    warningbox.classList.add('hidden')
  };

  function onReceiverCreateFail (reason) {
    console.log('failed to create quiet receiver: ' + reason)
    warningbox.classList.remove('hidden')
    warningbox.textContent = 'Sorry, it looks like this example is not supported by your browser. Please give permission to use the microphone or try again in Google Chrome or Microsoft Edge.'
  };

  function onReceiveFail (_) {
    warningbox.classList.remove('hidden')
    warningbox.textContent = "We didn't quite get that. It looks like you tried to transmit something. You may need to move the transmitter closer to the receiver and set the volume to 50%."
  };

  function onQuietReady () {
    var profilename = document.querySelector('[data-quiet-profile-name]').getAttribute('data-quiet-profile-name')
    window.Quiet.receiver({ profile: profilename,
      onReceive: onReceive,
      onCreateFail: onReceiverCreateFail,
      onReceiveFail: onReceiveFail
    })
  };

  function onQuietFail (reason) {
    console.log('quiet failed to initialize: ' + reason)
    warningbox.classList.remove('hidden')
    warningbox.textContent = 'Sorry, it looks like there was a problem with this example (' + reason + ')'
  };

  function initQuiet () {
    target = document.querySelector('[data-quiet-receive-text-target]')
    warningbox = document.querySelector('[data-quiet-warning]')
    window.Quiet.addReadyCallback(onQuietReady, onQuietFail)
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('start-lister-btn').addEventListener('click', initQuiet)
  })
})()
