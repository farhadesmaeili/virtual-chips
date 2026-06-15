import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { verifyCredentials, type CredentialUser } from './credentials';

const PASSWORD = 'password123';

async function makeUser(): Promise<CredentialUser> {
  return {
    id: 'u1',
    email: 'alice@example.com',
    username: 'alice',
    passwordHash: await bcrypt.hash(PASSWORD, 10),
  };
}

/** A finder that returns the given user only for its email. */
function finderFor(user: CredentialUser) {
  return async (email: string): Promise<CredentialUser | null> =>
    email === user.email ? user : null;
}

const noUser = async (): Promise<CredentialUser | null> => null;

describe('verifyCredentials', () => {
  it('returns the authenticated user for valid credentials', async () => {
    const user = await makeUser();
    const result = await verifyCredentials(
      { email: user.email, password: PASSWORD },
      finderFor(user),
    );
    expect(result).toEqual({
      id: 'u1',
      email: 'alice@example.com',
      username: 'alice',
    });
  });

  it('never returns the password hash', async () => {
    const user = await makeUser();
    const result = await verifyCredentials(
      { email: user.email, password: PASSWORD },
      finderFor(user),
    );
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('returns null for a wrong password', async () => {
    const user = await makeUser();
    const result = await verifyCredentials(
      { email: user.email, password: 'wrong' },
      finderFor(user),
    );
    expect(result).toBeNull();
  });

  it('returns null for an unknown account', async () => {
    const result = await verifyCredentials(
      { email: 'nobody@example.com', password: PASSWORD },
      noUser,
    );
    expect(result).toBeNull();
  });

  it('returns null for malformed input (no enumeration of the reason)', async () => {
    const user = await makeUser();
    expect(
      await verifyCredentials(
        { email: 'not-an-email', password: PASSWORD },
        finderFor(user),
      ),
    ).toBeNull();
    expect(
      await verifyCredentials(
        { email: user.email, password: '' },
        finderFor(user),
      ),
    ).toBeNull();
    expect(await verifyCredentials(null, finderFor(user))).toBeNull();
  });
});
