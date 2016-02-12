Quiet-js
===========
This is a javascript binding for [libquiet](https://github.com/brian-armstrong/quiet), a library for sending and receiving data via sound card. It can function either via speaker or cable (e.g., 3.5mm). Quiet comes included with a few transmissions profiles which can be selected for the intended use. For speaker transmission, there is a profile which transmits around the 19kHz range, which is essentially imperceptible to people.

Quiet uses the Web Audio functionality in order to send and receive sound. This depends on `getUserMedia` which presently only works on Chrome and Firefox. Further, Firefox's implementation limits all audio received to 16kHz and below, which means the ultrasonic profile cannot be used for Firefox receivers. For the most recent information on this limitation, refer to [Bug 953265](https://bugzilla.mozilla.org/show_bug.cgi?id=953265).

Usage
--------
Quiet-js includes a blob of libquiet compiled by emscripten as well as a javascript binding for ease of use. The bindings must be loaded before the compiled portion. Below is the recommended way to include Quiet in your project.

```
    <script type="text/javascript" src="quiet.js"></script>
    <script type="text/javascript" src="your_project.js"></script>
    <script async type="text/javascript" src="quiet-emscripten.js"></script>
```

Additionally, the emscripten compiled portion requires a memory initializer, `quiet-emscripten.js.mem`. This is loaded asynchronously by `quiet-emscripten.js`.

For a complete example demonstrating ultrasonic text transmission and reception, see [this example](https://github.com/brian-armstrong/quiet-js/tree/master/examples/text).


License
--------
Quiet and Quiet-js are licensed under 3-clause BSD. Please note that Quiet-js's emscripten-compiled output includes a statically-linked copy of [libfec](http://www.ka9q.net/code/fec/) which is licensed under LGPL. For more information on Quiet-js's 3rd party licenses, consult [LICENSE-3RD-PARTY](https://github.com/brian-armstrong/quiet-js/blob/master/LICENSE-3RD-PARTY.txt).
