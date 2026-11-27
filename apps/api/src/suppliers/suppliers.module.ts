import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';

/** Phân hệ Quản lý nhà cung cấp (QLNCC). */
@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService],
})
export class SuppliersModule {}
