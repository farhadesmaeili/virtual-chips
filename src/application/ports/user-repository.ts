/** Public user data (never includes the password hash). */
export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly username: string;
}

/** User data needed to verify a login (includes the stored hash). */
export interface UserCredentialRecord extends UserRecord {
  readonly passwordHash: string;
}

export interface CreateUserInput {
  readonly email: string;
  readonly username: string;
  readonly passwordHash: string;
}

/**
 * Persistence port for users. The application depends on this interface, never
 * on a concrete database client (Dependency Inversion).
 */
export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  /** Returns the credential record (with hash) for authentication. */
  findCredentialByEmail(email: string): Promise<UserCredentialRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
}
