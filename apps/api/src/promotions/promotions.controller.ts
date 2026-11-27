import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type { CurrentAccount } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { PromotionDto, VoucherDto } from './dto/promotion.dto.js';
import { PromotionsService } from './promotions.service.js';

/*
 * Quyền (đặc tả QLKM – tác nhân Quản lý):
 * - MANAGER: quản lý toàn bộ, xem lịch sử sử dụng voucher.
 * - SALES: chỉ đọc CTKM / voucher đang dùng được (thông tin cần cho POS).
 * - WAREHOUSE: không truy cập.
 */

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Roles('SALES')
  @Get()
  list(@CurrentUser() user: CurrentAccount) {
    return this.promotions.listPromotions(user.vaiTro !== 'MANAGER');
  }

  @Roles('MANAGER')
  @Post()
  create(@Body() dto: PromotionDto) {
    return this.promotions.createPromotion(dto);
  }

  @Roles('MANAGER')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: PromotionDto) {
    return this.promotions.updatePromotion(id, dto);
  }
}

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly promotions: PromotionsService) {}

  @Roles('SALES')
  @Get()
  list(@CurrentUser() user: CurrentAccount) {
    return this.promotions.listVouchers(user.vaiTro !== 'MANAGER');
  }

  /** Lịch sử sử dụng voucher (UC "Tra cứu lịch sử sử dụng mã giảm giá" – chỉ Quản lý). */
  @Roles('MANAGER')
  @Get('usages')
  usages(@Query('code') code?: string) {
    return this.promotions.listVoucherUsages(code);
  }

  @Roles('MANAGER')
  @Post()
  create(@Body() dto: VoucherDto) {
    return this.promotions.createVoucher(dto);
  }

  @Roles('MANAGER')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: VoucherDto) {
    return this.promotions.updateVoucher(id, dto);
  }
}
