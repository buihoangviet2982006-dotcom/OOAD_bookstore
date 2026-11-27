import { Module } from '@nestjs/common';
import { StockAdjustmentsController } from './stock-adjustments.controller.js';
import { StockAdjustmentsService } from './stock-adjustments.service.js';

/** Phân hệ Quản lý kho (QLK): kiểm kê & điều chỉnh tồn. Theo dõi / cảnh báo tồn dùng dữ liệu `/books`. */
@Module({
  controllers: [StockAdjustmentsController],
  providers: [StockAdjustmentsService],
})
export class InventoryModule {}
