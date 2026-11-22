/** Typed errors thrown by repository functions so screens can show the right message. */

export type RepoErrorCode = 'not_found' | 'invalid' | 'in_use' | 'duplicate' | 'already_done';

export class RepoError extends Error {
  constructor(
    message: string,
    public readonly code: RepoErrorCode,
  ) {
    super(message);
    this.name = 'RepoError';
  }
}

/** Thrown when a customer with the same phone number already exists. */
export class DuplicateCustomerError extends RepoError {
  constructor(
    public readonly existingId: string,
    public readonly existingName: string,
  ) {
    super(`Already saved as ${existingName}`, 'duplicate');
    this.name = 'DuplicateCustomerError';
  }
}

/** Throws RepoError('invalid') unless `value` is a whole number >= `min`. */
export function assertWhole(value: number, field: string, min = 0): void {
  if (!Number.isInteger(value) || value < min) {
    throw new RepoError(`${field} must be a whole number of at least ${min}`, 'invalid');
  }
}

/** Throws RepoError('invalid') when a required text is blank. Returns the trimmed text. */
export function requireText(value: string | undefined | null, field: string): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) throw new RepoError(`${field} is required`, 'invalid');
  return trimmed;
}
