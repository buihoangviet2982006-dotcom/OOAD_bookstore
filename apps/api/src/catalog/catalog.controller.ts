import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { CatalogService } from './catalog.service.js';
import { AuthorDto, CategoryDto, PublisherDto } from './dto/catalog.dto.js';

/*
 * Quyền: mọi người đã đăng nhập được đọc (SALES cần lọc sách ở POS);
 * chỉ WAREHOUSE (và MANAGER) được thêm / sửa / xóa.
 */

@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.listCategories();
  }

  @Roles('WAREHOUSE')
  @Post()
  create(@Body() dto: CategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Roles('WAREHOUSE')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CategoryDto) {
    return this.catalog.updateCategory(id, dto);
  }

  @Roles('WAREHOUSE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalog.deleteCategory(id);
  }
}

@Controller('authors')
export class AuthorsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.listAuthors();
  }

  @Roles('WAREHOUSE')
  @Post()
  create(@Body() dto: AuthorDto) {
    return this.catalog.createAuthor(dto);
  }

  @Roles('WAREHOUSE')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: AuthorDto) {
    return this.catalog.updateAuthor(id, dto);
  }

  @Roles('WAREHOUSE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalog.deleteAuthor(id);
  }
}

@Controller('publishers')
export class PublishersController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.listPublishers();
  }

  @Roles('WAREHOUSE')
  @Post()
  create(@Body() dto: PublisherDto) {
    return this.catalog.createPublisher(dto);
  }

  @Roles('WAREHOUSE')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: PublisherDto) {
    return this.catalog.updatePublisher(id, dto);
  }

  @Roles('WAREHOUSE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalog.deletePublisher(id);
  }
}
