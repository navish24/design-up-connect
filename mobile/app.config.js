// Dynamic Expo config — layered on top of app.json.
// Set APP_VARIANT=beta (via eas.json env or .env.local) to produce the beta build.
// Production build: APP_VARIANT is unset (or anything other than "beta").

const base = require('./app.json').expo;

const IS_BETA = process.env.APP_VARIANT === 'beta';

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  expo: {
    ...base,

    // Beta gets a distinct display name and URL scheme so both builds
    // can be installed side-by-side on the same device.
    name: IS_BETA ? 'Connect Beta' : base.name,
    scheme: IS_BETA ? 'designup-beta' : base.scheme,

    ios: {
      ...base.ios,
      bundleIdentifier: IS_BETA
        ? 'com.designup.connect.beta'
        : base.ios.bundleIdentifier,
    },

    android: {
      ...base.android,
      package: IS_BETA
        ? 'com.designup.connect.beta'
        : base.android.package,
    },

    // EXPO_PUBLIC_* vars are inlined into the JS bundle at build time.
    // Read them with process.env.EXPO_PUBLIC_IS_BETA at runtime.
    extra: {
      isBeta: IS_BETA,
      eas: {
        projectId: '493cdee9-7e90-4a06-a0d7-3289f6a82322',
      },
    },
  },
};
