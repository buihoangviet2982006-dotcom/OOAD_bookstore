import { Module } from '@nestjs/common';
import { AuthorsController, CategoriesController, PublishersController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

/** Phân hệ Quản lý danh mục sách (QLDMS): thể loại, tác giả, nhà xuất bản. */
@Module({
  controllers: [CategoriesController, AuthorsController, PublishersController],
  providers: [CatalogService],
})
export class CatalogModule {}
