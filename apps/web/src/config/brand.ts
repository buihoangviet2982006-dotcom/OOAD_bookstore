/**
 * Thông tin nhà sách – hệ thống demo MỘT cửa hàng (khớp `STORE_BRANCH` ở backend: auth.constants.ts).
 * Dùng chung cho sidebar, trang đăng nhập, hóa đơn in và tên tệp xuất.
 */
export const BRAND_CONFIG = {
  name: "Nhà sách bé bi",
  subtitle: "QUẢN LÝ NHÀ SÁCH",
  /** Tiền tố tên tệp CSV / JSON xuất ra. */
  fileSlug: "nha-sach-be-bi",
  store: {
    id: "BR-01",
    name: "Chi nhánh trung tâm",
    address: "273 An Dương Vương, Phường Chợ Quán, TP.HCM",
  },
} as const;
