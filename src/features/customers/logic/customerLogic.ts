/**
 * Pure customer-book logic: relative dates as i18n keys, avatar tints, likes editing,
 * learned-likes suggestions and budget presets. No React, no expo imports (Node-tested).
 */
import type { CustomerLikes, CustomerTag } from '@/db/schema';
import { shawlSwatches } from '@/ui/tokens';

export const DAY_MS = 86_400_000;
/** "Not visited in 3 months" filter. */
export const INACTIVE_DAYS = 90;

/** Tag chips in the order sellers see them. */
export const TAG_ORDER: readonly CustomerTag[] = ['regular', 'wholesale', 'tourist', 'walk_in', 'other'];

// ---------------------------------------------------------------------------------------------
// Relative dates

function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Whole calendar days from `now` to `at` (negative = past). DST-safe via rounding. */
export function dayDiff(at: number, now: number): number {
  return Math.round((dayStart(at) - dayStart(now)) / DAY_MS);
}

export type RelKey = { key: string; count?: number };

/** "today" / "yesterday" / "5 days ago" / "2 months ago" / "over a year ago" as an i18n key. */
export function relativePast(at: number, now: number): RelKey {
  const days = -dayDiff(at, now);
  if (days <= 0) return { key: 'relative.today' };
  if (days === 1) return { key: 'relative.yesterday' };
  if (days < 30) return { key: 'relative.daysAgo', count: days };
  if (days < 365) return { key: 'relative.monthsAgo', count: Math.max(1, Math.round(days / 30)) };
  return { key: 'relative.overYear' };
}

/** Follow-up due label: "Due today", "Due tomorrow", "In 5 days", "2 days late". */
export function followUpDue(dueAt: number, now: number): RelKey & { overdue: boolean; due: boolean } {
  const d = dayDiff(dueAt, now);
  if (d < 0) return { key: 'followUp.late', count: -d, overdue: true, due: true };
  if (d === 0) return { key: 'followUp.dueToday', overdue: false, due: true };
  if (d === 1) return { key: 'followUp.dueTomorrow', overdue: false, due: false };
  return { key: 'followUp.dueIn', count: d, overdue: false, due: false };
}

// ---------------------------------------------------------------------------------------------
// Follow-up dates

export const FOLLOW_UP_HOUR = 10;
export type FollowUpChoice = 'tomorrow' | 'days3' | 'week1' | 'weeks2' | 'month1';
export const FOLLOW_UP_CHOICES: readonly FollowUpChoice[] = ['tomorrow', 'days3', 'week1', 'weeks2', 'month1'];

/** The chosen day at 10:00 local time (shop hours, so the reminder is useful). */
export function atReminderHour(dayMs: number): number {
  const d = new Date(dayMs);
  d.setHours(FOLLOW_UP_HOUR, 0, 0, 0);
  return d.getTime();
}

/** Due time for a quick choice. "1 month" keeps the day of month (clamped: 31 Jan → 28/29 Feb). */
export function followUpDueAt(choice: FollowUpChoice, now: number): number {
  const d = new Date(now);
  if (choice === 'month1') {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  } else {
    const add = { tomorrow: 1, days3: 3, week1: 7, weeks2: 14 }[choice];
    d.setDate(d.getDate() + add);
  }
  return atReminderHour(d.getTime());
}

// ---------------------------------------------------------------------------------------------
// Avatar tint

/** Swatch hex for a colour key, or null for multicolour / unknown keys. */
export function swatchHex(key: string | null | undefined): string | null {
  if (!key) return null;
  const s = shawlSwatches.find((x) => x.key === key);
  return s && s.hex !== 'multi' ? s.hex : null;
}

/** Display name for a colour key ("maroon" → "Maroon"); unknown keys are title-cased. */
export function swatchName(key: string): string {
  const s = shawlSwatches.find((x) => x.key === key);
  if (s) return s.name;
  return key.charAt(0).toLocaleUpperCase() + key.slice(1);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Avatar background: the customer's favourite colour when it is a plain swatch, else a stable
 * pick from the theme accents (so the same person always gets the same tint).
 */
export function avatarTint(id: string, favouriteColour: string | null, accents: readonly string[]): string {
  return swatchHex(favouriteColour) ?? accents[hashString(id) % accents.length] ?? '#6D1A24';
}

// ---------------------------------------------------------------------------------------------
// Likes

export const EMPTY_LIKES: CustomerLikes = { colours: [], crafts: [] };

export type BudgetPreset = { key: string; minPaise: number; maxPaise: number };
/** Rough budget bands sellers think in. The top band has a very high ceiling ("₹25,000+"). */
export const OPEN_MAX_PAISE = 1_000_000_000; // ₹1 crore
export const BUDGET_PRESETS: readonly BudgetPreset[] = [
  { key: 'under5', minPaise: 0, maxPaise: 500_000 },
  { key: 'from5to10', minPaise: 500_000, maxPaise: 1_000_000 },
  { key: 'from10to25', minPaise: 1_000_000, maxPaise: 2_500_000 },
  { key: 'over25', minPaise: 2_500_000, maxPaise: OPEN_MAX_PAISE },
];

export function budgetPresetOf(likes: CustomerLikes): BudgetPreset | null {
  return BUDGET_PRESETS.find((p) => p.minPaise === likes.budgetMinPaise && p.maxPaise === likes.budgetMaxPaise) ?? null;
}

export function hasBudget(likes: CustomerLikes): boolean {
  return typeof likes.budgetMinPaise === 'number' && typeof likes.budgetMaxPaise === 'number';
}

export function withBudget(likes: CustomerLikes, min: number | null, max: number | null): CustomerLikes {
  const next: CustomerLikes = { colours: likes.colours, crafts: likes.crafts };
  if (min !== null && max !== null) {
    next.budgetMinPaise = min;
    next.budgetMaxPaise = max;
  }
  return next;
}

function toggleIn(list: readonly string[], value: string): string[] {
  const lower = value.toLowerCase();
  return list.some((x) => x.toLowerCase() === lower) ? list.filter((x) => x.toLowerCase() !== lower) : [...list, value];
}

export const toggleColour = (likes: CustomerLikes, key: string): CustomerLikes => ({ ...likes, colours: toggleIn(likes.colours, key) });
export const toggleCraft = (likes: CustomerLikes, craft: string): CustomerLikes => ({ ...likes, crafts: toggleIn(likes.crafts, craft) });

export function likesEmpty(likes: CustomerLikes): boolean {
  return likes.colours.length === 0 && likes.crafts.length === 0 && !hasBudget(likes);
}

export type LearnedLikesInput = {
  crafts: string[];
  colours: string[];
  budgetMinPaise: number | null;
  budgetMaxPaise: number | null;
};

/** What purchases taught us that the seller has not saved yet. Null when there is nothing new. */
export type LikesSuggestion = { crafts: string[]; colours: string[]; budget: { minPaise: number; maxPaise: number } | null };

export function learnedSuggestion(likes: CustomerLikes, learned: LearnedLikesInput): LikesSuggestion | null {
  const has = (list: string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase());
  const crafts = learned.crafts.filter((c) => c && !has(likes.crafts, c));
  const colours = learned.colours.filter((c) => c && !has(likes.colours, c));
  const budget =
    !hasBudget(likes) && learned.budgetMinPaise !== null && learned.budgetMaxPaise !== null
      ? { minPaise: learned.budgetMinPaise, maxPaise: learned.budgetMaxPaise }
      : null;
  if (crafts.length === 0 && colours.length === 0 && !budget) return null;
  return { crafts, colours, budget };
}

/** Accepts a suggestion: merges crafts and colours, fills the budget if none was set. */
export function acceptSuggestion(likes: CustomerLikes, s: LikesSuggestion): CustomerLikes {
  const merged: CustomerLikes = { ...likes, crafts: [...likes.crafts, ...s.crafts], colours: [...likes.colours, ...s.colours] };
  return s.budget && !hasBudget(likes) ? withBudget(merged, s.budget.minPaise, s.budget.maxPaise) : merged;
}

/** Stable key for "dismissed" state so a new learning shows again. */
export function suggestionKey(s: LikesSuggestion): string {
  return [...s.crafts, '|', ...s.colours, '|', s.budget ? `${s.budget.minPaise}-${s.budget.maxPaise}` : ''].join(',');
}

// ---------------------------------------------------------------------------------------------
// Form

export type CustomerDraft = {
  name: string;
  /** E.164 when valid, '' when empty. */
  phone: string;
  /** Raw phone text, to know whether an invalid number was typed. */
  phoneText: string;
  city: string;
  address: string;
  tag: CustomerTag;
  notes: string;
  likes: CustomerLikes;
  whatsappOk: boolean;
};

export function emptyDraft(prefill: { name?: string; phone?: string } = {}): CustomerDraft {
  return {
    name: prefill.name?.trim() ?? '',
    phone: prefill.phone ?? '',
    phoneText: prefill.phone ?? '',
    city: '',
    address: '',
    tag: 'regular',
    notes: '',
    likes: { ...EMPTY_LIKES },
    whatsappOk: true,
  };
}

export type DraftErrors = { name?: 'required'; phone?: 'invalid' };

export function validateDraft(d: CustomerDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!d.name.trim()) errors.name = 'required';
  if (d.phoneText.trim() !== '' && !d.phone) errors.phone = 'invalid';
  return errors;
}

export function draftToInput(d: CustomerDraft) {
  return {
    name: d.name.trim(),
    phone: d.phone || null,
    city: d.city.trim(),
    address: d.address.trim(),
    tag: d.tag,
    notes: d.notes.trim(),
    likes: d.likes,
    whatsappOk: d.whatsappOk,
  };
}

/** True when the draft differs from where it started (guards an accidental back). */
export function draftChanged(a: CustomerDraft, b: CustomerDraft): boolean {
  return JSON.stringify(draftToInput(a)) !== JSON.stringify(draftToInput(b));
}

/** Only allow in-app absolute paths for returnTo (no schemes, no protocol-relative URLs). */
export function safeReturnTo(returnTo: string | undefined | null): string | null {
  if (!returnTo) return null;
  const v = returnTo.trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('://')) return null;
  return v;
}
