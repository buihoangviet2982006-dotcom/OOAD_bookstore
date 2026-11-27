import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { CurrentAccount } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { CartDto, CreateInvoiceDto } from './dto/invoice.dto.js';
import { InvoicesService } from './invoices.service.js';

/** Bán hàng & hóa đơn: SALES và MANAGER. WAREHOUSE không truy cập. */
@Roles('SALES')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list() {
    return this.invoices.list();
  }

  /** Xem trước tiền hàng / giảm giá / tổng – không ghi DB. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: CartDto) {
    return this.invoices.preview(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.invoices.get(id);
  }

  /** Lập hóa đơn. Người lập lấy từ tài khoản đang đăng nhập, không từ payload. */
  @Post()
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() cashier: CurrentAccount) {
    return this.invoices.create(dto, cashier);
  }
}
