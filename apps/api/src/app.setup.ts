import { BadRequestException, INestApplication, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';

/** Gom thông báo lỗi validation (kể cả object lồng nhau) thành một chuỗi – FE đọc trường `message`. */
function collectMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...collectMessages(error.children ?? []),
  ]);
}

/** Cấu hình dùng chung cho main.ts và test e2e. */
export function configureApp(app: INestApplication): void {
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // bỏ các trường FE gửi thừa (vd role, employeeId) thay vì tin chúng
      transform: true,
      exceptionFactory: (errors) => new BadRequestException(collectMessages(errors).join(' ')),
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
}
