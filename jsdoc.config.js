/* eslint-env node */

module.exports = {
    opts: {
        destination: './dist/jsdoc',
        recurse: true
    },
    plugins: [],
    source: {
        include: [ 'src' ],
        includePattern: '.+\\.js$'
    },
    sourceType: 'module',
    tags: {
        allowUnknownTags: true,
        dictionaries: [
            'jsdoc',
            'closure'
        ]
    },
    templates: {
        cleverLinks: false,
        monospaceLinks: false
    }
};
