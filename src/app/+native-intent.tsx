import { redirectIncomingPath } from '@/lib/deepLinks';

/** Every gathir:// link is rewritten here before Expo Router sees it (see lib/deepLinks). */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  try {
    return redirectIncomingPath(path, initial);
  } catch {
    return initial ? '/' : null;
  }
}
