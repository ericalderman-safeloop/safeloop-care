import 'react-native-url-polyfill/auto';
import structuredClone from "@ungap/structured-clone";
if (!("structuredClone" in global)) {
  (global as typeof globalThis & { structuredClone?: typeof structuredClone }).structuredClone = structuredClone;
}
import * as SplashScreen from 'expo-splash-screen';
import { registerRootComponent } from 'expo';

SplashScreen.preventAutoHideAsync();

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
