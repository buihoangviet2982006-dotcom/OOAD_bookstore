import { Body, Controller, Get, Post } from '@nestjs/common';
import type { CurrentAccount } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { CreateStockAdjustmentDto } from './dto/stock-adjustment.dto.js';
import { StockAdjustmentsService } from './stock-adjustments.service.js';

/** Kiểm kê / điều chỉnh kho: WAREHOUSE và MANAGER; SALES 403. Người lập lấy từ phiên đăng nhập. */
@Roles('WAREHOUSE')
@Controller('inventory/adjustments')
export class StockAdjustmentsController {
  constructor(private readonly adjustments: StockAdjustmentsService) {}

  @Get()
  list() {
    return this.adjustments.list();
  }

  /** Lập phiếu và áp dụng ngay (không có nháp / duyệt). */
  @Post()
  create(@Body() dto: CreateStockAdjustmentDto, @CurrentUser() staff: CurrentAccount) {
    return this.adjustments.create(dto, staff);
  }
}
