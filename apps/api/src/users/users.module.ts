import { Module } from '@nestjs/common';

import { SecurityModule } from '../auth/security.module';
import { AvatarService } from './avatar.service';
import { SupportTeamService } from './support-team.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SecurityModule],
  controllers: [UsersController],
  providers: [UsersService, SupportTeamService, AvatarService],
  exports: [UsersService, SupportTeamService],
})
export class UsersModule {}
