import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'is_email_verified', default: false })
  isEmailVerified: boolean;

  @Column({ name: 'login_attempts', default: 0 })
  loginAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil: Date | null;

  @Column({ name: 'password_expires_at', type: 'timestamp' })
  passwordExpiresAt: Date;

  @Column({ name: 'totp_secret', nullable: true, type: 'varchar' })
  totpSecret: string | null;

  @Column({ name: 'totp_enabled', default: false })
  totpEnabled: boolean;

  @Column({ name: 'email_verification_token', nullable: true, type: 'varchar' })
  emailVerificationToken: string | null;

  @Column({ name: 'email_verification_expires_at', type: 'timestamp', nullable: true })
  emailVerificationExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
