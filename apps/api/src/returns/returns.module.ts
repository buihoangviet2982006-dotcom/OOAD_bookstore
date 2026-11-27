import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller.js';
import { ReturnsService } from './returns.service.js';

/** Đổi / trả hàng (QLBH – Quản lý trả hàng / đổi hàng). */
@Module({
  controllers: [ReturnsController],
  providers: [ReturnsService],
})
export class ReturnsModule {}
