import { Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Kỳ báo cáo: ngày theo lịch Việt Nam, tính cả hai đầu. */
export class ReportPeriodDto {
  @Matches(DATE, { message: 'Ngày bắt đầu (from) phải có dạng YYYY-MM-DD.' })
  from: string;

  @Matches(DATE, { message: 'Ngày kết thúc (to) phải có dạng YYYY-MM-DD.' })
  to: string;
}
