/** The config plugin that keeps shop data out of Android Recents (plugins/withRecentsPrivacy.js). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addRecentsPrivacy } = require('../../../plugins/withRecentsPrivacy') as { addRecentsPrivacy: (src: string, language: string) => string };

const KOTLIN = `class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme);
    super.onCreate(null)
  }
}`;

describe('withRecentsPrivacy', () => {
  it('turns off the Recents screenshot right after super.onCreate, once', () => {
    const out = addRecentsPrivacy(KOTLIN, 'kt');
    expect(out).toContain('    super.onCreate(null)\n    // Gathir: no screenshot of shop data in Android Recents (Android 13+).\n    if (android.os.Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false)\n  }');
    expect(addRecentsPrivacy(out, 'kt')).toBe(out);
  });

  it('adds a semicolon for Java and fails loudly when onCreate is missing', () => {
    expect(addRecentsPrivacy('void onCreate(Bundle b) {\n  super.onCreate(b);\n}', 'java')).toContain('setRecentsScreenshotEnabled(false);');
    expect(() => addRecentsPrivacy('class MainActivity {}', 'kt')).toThrow(/super.onCreate/);
  });
});
