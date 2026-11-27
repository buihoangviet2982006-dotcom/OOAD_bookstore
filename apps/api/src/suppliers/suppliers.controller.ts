import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { SupplierDto } from './dto/supplier.dto.js';
import { SuppliersService } from './suppliers.service.js';

/**
 * Quản lý nhà cung cấp: WAREHOUSE và MANAGER (NV kho cần chọn NCC khi lập phiếu nhập).
 * Không có DELETE – ngừng hợp tác bằng status INACTIVE.
 */
@Roles('WAREHOUSE')
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list() {
    return this.suppliers.list();
  }

  @Post()
  create(@Body() dto: SupplierDto) {
    return this.suppliers.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: SupplierDto) {
    return this.suppliers.update(id, dto);
  }
}
