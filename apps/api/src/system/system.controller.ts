import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '../auth/decorators.js';
import type { CurrentAccount } from '../auth/auth.types.js';
import { AccountsService } from './accounts.service.js';
import { BackupsService } from './backups.service.js';
import {
  CreateAccountDto,
  CreateBackupDto,
  ResetAccountPasswordDto,
  UpdateAccountDto,
} from './dto/account.dto.js';
import { permissionMatrix } from './permissions.js';

/** Quản lý tài khoản – chỉ Quản lý. Không có API xóa tài khoản (giữ lịch sử; dùng khóa). */
@Roles('MANAGER')
@Controller('system/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list() {
    return this.accounts.list();
  }

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.accounts.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAccountDto, @CurrentUser() actor: CurrentAccount) {
    return this.accounts.update(id, dto, actor);
  }

  @Post(':id/lock')
  lock(@Param('id') id: string, @CurrentUser() actor: CurrentAccount) {
    return this.accounts.lock(id, actor);
  }

  @Post(':id/unlock')
  unlock(@Param('id') id: string) {
    return this.accounts.unlock(id);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetAccountPasswordDto) {
    return this.accounts.resetPassword(id, dto);
  }
}

/** Ma trận quyền chỉ xem (không có API lưu). */
@Roles('MANAGER')
@Controller('system/permissions')
export class PermissionsController {
  @Get()
  list() {
    return permissionMatrix();
  }
}

/** Sao lưu = xuất JSON + lịch sử. Phục hồi chưa triển khai (không có endpoint). */
@Roles('MANAGER')
@Controller('system/backups')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get()
  list() {
    return this.backups.list();
  }

  @Post()
  create(@Body() dto: CreateBackupDto, @CurrentUser() actor: CurrentAccount) {
    return this.backups.create(dto, actor);
  }
}
