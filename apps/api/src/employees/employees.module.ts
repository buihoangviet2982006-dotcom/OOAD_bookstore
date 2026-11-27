import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

/** Phân hệ Quản lý nhân viên (QLNV). */
@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService],
})
export class EmployeesModule {}
