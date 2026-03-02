/**
 * App entry point - handles initial routing
 * MOCK version — skips auth, goes straight to main app
 */

import { Redirect } from 'expo-router';

export default function Index() {
  // Auth and onboarding are bypassed — go straight to the main app
  return <Redirect href="/(tabs)/camera" />;
}
