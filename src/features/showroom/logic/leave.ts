/** Leaving the Showroom after the PIN (pure, so the stack maths is tested in Node). */

/** The route the lock screen replaces itself with after a correct PIN. */
export const SHOWROOM_LEAVE_PATH = '/showroom/leave';

/**
 * How many screens to pop from the top of the stack so the seller lands on the screen they were on
 * before the Showroom. `routeNames` is the stack, bottom first; the leave screen is on top.
 * Returns null when nothing sits below the Showroom (go Home instead).
 */
export function screensToLeave(routeNames: readonly string[]): number | null {
  let showroom = -1;
  for (let i = routeNames.length - 1; i >= 0; i--) {
    if (routeNames[i] === 'showroom/index' || routeNames[i] === 'showroom') {
      showroom = i;
      break;
    }
  }
  if (showroom <= 0) return null;
  return routeNames.length - showroom;
}
