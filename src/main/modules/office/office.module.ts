import { Global, Module } from '@nestjs/common';
import { OfficeController } from './office.controller';
import { OfficeService } from './office.service';

@Global()
@Module({
  controllers: [OfficeController],
  providers: [OfficeService],
  exports: [OfficeService], 
})
export class OfficeModule {}