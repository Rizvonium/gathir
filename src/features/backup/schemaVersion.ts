/** Current database schema version = number of drizzle migrations shipped with this build. */
import journal from '../../../drizzle/meta/_journal.json';

/** Bumps automatically with every `npm run db:generate` migration. */
export const CURRENT_SCHEMA_VERSION: number = journal.entries.length;
