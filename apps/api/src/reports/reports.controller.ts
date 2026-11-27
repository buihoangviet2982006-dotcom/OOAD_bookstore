import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { CurrentAccount } from '../auth/auth.types.js';
import { ReportPeriodDto } from './dto/report-period.dto.js';
import { ReportsService } from './reports.service.js';

/** Báo cáo doanh thu / lợi nhuận toàn cửa hàng – chỉ Quản lý. */
@Roles('MANAGER')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('revenue')
  revenue(@Query() period: ReportPeriodDto) {
    return this.reports.revenue(period);
  }

  @Get('bestsellers')
  bestsellers(@Query() period: ReportPeriodDto) {
    return this.reports.bestsellers(period);
  }
}

/** Chỉ số trang Tổng quan – mọi vai trò; backend chọn số liệu theo vai trò của người đăng nhập. */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@Query() period: ReportPeriodDto, @CurrentUser() user: CurrentAccount) {
    return this.reports.dashboard(period, user);
  }
}
