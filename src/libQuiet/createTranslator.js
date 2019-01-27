import libQuietProvider from './libQuietProvider';

/**
 * Factory function for creating encoders and decoders
 *
 * @param {string} type - Whether this should construct and 'encoder' or
 * 'decoder'.
 * @param {Object} profile - The sound profile to use for encoding and decoding.
 * @param {number} sampleRate - libquiet internally works at 44.1kHz but the
 * local sound card may be a different rate. Inform quiet about our local sound
 * card's sample rate so that it can resample to its internal sample rate.
 * @returns {Encoder|Decoder}
 */
export default function createTranslator(type, profile, sampleRate) {
    const libQuiet = libQuietProvider.get();

    const allProfiles
        = libQuiet.intArrayFromString(JSON.stringify({ profile }));
    const selectedProfileKey = libQuiet.intArrayFromString('profile');

    const translatorProfile = libQuiet.ccall(
        `quiet_${type}_profile_str`,
        'pointer',
        [ 'array', 'array' ],
        [ allProfiles, selectedProfileKey ]
    );

    const translator = libQuiet.ccall(
        `quiet_${type}_create`,
        'pointer',
        [ 'pointer', 'number' ],
        [ translatorProfile, sampleRate ]
    );

    libQuiet.ccall('free', null, [ 'pointer' ], [ translatorProfile ]);

    return translator;
}
