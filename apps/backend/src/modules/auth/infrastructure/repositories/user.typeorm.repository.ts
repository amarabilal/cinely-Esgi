import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';

@Injectable()
export class UserTypeOrmRepository implements IUserRepository {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByEmailVerificationToken(tokenHash: string): Promise<User | null> {
    return this.repo.findOne({ where: { emailVerificationToken: tokenHash } });
  }

  save(user: Partial<User>): Promise<User> {
    return this.repo.save(this.repo.create(user));
  }

  async update(id: string, partial: Partial<User>): Promise<void> {
    await this.repo.update(id, partial);
  }
}
