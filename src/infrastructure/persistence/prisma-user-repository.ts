import type { PrismaClient } from '@prisma/client';
import type {
  CreateUserInput,
  UserCredentialRecord,
  UserRecord,
  UserRepository,
} from '@/application/ports';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user === null
      ? null
      : { id: user.id, email: user.email, username: user.username };
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user === null
      ? null
      : { id: user.id, email: user.email, username: user.username };
  }

  async findCredentialByEmail(
    email: string,
  ): Promise<UserCredentialRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user === null
      ? null
      : {
          id: user.id,
          email: user.email,
          username: user.username,
          passwordHash: user.password,
        };
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        password: input.passwordHash,
      },
    });
    return { id: user.id, email: user.email, username: user.username };
  }
}
