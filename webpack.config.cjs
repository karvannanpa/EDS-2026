/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, no-console */
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const copyfiles = require('copyfiles');
const glob = require('glob');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const multipleHtmlPlugins = require('./htmlWebpackPlugins.cjs');
// const CustomResolverPlugin = require('./customResolverPlugin.js');

const brands = ['default'];

// if (fs.existsSync('brand-config.json')) {
//   const strData = fs.readFileSync('brand-config.json', { encoding: 'utf8', flag: 'r' });
//   if (strData) {
//     const brandConfig = JSON.parse(strData);

//     if (process.env.BRANDS) {
//       const envBrands = process.env.BRANDS.split(',');
//       brands = brands.concat(envBrands);
//     } else {
//       brands = brands.concat(brandConfig.brands);
//     }
//   }
// }

console.log('Building brands', brands);

const files = fs.readdirSync('./react-app/app');
const blocks = files.filter(
  (file) => fs.statSync(path.join('./react-app/app', file)).isDirectory()
    && !file.startsWith('.'),
);

console.log('Available blocks', blocks);

// Plugin to copy  dist files to EDS location
class CopyFiles {
  // eslint-disable-next-line class-methods-use-this
  apply(compiler) {
    // Copy files only in production mode when running `npm run build`
    // if (compiler.options.mode !== 'production') {
    //   return null;
    // }
    compiler.hooks.done.tap('Copy', () => {
      // copy component files
      copyfiles(
        ['./dist/default/**/*', './blocks'],
        {
          all: true,
          up: 2,
          exclude: [
            './dist/default/vendor/**/*',
            './dist/default/**/*.html',
            './dist/default/styles/**/*',
            './dist/default/**/*.hot-update.js',
            './dist/default/**/*.hot-update.mjs',
            './dist/default/**/*.hot-update.json',
            './dist/default/chunks/**/*',
          ],
          verbose: true,
        },
        (err) => err && console.error(err),
      );
      // copy vendor file
      copyfiles(
        ['./dist/default/vendor/vendor.js', './scripts'],
        {
          up: 3,
        },
        (err) => err && console.error(err),
      );
      copyfiles(
        ['./dist/default/chunks/**/*', './scripts/chunks'],
        {
          up: 3,
        },
        (err) => err && console.error(err),
      );
      copyfiles(
        ['./dist/default/styles/styles.css', './styles'],
        {
          up: 3,
        },
        (err) => err && console.error(err),
      );

      // brands.forEach((brand) => {
      //   if (brand !== 'default') {
      //     blocks.forEach((block) => {
      //       fs.copyFile(`./dist/${brand}/${block}/${block}.css`, `./blocks/${block}/${brand}/_${block}.css`, (err) => {
      //         // if (err) console.error(err);
      //         // eslint-disable-next-line max-len
      //         /* console.log(`./dist/${brand}/${block}/${block}.css was copied to ./blocks/${block}/${brand}/_${block}.css`); */
      //       });
      //       fs.copyFile(`./dist/${brand}/${block}/${block}.css`, `./blocks/${block}/${brand}/${block}.css`, (err) => {
      //         // if (err) console.error(err);
      //         // eslint-disable-next-line max-len
      //         /* console.log(`./dist/${brand}/${block}/${block}.css was copied to ./blocks/${block}/${brand}/${block}.css`);  */
      //       });
      //     });
      //   }
      // });
    });
  }
}

// Here goes all configuration
const configurations = brands.map((brand, index) => ({
  mode: 'development',
  entry: glob.sync('./react-app/app/*/*.{jsx,tsx}').reduce((obj, el) => {
    // extract `component name` from directory path
    const compName = path.parse(el).dir.split('/').pop();
    // eslint-disable-next-line no-param-reassign
    obj[compName] = `./${el}`;
    return obj;
  }, {}),
  devtool: false,
  experiments: {
    outputModule: true,
  },
  output: {
    clean: true,
    path: path.resolve(__dirname, `dist${brand ? `/${brand}` : ''}`),
    filename: '[name]/[name].js',
    chunkFilename: './chunks/[name].js',
    publicPath: './scripts/', // to tell webpack to load "chunk" file from this path.
    library: {
      type: 'module',
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.jsx?$/, // apply to all JS/JSX files
        exclude: /node_modules/, // exclude all files on node_modules
        loader: 'babel-loader',
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(sa|sc|c)ss$/, // styles files
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name]/[name].css',
      chunkFilename: './chunks/[name].css',
    }),
    ...multipleHtmlPlugins,
    // don't copy files when running `npm run analyze`
    ...[process.env.npm_lifecycle_event !== 'analyze' && new CopyFiles()],
    ...[
      process.env?.WEBPACK_SERVE !== 'true'
      && new webpack.BannerPlugin({
        banner: (opt) => {
          // append messages to JS and CSS file
          if (opt.filename.endsWith('.css')) {
            return '/* stylelint-disable */';
          }
          if (opt.filename.endsWith('.js')) {
            return '/* eslint-disable */';
          }
        },
        raw: true,
        stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
      }),
    ],
  ],
  externalsType: 'module',
  externals: [
    // Don't bundle EDS JS files.
    function ({ request }, callback) {
      if (request.includes('scripts/')) {
        // Externalize to a commonjs module using the request path
        const filepath = request.split('scripts/').pop();
        return callback(null, `/scripts/${filepath?.endsWith('.js') ? filepath : `${filepath}.js`}`);
      }
      // Continue without externalizing the import
      callback();
    },
  ],
  resolve: {
    plugins: [
      // brand specific css resolver
      // new CustomResolverPlugin({ brand }),
    ],
    extensions: ['.js', '.jsx', '.tsx', '.ts'],
  },
  optimization: {
    // check dev or production mode
    minimize: process.env?.WEBPACK_SERVE !== 'true',
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          mangle: true,
          compress: {
            drop_console: ['log', 'info', 'warn', 'debug'],
          },
        },
      }),
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: [
            'default',
            {
              calc: true,
              // convertValues: true,
              discardComments: {
                removeAll: true,
              },
              discardDuplicates: true,
              discardEmpty: true,
              mergeRules: true,
              normalizeCharset: true,
              svgo: true,
            },
          ],
        },
      }),
    ],
    chunkIds: 'named',
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /node_modules/,
          chunks: 'initial',
          name: 'vendor',
          enforce: true,
        },
      },
    },
  },
  ...(index === 0 ? {
    devServer: {
      host: 'localhost', // where to run
      // historyApiFallback: true,
      port: 4200, // given port to exec. app
      // open: true, // open new tab
      hot: false, // Enable webpack's Hot Module Replacement
      watchFiles: ['./react-app/**/*'],
      devMiddleware: {
        // publicPath: '/dist/',
        writeToDisk: true,
      },
    },
    watchOptions: {
      aggregateTimeout: 600,
    },
  } : {}),
}));

module.exports = configurations;
 