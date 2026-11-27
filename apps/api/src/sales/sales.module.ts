import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller.js';
import { InvoicesService } from './invoices.service.js';

/** Phân hệ Quản lý bán hàng (QLBH): xem trước, lập hóa đơn, tra cứu hóa đơn. Đổi/trả: Chặng 7. */
@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class SalesModule {}
