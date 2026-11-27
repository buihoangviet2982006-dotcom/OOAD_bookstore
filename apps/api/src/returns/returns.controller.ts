import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { CurrentAccount } from '../auth/auth.types.js';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { CreateReturnDto, ReturnPreviewDto } from './dto/return.dto.js';
import { ReturnsService } from './returns.service.js';

/** Đổi / trả hàng: SALES và MANAGER. WAREHOUSE không truy cập. Người xử lý lấy từ phiên đăng nhập. */
@Roles('SALES')
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  list() {
    return this.returns.list();
  }

  /** Xem trước giá trị trả, tiền hoàn / khách bù – không ghi DB. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() dto: ReturnPreviewDto) {
    return this.returns.preview(dto);
  }

  @Post()
  create(@Body() dto: CreateReturnDto, @CurrentUser() staff: CurrentAccount) {
    return this.returns.create(dto, staff);
  }
}
