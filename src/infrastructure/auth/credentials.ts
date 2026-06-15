import bcrypt from 'bcryptjs';
import { z } from 'zod';

/** A user record needed to verify a login (includes the stored password hash). */
export interface CredentialUser {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly passwordHash: string;
}

/** The authenticated identity returned on success (never includes the hash). */
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly username: string;
}

export const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// A valid bcrypt hash to compare against when no user is found, so the
// response time does not reveal whether an account exists (prevents user
// enumeration via timing).
const DUMMY_HASH =
  '$2a$10$iSR6tHPvPbLI0lhuEIJMkeVj.Cff25HIpQsr2rGtgx585.a8wocai';

/**
 * Verifies login credentials. Returns the authenticated user on success or
 * `null` on any failure — the caller must surface a single generic error so it
 * never reveals which field was wrong (no account enumeration; see CLAUDE.md).
 *
 * `findUser` is injected (Dependency Inversion) so this stays unit-testable
 * without a database.
 */
export async function verifyCredentials(
  rawCredentials: unknown,
  findUser: (email: string) => Promise<CredentialUser | null>,
): Promise<AuthenticatedUser | null> {
  const parsed = credentialsSchema.safeParse(rawCredentials);
  if (!parsed.success) return null;

  const user = await findUser(parsed.data.email);
  // Always run a comparison (against a dummy hash when the user is missing) to
  // keep the response time uniform.
  const passwordMatches = await bcrypt.compare(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  if (user === null || !passwordMatches) return null;

  return { id: user.id, email: user.email, username: user.username };
}
