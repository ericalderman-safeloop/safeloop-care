const { withAndroidManifest } = require('@expo/config-plugins')

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: "SafeLoop Care",
  slug: "safeloop-care",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "safeloop-care",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: false,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.safeloop.SafeLoopCare",
    buildNumber: "3",
    appleTeamId: "488Z8Y695B"
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff"
    },
    edgeToEdgeEnabled: true,
    package: "com.safeloop.SafeLoopCare",
    googleServicesFile: "./android/app/google-services.json"
  },
  web: {
    favicon: "./assets/favicon.png"
  },
  plugins: [
    "expo-dev-client",
    [
      "expo-image-picker",
      {
        photosPermission: "SafeLoop needs access to your photos to set a wearer's profile photo.",
        cameraPermission: "SafeLoop needs camera access to take a wearer's profile photo."
      }
    ],
    "expo-apple-authentication",
    "expo-audio",
    [
      "expo-notifications",
      {
        sounds: ["./assets/safeloop_alarm.caf"]
      }
    ],
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: "com.googleusercontent.apps.212440927886-lug7neo6r1iq26t7j9ppn266p22ife36"
      }
    ],
    [
      "react-native-maps",
      {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
      }
    ]
  ],
  extra: {
    eas: {
      projectId: "50586713-2ce3-4354-b008-9bdc4aac0eed"
    }
  },
  owner: "ericalderman"
}

module.exports = config
