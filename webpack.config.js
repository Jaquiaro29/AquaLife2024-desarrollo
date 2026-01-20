const { getDefaultConfig } = require('@expo/webpack-config');
const webpack = require('webpack');
require('dotenv').config({ path: '.env' });

module.exports = async function (env, argv) {
  const config = await getDefaultConfig(env, argv);

  // Provide browser fallbacks for Node built-ins required by some Expo modules in web builds.
  config.resolve.fallback = {
    ...(config.resolve.fallback || {}),
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
  };

  // Ensure assets/scripts are served from the GitHub Pages repo path.
  config.output = {
    ...(config.output || {}),
    publicPath: '/AquaLife2024-desarrollo/',
  };

  // Inyectar variables de entorno necesarias en el bundle web
  const envKeys = [
    'FIREBASE_API_KEY',
    'FIREBASE_AUTH_DOMAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_STORAGE_BUCKET',
    'FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_APP_ID',
    'FIREBASE_MEASUREMENT_ID',
  ];
  const definitions = envKeys.reduce((acc, k) => {
    acc[`process.env.${k}`] = JSON.stringify(process.env[k] || '');
    return acc;
  }, {});

  config.plugins = [
    ...(config.plugins || []),
    new webpack.DefinePlugin(definitions),
  ];

  return config;
};