import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { BackupsService } from './backups.service.js';
import { AccountsController, BackupsController, PermissionsController } from './system.controller.js';

/** Quản lý hệ thống (đặc tả QLHT): tài khoản, ma trận quyền (chỉ xem), sao lưu JSON. */
@Module({
  controllers: [AccountsController, PermissionsController, BackupsController],
  providers: [AccountsService, BackupsService],
})
export class SystemModule {}
