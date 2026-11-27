import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { BooksModule } from './books/books.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { PromotionsModule } from './promotions/promotions.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { PurchasingModule } from './purchasing/purchasing.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { SalesModule } from './sales/sales.module.js';
import { SuppliersModule } from './suppliers/suppliers.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { SystemModule } from './system/system.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    CatalogModule,
    BooksModule,
    CustomersModule,
    SuppliersModule,
    EmployeesModule,
    PromotionsModule,
    SalesModule,
    ReturnsModule,
    PurchasingModule,
    InventoryModule,
    ReportsModule,
    SystemModule,
  ],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
