import { Module } from '@nestjs/common';
import { ImportsController, SupplierPaymentsController } from './purchasing.controller.js';
import { PurchasingService } from './purchasing.service.js';

/** Phân hệ Quản lý nhập hàng (QLNH): phiếu nhập + thanh toán / công nợ NCC. */
@Module({
  controllers: [ImportsController, SupplierPaymentsController],
  providers: [PurchasingService],
})
export class PurchasingModule {}
