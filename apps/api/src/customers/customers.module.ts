import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

/** Phân hệ Quản lý khách hàng (QLKH). */
@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
