import { Module } from '@nestjs/common';
import { PromotionsController, VouchersController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';

/** Phân hệ Quản lý khuyến mãi (QLKM): chương trình khuyến mãi + mã giảm giá. */
@Module({
  controllers: [PromotionsController, VouchersController],
  providers: [PromotionsService],
})
export class PromotionsModule {}
