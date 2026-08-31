import { Module } from '@nestjs/common';

import { SupportTeamService } from './support-team.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, SupportTeamService],
  exports: [UsersService, SupportTeamService],
})
export class UsersModule {}
