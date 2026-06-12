import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleService } from './google.service';
import { GoogleController, GoogleCallbackController } from './google.controller';
import { User } from '../auth/domain/entities/user.entity';
import { Note } from '../notes/domain/entities/note.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Note]),
    AuthModule,
  ],
  controllers: [GoogleController, GoogleCallbackController],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
