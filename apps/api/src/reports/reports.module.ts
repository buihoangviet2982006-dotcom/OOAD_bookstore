import { Module } from '@nestjs/common';
import { DashboardController, ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

/** Thống kê – báo cáo (đặc tả TKBC) và chỉ số trang Tổng quan. */
@Module({
  controllers: [ReportsController, DashboardController],
  providers: [ReportsService],
})
export class ReportsModule {}
