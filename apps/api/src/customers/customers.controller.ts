import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { CustomersService } from './customers.service.js';
import { CustomerDto } from './dto/customer.dto.js';

/** Quản lý khách hàng: SALES và MANAGER (đặc tả QLKH – tác nhân Nhân viên bán hàng). */
@Roles('SALES')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list() {
    return this.customers.list();
  }

  @Post()
  create(@Body() dto: CustomerDto) {
    return this.customers.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CustomerDto) {
    return this.customers.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customers.remove(id);
  }
}
