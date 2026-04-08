import { User } from '../entities/user.entity';

export const USER_REPOSITORY = 'USER_REPOSITORY';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  findByEmailVerificationToken(tokenHash: string): Promise<User | null>;
  save(user: Partial<User>): Promise<User>;
  update(id: string, partial: Partial<User>): Promise<void>;
}
