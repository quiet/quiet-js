/*global __dirname, require*/

const path = require('path');

module.exports = {
  entry: __dirname + "/quiet.js",
  output: {
    path: __dirname + "/output",
    filename: "foo.js",
    library: "foo",
    libraryTarget: "umd"
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};
