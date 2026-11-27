import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { Trim, TrimOptional, TrimUpper } from '../../common/transforms.js';

export const BOOK_STATUSES = ['ACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED'] as const;
export type BookStatusInput = (typeof BOOK_STATUSES)[number];

/** ISBN: chỉ gồm chữ số và dấu "-", đúng 10 hoặc 13 chữ số (không kiểm tra checksum). */
const ISBN_REGEX = /^(?=(?:-*\d){10}(?:(?:-*\d){3})?-*$)[\d-]+$/;
const MAX_MONEY = 1_000_000_000;

/**
 * Dùng cho cả POST và PATCH (FE luôn gửi đủ form).
 * KHÔNG có trường `stock`: tồn kho chỉ thay đổi qua phiếu nhập, hóa đơn, đổi/trả, kiểm kê.
 * Các trường FE gửi thừa (stock, categoryName…) bị ValidationPipe loại bỏ.
 */
export class BookDto {
  /** Mã sách (SKU) = khóa chính. Bắt buộc khi tạo; khi sửa phải giữ nguyên. */
  @TrimUpper()
  @IsOptional()
  @Matches(/^[A-Z0-9_-]{2,50}$/, { message: 'Mã sách gồm 2–50 ký tự chữ in hoa, số, "-" hoặc "_".' })
  sku?: string;

  @Trim()
  @Matches(ISBN_REGEX, { message: 'ISBN phải gồm 10 hoặc 13 chữ số (có thể có dấu "-").' })
  isbn: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'Tên sách không được để trống.' })
  @MaxLength(255, { message: 'Tên sách tối đa 255 ký tự.' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn thể loại.' })
  categoryId: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn tác giả.' })
  authorId: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn nhà xuất bản.' })
  publisherId: string;

  @IsOptional()
  @IsInt({ message: 'Năm xuất bản phải là số nguyên.' })
  @Min(1800, { message: 'Năm xuất bản không hợp lệ.' })
  @Max(new Date().getFullYear() + 1, { message: 'Năm xuất bản không được ở tương lai.' })
  publishYear?: number;

  @IsInt({ message: 'Giá nhập phải là số nguyên (VNĐ).' })
  @Min(0, { message: 'Giá nhập không được âm.' })
  @Max(MAX_MONEY)
  importPrice: number;

  @IsInt({ message: 'Giá bán phải là số nguyên (VNĐ).' })
  @Min(1, { message: 'Giá bán phải lớn hơn 0.' })
  @Max(MAX_MONEY)
  sellPrice: number;

  @IsInt({ message: 'Định mức tồn tối thiểu phải là số nguyên.' })
  @Min(0, { message: 'Định mức tồn tối thiểu không được âm.' })
  @Max(100_000)
  minStock: number;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Vị trí kệ tối đa 100 ký tự.' })
  shelfLocation?: string;

  /** OUT_OF_STOCK là trạng thái suy ra – nhận vào được coi như ACTIVE. */
  @IsOptional()
  @IsIn(BOOK_STATUSES, { message: 'Trạng thái sách không hợp lệ.' })
  status?: BookStatusInput;

  @TrimOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
