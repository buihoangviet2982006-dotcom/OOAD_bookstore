import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators.js';
import { BooksService } from './books.service.js';
import { BookDto } from './dto/book.dto.js';

/** Đọc: mọi người đã đăng nhập (POS cần tra cứu sách). Ghi: WAREHOUSE và MANAGER. */
@Controller('books')
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get()
  list() {
    return this.books.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.books.get(id);
  }

  @Roles('WAREHOUSE')
  @Post()
  create(@Body() dto: BookDto) {
    return this.books.create(dto);
  }

  @Roles('WAREHOUSE')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: BookDto) {
    return this.books.update(id, dto);
  }

  @Roles('WAREHOUSE')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.books.remove(id);
  }
}
