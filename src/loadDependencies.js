/**
 * @module loadDependencies
 */

import { libQuietProvider}  from './libQuiet';

/**
 * Loads the external dependencies necessary to use Quiet and makes it available
 * for internal use.
 *
 * @param {Object} options - Configuration of where external dependencies are
 * located.
 * @string {string} emscriptenPath - Path prefix to quiet-emscripten.js.
 * @string {string} memoryInitializerPath - Path prefix to
 * quiet-emscripten.js.mem.
 * @returns {Promise} Resolves when the emscriptenPath dependency is loaded
 * successfully.
 */
export default function loadDependencies(options) {
    if (libQuietProvider.get()) {
        return Promise.resolve();
    }

    const {
        emscriptenPath,
        memoryInitializerPath
    } = options;

    if (memoryInitializerPath) {
        setMemoryInitializerPath(memoryInitializerPath);
    }

    return new Promise((resolve, reject) => {
        const scriptTag = document.createElement('script');

        scriptTag.async = true;
        scriptTag.addEventListener('error', () => {
            scriptTag.remove();

            reject();
        });
        scriptTag.addEventListener('load', resolve);
        scriptTag.type = 'text/javascript';

        scriptTag.src = `${emscriptenPath}quiet-emscripten.js`

        document.head.appendChild(scriptTag);
    })
    .then(() => libQuietProvider.set(window.quiet_emscripten));
}

/**
 * Sets the path quietlib should access to find the memory initializer.
 *
 * @param {string} url - Path to quiet-emscripten.js.mem.
 * @private
 * @returns {void}
 */
function setMemoryInitializerPath(url) {
    window.quiet_emscripten_config = window.quiet_emscripten_config || {};

    window.quiet_emscripten_config.locateFile = function (fileName) {
        if (fileName === 'quiet-emscripten.js.mem') {
            return `${url}quiet-emscripten.js.mem`;
        }
    };
}
