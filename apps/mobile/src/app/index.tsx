import { Redirect } from 'expo-router';

/**
 * Entry route. The AuthGate in _layout handles redirects once status is known;
 * this just sends the initial "/" to the tabs (the gate bounces to login if
 * unauthenticated).
 */
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
