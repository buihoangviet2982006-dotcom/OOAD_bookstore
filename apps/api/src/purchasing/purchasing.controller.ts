import { Body, Controller, Get, Post } from '@nestjs/common';
import type { CurrentAccount } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { CreatePurchaseOrderDto, CreateSupplierPaymentDto } from './dto/purchasing.dto.js';
import { PurchasingService } from './purchasing.service.js';

/** Nhập hàng: WAREHOUSE và MANAGER; SALES 403. Người lập lấy từ phiên đăng nhập. */
@Roles('WAREHOUSE')
@Controller('imports')
export class ImportsController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get()
  list() {
    return this.purchasing.listPurchaseOrders();
  }

  @Post()
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() staff: CurrentAccount) {
    return this.purchasing.createPurchaseOrder(dto, staff);
  }
}

/** Thanh toán NCC: WAREHOUSE và MANAGER; SALES 403. Người ghi nhận lấy từ phiên đăng nhập. */
@Roles('WAREHOUSE')
@Controller('supplier-payments')
export class SupplierPaymentsController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get()
  list() {
    return this.purchasing.listPayments();
  }

  @Post()
  create(@Body() dto: CreateSupplierPaymentDto, @CurrentUser() staff: CurrentAccount) {
    return this.purchasing.createPayment(dto, staff);
  }
}
