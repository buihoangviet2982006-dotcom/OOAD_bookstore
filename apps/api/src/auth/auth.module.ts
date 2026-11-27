import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { readJwtSecret, readTokenTtlSeconds } from './auth.config.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: readJwtSecret(config),
        signOptions: { expiresIn: readTokenTtlSeconds(config) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Áp cho toàn bộ API theo thứ tự: xác thực (401) rồi mới phân quyền (403).
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
