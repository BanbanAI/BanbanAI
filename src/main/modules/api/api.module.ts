import { Module } from '@nestjs/common';
import { ApiController } from './api.controller';
import { ApiService } from './api.service';
import { ApiAccessGuard } from './guards';

@Module({
  controllers: [ApiController],
  providers: [ApiService, ApiAccessGuard],
  exports: [ApiService],
})
export class ApiModule {}
