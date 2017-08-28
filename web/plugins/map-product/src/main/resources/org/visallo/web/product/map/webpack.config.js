var path = require('path');
var webpack = require('webpack');
var VisalloAmdExternals = [
    'components/DroppableHOC',
    'components/NavigationControls',
    'components/RegistryInjectorHOC',
    'configuration/plugins/registry',
    'data/web-worker/store/actions',
    'data/web-worker/store/product/actions',
    'data/web-worker/store/product/actions-impl',
    'data/web-worker/store/product/selectors',
    'data/web-worker/store/element/actions-impl',
    'data/web-worker/store/ontology/selectors',
    'data/web-worker/store/selection/actions',
    'data/web-worker/store/selection/actions-impl',
    'data/web-worker/store/user/actions-impl',
    'org/visallo/web/product/map/dist/actions-impl',
    'data/web-worker/util/ajax',
    'public/v1/api',
    'util/dnd',
    'util/formatters',
    'util/popovers/fileImport/fileImport',
    'util/vertex/formatters',
    'util/retina',
    'util/withContextMenu',
    'util/mapConfig',
     'openlayers',
    'fast-json-patch',
    'updeep',
    'react',
    'create-react-class',
    'prop-types',
    'react-dom',
    'redux',
    'react-redux'
].map(path => ({ [path]: { amd: path, commonjs2: false, commonjs: false }}));

var baseConfig = {
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: '[name]',
    libraryTarget: 'umd',
  },
  externals: VisalloAmdExternals,
  resolve: {
    extensions: ['.js', '.jsx', '.hbs']
  },
  module: {
    rules: [
        {
            test: /\.jsx?$/,
            exclude: /(node_modules)/,
            use: [
                { loader: 'babel-loader' }
            ]
        }
    ]
  },
  devtool: 'source-map',
  plugins: [
    new webpack.optimize.UglifyJsPlugin({
        mangle: false,
        sourceMap: true,
        compress: {
            drop_debugger: false,
            warnings: true
        }
    })
  ]
};

module.exports = [
    Object.assign({}, baseConfig, {
        entry: {
            'actions-impl': './worker/actions-impl.js',
            'plugin-worker': './worker/plugin.js'
        },
        target: 'webworker'
    }),
    Object.assign({}, baseConfig, {
        entry: {
            Map: './MapContainer.jsx'
        },
        target: 'web'
    })
];
