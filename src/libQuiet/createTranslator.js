import libQuietProvider from './libQuietProvider';

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

    // libquiet internally works at 44.1kHz but the local sound card may be
    // a different rate. Inform quiet about our local sound card's sample
    // rate so that it can resample to its internal sample rate
    const translator = libQuiet.ccall(
        `quiet_${type}_create`,
        'pointer',
        [ 'pointer', 'number' ],
        [ translatorProfile, sampleRate ]
    );

    libQuiet.ccall('free', null, [ 'pointer' ], [ translatorProfile ]);

    return translator;
}
