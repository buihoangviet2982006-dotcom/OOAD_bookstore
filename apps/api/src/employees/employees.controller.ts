import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { CurrentAccount } from '../auth/auth.types.js';
import { EmployeeDto } from './dto/employee.dto.js';
import { EmployeesService } from './employees.service.js';

/** Chỉ Quản lý – kể cả xem danh sách (có lương, thông tin nhân sự). */
@Roles('MANAGER')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list() {
    return this.employees.list();
  }

  @Post()
  create(@Body() dto: EmployeeDto) {
    return this.employees.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: EmployeeDto, @CurrentUser() actor: CurrentAccount) {
    return this.employees.update(id, dto, actor);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentAccount) {
    return this.employees.remove(id, actor);
  }
}
