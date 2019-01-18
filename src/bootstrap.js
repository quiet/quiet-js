import { libQuietProvider}  from './libQuiet';

export function loadDependencies(options) {
    const {
        libfecUrl,
        memoryInitializerUrl
    } = options;

    if (libfecUrl) {
        setLibfecUrl(libfecUrl);
    }

    if (memoryInitializerUrl) {
        setMemoryInitializerUrl(memoryInitializerUrl);
    }

    return import(/* webpackChunkName: "emscripten" */ '../emscripten/quiet-emscripten')
        .then(({ default: quietLibFactory }) => {
            const libQuiet = quietLibFactory.init();

            libQuietProvider.set(libQuiet);
        }).catch(() => 'An error occurred while loading the component');
}

/**
 * Sets the path quietlib should access to find libfec.
 *
 * @param {string} url - Path prefix to libfec.js.
 * @returns {void}
 */
export function setLibfecUrl(url) {
    window.Module.dynamicLibraries.push(url);
}

/**
 * Sets the path quietlib should access to find the memory initializer.
 *
 * @param {string} url - Path to quiet-emscripten.js.mem.
 * @returns {void}
 */
export function setMemoryInitializerUrl(url) {
    window.Module.locateFile = function (fileName) {
        if (fileName === 'quiet-emscripten.js.mem') {
            return url;
        }
    };
}
