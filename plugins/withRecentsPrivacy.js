/**
 * Keeps shop data out of the Android Recents screen (PLAN §15 DPDP risk: profit, customer pages
 * and report previews must not sit in the task switcher for anyone holding the phone).
 * Adds `setRecentsScreenshotEnabled(false)` (Android 13+) to MainActivity.onCreate: Recents shows
 * a blank card instead of the last screen. Screenshots inside the app still work.
 * Older Android versions get the JS privacy cover in AppLockGate.
 */
const { withMainActivity } = require('expo/config-plugins');

const MARKER = 'setRecentsScreenshotEnabled(false)';

/** Pure: adds the call right after `super.onCreate(...)`. Idempotent; throws when it cannot. */
function addRecentsPrivacy(src, language) {
  if (src.includes(MARKER)) return src;
  const superCall = /^(\s*)super\.onCreate\([^)]*\);?[ \t]*$/m;
  const match = src.match(superCall);
  if (!match) throw new Error('withRecentsPrivacy: super.onCreate(...) not found in MainActivity');
  const indent = match[1];
  const semi = language === 'java' ? ';' : '';
  const lines = [
    `${indent}// Gathir: no screenshot of shop data in Android Recents (Android 13+).`,
    `${indent}if (android.os.Build.VERSION.SDK_INT >= 33) ${MARKER}${semi}`,
  ].join('\n');
  return src.replace(superCall, (line) => `${line}\n${lines}`);
}

function withRecentsPrivacy(config) {
  return withMainActivity(config, (cfg) => {
    cfg.modResults.contents = addRecentsPrivacy(cfg.modResults.contents, cfg.modResults.language);
    return cfg;
  });
}

module.exports = withRecentsPrivacy;
module.exports.addRecentsPrivacy = addRecentsPrivacy;
