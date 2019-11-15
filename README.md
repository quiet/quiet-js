Quiet.js
===========

**[Documentation](https://quiet.github.io/quiet-js/docs/Quiet.html)**

This is a javascript binding for [libquiet](https://github.com/quiet/quiet), a library for sending and receiving data via sound card. It can function either via speaker or cable (e.g., 3.5mm). Quiet comes included with a few transmissions profiles which configure quiet's transmitter and receiver. For speaker transmission, there is a profile which transmits around the 19kHz range, which is essentially imperceptible to people (nearly ultrasonic). For transmission via cable, quiet.js has profiles which offer speeds of at least 40 kbps.

Try it out in this [live example](https://quiet.github.io/quiet-js/).

Compatibility
--------
| Browser           | Transmitter             | Receiver                           |
| ------------------|-------------------------|------------------------------------|
| Chrome            | *Supported*             | *Supported*<sup>1</sup>            |
| Chrome (Android)  | *Supported*             | *Partially Supported*<sup>1,2</sup>|
| Edge              | *Supported*             | *Supported*                        |
| Firefox           | *Supported*             | *Partially Supported*<sup>3</sup>  |
| Firefox (Android) | *Supported*             | *Partially Supported*<sup>2,3</sup>|
| Internet Explorer | *Not Supported*         | *Not Supported*                    |
| Safari            | *Supported*             | *Not Supported*<sup>4</sup>        |
| Safari (iOS)      | *Supported*             | *Not Supported*<sup>4</sup>        |

[1]: For Chrome receivers, the page *must* be delivered via https. Chrome does not support microphone input without TLS.

[2]: GMSK profiles only

[3]: Firefox's WebAudio implementation resamples audio input to 32kHz, which limits all audio received to 16kHz and below. This means the ultrasonic profile cannot be used for Firefox receivers. Additionally, the resampler used by Firefox produces strong audio distortion, which makes reception by some profiles difficult. However, the audible profiles work well. For the most recent information on this limitation, refer to [Bug 953265](https://bugzilla.mozilla.org/show_bug.cgi?id=953265).

[4]: Safari does not support `getUserMedia` or microphone input in any capacity.

Usage
--------
The full documentation is available [here](http://quiet.github.io/quiet-js/docs/).

Quiet-js includes a blob of libquiet compiled by emscripten as well as a javascript binding for ease of use. The bindings must be loaded before the compiled portion. Below is the recommended way to include Quiet in your project.

```
    <script type="text/javascript" src="quiet.js"></script>
    <script type="text/javascript" src="your_project.js"></script>
    <script async type="text/javascript" src="quiet-emscripten.js"></script>
```

Additionally, the emscripten compiled portion requires a memory initializer, `quiet-emscripten.js.mem`. This is loaded asynchronously by `quiet-emscripten.js`.

**It is strongly recommended to also include libfec.js. An emscripten-compiled version of libfec may be found [here](https://github.com/quiet/libfec/releases) or with `npm install libfec`.** If libfec is not included, then quiet.js will not be able to use any profiles which use convolutional codes or Reed-Solomon error correction.

For a complete example demonstrating ultrasonic text transmission and reception, see [this example](https://github.com/quiet/quiet-js/tree/master/examples/text).


License
--------
Quiet and Quiet-js are licensed under 3-clause BSD. Quiet-js's emscripten-compiled output includes a statically-linked copies of [liquid dsp](http://liquidsdr.org/) and [libjansson](http://www.digip.org/jansson/), both of which are licensed under the MIT license. For more information on Quiet-js's 3rd party licenses, consult [LICENSE-3RD-PARTY](https://github.com/quiet/quiet-js/blob/master/LICENSE-3RD-PARTY).

Additionally, it is strongly recommended to link [libfec](http://www.ka9q.net/code/fec/) (`npm install libfec`). libfec is licensed under LGPL. It is the intention of this project to adhere to the provisions of LGPL by dynamically linking libfec. However, neither this statement nor any other statements in these projects may be construed as legal advice from the author. It is solely the user's responsibility to ensure their own compliance with all applicable licenses.
