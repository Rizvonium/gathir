/**
 * Incoming links (gathir://…). Gathir never needs one: WhatsApp shares files, not links, and
 * notification taps navigate in code. A link must never open a screen directly, because any page
 * or chat can carry one: /showroom/leave would skip the Showroom PIN, /owner the owner-number PIN,
 * /lock?mode=set the current PIN, and any tab route would pop the Showroom.
 *
 * - App already running: ignore the link (stay exactly where the phone is).
 * - Cold start from a link: open Home, where the app lock and onboarding redirect still apply.
 */
export const LINK_LANDING = '/';

export function redirectIncomingPath(_path: string, initial: boolean): string | null {
  return initial ? LINK_LANDING : null;
}
