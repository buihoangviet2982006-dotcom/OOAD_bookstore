import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Lớp bảo vệ cuối: đổi lỗi ràng buộc của Prisma/PostgreSQL thành lỗi HTTP dễ hiểu.
 * Service vẫn nên tự kiểm tra trước để có thông báo cụ thể hơn
 * (vd "ISBN đã được dùng cho sách SP001"); filter này bắt các trường hợp còn sót, kể cả tranh chấp đồng thời.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const [status, message] = this.translate(error);
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Prisma ${error.code}: ${error.message}`);
    }
    response.status(status).json({ statusCode: status, message });
  }

  private translate(error: Prisma.PrismaClientKnownRequestError): [number, string] {
    switch (error.code) {
      case 'P2002': // unique
        return [HttpStatus.CONFLICT, 'Dữ liệu bị trùng với bản ghi đã có.'];
      case 'P2003': // khóa ngoại
        return [
          HttpStatus.CONFLICT,
          'Dữ liệu đang được tham chiếu hoặc tham chiếu tới bản ghi không tồn tại.',
        ];
      case 'P2025': // không tìm thấy bản ghi cần cập nhật/xóa
        return [HttpStatus.NOT_FOUND, 'Không tìm thấy dữ liệu yêu cầu.'];
      default:
        return [HttpStatus.INTERNAL_SERVER_ERROR, 'Lỗi hệ thống khi xử lý dữ liệu.'];
    }
  }
}
