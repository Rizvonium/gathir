/**
 * Showroom session (PLAN §4.9): while the phone is in a customer's hands, nothing outside the
 * Showroom may open without the PIN. Pure module state (no expo imports) so Node tests cover it.
 *
 * - `enterShowroom` / `exitShowroom`: the Showroom screen is mounted (counted, so a remount is safe).
 * - `grantShowroomLeave` / `consumeShowroomLeave`: the lock screen grants ONE leave after a correct
 *   PIN; /showroom/leave consumes it. Reaching /showroom/leave any other way (a link) does nothing.
 * - `whenShowroomClosed`: owner-only navigation (notification taps) waits until the Showroom is left.
 */

let depth = 0;
let leaveGranted = false;
const pending = new Map<string, () => void>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function isShowroomActive(): boolean {
  return depth > 0;
}

/** The Showroom screen mounted. Returns the matching `exitShowroom` for an effect cleanup. */
export function enterShowroom(): () => void {
  depth += 1;
  if (depth === 1) emit();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    exitShowroom();
  };
}

/** The Showroom screen unmounted (after the PIN, or no PIN set). Runs deferred navigation. */
export function exitShowroom(): void {
  if (depth === 0) return;
  depth -= 1;
  if (depth > 0) return;
  leaveGranted = false;
  emit();
  const run = [...pending.values()];
  pending.clear();
  if (run.length === 0) return;
  // After the Showroom has finished closing (this runs from its unmount), not in the middle of it.
  setTimeout(() => {
    for (const fn of run) {
      try {
        fn();
      } catch {
        // A deferred navigation failing must not break leaving the Showroom.
      }
    }
  }, 0);
}

/** Called by the lock screen after a correct PIN whose return target is the Showroom exit. */
export function grantShowroomLeave(): void {
  leaveGranted = true;
}

/** True (once) when the PIN was just entered for leaving. Always true when no Showroom is open. */
export function consumeShowroomLeave(): boolean {
  if (!isShowroomActive()) return true;
  const ok = leaveGranted;
  leaveGranted = false;
  return ok;
}

/**
 * Runs `fn` now when no Showroom is open; otherwise keeps it (latest per `key`) until the
 * Showroom is left. Returns true when it ran now.
 */
export function whenShowroomClosed(key: string, fn: () => void): boolean {
  if (!isShowroomActive()) {
    fn();
    return true;
  }
  pending.set(key, fn);
  return false;
}

export function subscribeShowroom(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests only: back to a clean state. */
export function resetShowroomSessionForTests(): void {
  depth = 0;
  leaveGranted = false;
  pending.clear();
  listeners.clear();
}
