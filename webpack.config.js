/* eslint-env node */

const CopyWebpackPlugin = require('copy-webpack-plugin');
const WriteFilePlugin = require('write-file-webpack-plugin');
const path = require('path');

module.exports = {
    devServer: {
        contentBase: './example'
    },
    entry: {
        'example': './example/index.js',
        'lib-quiet-js': './src/index.js'
    },
    module: {
        rules: [
            {
                enforce: 'pre',
                loader: 'eslint-loader',
                test: /\.js$/
            },
            {
                test: /\.css$/,
                use: [ 'style-loader', 'css-loader' ]
            },
            {
                exclude: /(node_modules)/,
                test: /\.js$/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [ '@babel/preset-env' ],
                        plugins: [ '@babel/plugin-syntax-dynamic-import' ]
                    }
                }
            }
        ]
    },
    output: {
        filename: '[name].js',
        libraryTarget: 'umd',
        path: path.join(__dirname, 'dist')
    },
    plugins: [
        new WriteFilePlugin(),
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
    ]
};
