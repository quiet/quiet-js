const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
    entry: {
        example: './example/index.js',
        lib: './src/index.js'
    },
    module: {
        rules: [
            {
                enforce: 'pre',
                exclude: [ /node_modules/, /docs/, /examples/ ],
                loader: 'eslint-loader',
                test: /\.js$/
            }
        ]
    },
    output: {
        filename: "[name].js",
        chunkFilename: '[name].bundle.js',
        path: path.join(__dirname, 'dist')
    },
    plugins: [
        new CopyWebpackPlugin([
            {
                from: './emscripten/quiet-emscripten.js',
                to: '.'
            },
            {
                from:
                    './emscripten/quiet-emscripten.js.mem',
                to: '.'
            }
        ])
    ],
    node: {
        fs: "empty"
     }
};
