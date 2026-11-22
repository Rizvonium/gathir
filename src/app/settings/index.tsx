import { Redirect } from 'expo-router';

/** /settings — the settings index is the More tab. */
export default function SettingsIndex() {
  return <Redirect href="/more" />;
}
