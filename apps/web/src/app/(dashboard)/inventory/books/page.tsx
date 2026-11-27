"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit2, Eye, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Drawer, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { emptyNumberFields, formatCurrency, toNumberInput, type NumberInput } from "@/lib/format";
import { inventoryService } from "@/services";
import type { Author, Book, BookStatus, Category, Publisher } from "@/types";

export default function BooksPage() {
  const { showToast } = useToast();
  // Với API thật, tồn kho do chứng từ quyết định – không sửa tay trên form sách.
  const stockEditable = false;

  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);

  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [pubFilter, setPubFilter] = useState("ALL");

  const [detailBook, setDetailBook] = useState<Book | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);

  // Form states
  const [sku, setSku] = useState("");
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [publisherId, setPublisherId] = useState("");
  const [publishYear, setPublishYear] = useState<NumberInput>(2025);
  const [importPrice, setImportPrice] = useState<NumberInput>(80000);
  const [sellPrice, setSellPrice] = useState<NumberInput>(135000);
  const [stock, setStock] = useState(20);
  const [minStock, setMinStock] = useState<NumberInput>(10);
  const [shelfLocation, setShelfLocation] = useState("Kệ A1 - Tầng 1");
  const [status, setStatus] = useState<BookStatus>("ACTIVE");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    const [bk, cat, aut, pub] = await Promise.all([
      inventoryService.getBooks(),
      inventoryService.getCategories(),
      inventoryService.getAuthors(),
      inventoryService.getPublishers(),
    ]);
    setBooks(bk);
    setCategories(cat);
    setAuthors(aut);
    setPublishers(pub);
  };

  useEffect(() => {
    void Promise.resolve()
      .then(() => loadAll())
      .catch((err: unknown) =>
        showToast(err instanceof Error ? err.message : "Không tải được dữ liệu.", "error"),
      );
    // Lỗi tải (mất kết nối, hết phiên…) hiện thành thông báo thay vì bảng trống im lặng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (catFilter !== "ALL" && b.categoryId !== catFilter) return false;
      if (pubFilter !== "ALL" && b.publisherId !== pubFilter) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.sku.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.authorName.toLowerCase().includes(q)
      );
    });
  }, [books, query, catFilter, pubFilter]);

  const openCreate = () => {
    setEditing(null);
    setSku(`SP${String(books.length + 1).padStart(3, "0")}`);
    setIsbn("978-604-1-00000-0");
    setTitle("");
    setCategoryId(categories[0]?.id ?? "");
    setAuthorId(authors[0]?.id ?? "");
    setPublisherId(publishers[0]?.id ?? "");
    setPublishYear(2026);
    setImportPrice(85000);
    setSellPrice(145000);
    setStock(20);
    setMinStock(10);
    setShelfLocation("Kệ A1 - Tầng 1");
    setStatus("ACTIVE");
    setDescription("");
    setFormOpen(true);
  };

  const openEdit = (b: Book) => {
    setEditing(b);
    setSku(b.sku);
    setIsbn(b.isbn);
    setTitle(b.title);
    setCategoryId(b.categoryId);
    setAuthorId(b.authorId);
    setPublisherId(b.publisherId);
    setPublishYear(b.publishYear);
    setImportPrice(b.importPrice);
    setSellPrice(b.sellPrice);
    setStock(b.stock);
    setMinStock(b.minStock);
    setShelfLocation(b.shelfLocation);
    setStatus(b.status);
    setDescription(b.description);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const missing = emptyNumberFields({ "Năm xuất bản": publishYear, "Giá nhập": importPrice, "Giá bán": sellPrice, "Định mức tối thiểu": minStock });
    if (missing.length > 0) {
      showToast(`Vui lòng nhập: ${missing.join(", ")}.`, "warning");
      return;
    }
    const cat = categories.find((c) => c.id === categoryId);
    const aut = authors.find((a) => a.id === authorId);
    const pub = publishers.find((p) => p.id === publisherId);

    setSaving(true);
    try {
      await inventoryService.saveBook({
        id: editing?.id,
        sku,
        isbn,
        title,
        categoryId,
        categoryName: cat?.name ?? "Chưa phân loại",
        authorId,
        authorName: aut?.name ?? "Chưa rõ",
        publisherId,
        publisherName: pub?.name ?? "Chưa rõ",
        publishYear: Number(publishYear),
        importPrice: Number(importPrice),
        sellPrice: Number(sellPrice),
        stock, // API thật bỏ qua trường này
        minStock: Number(minStock),
        shelfLocation,
        status: stock === 0 && status === "ACTIVE" ? "OUT_OF_STOCK" : status,
        description,
      });

      await loadAll();
      setFormOpen(false);
      showToast(editing ? "Đã cập nhật thông tin sách" : "Đã thêm đầu sách mới vào hệ thống");
    } catch (err) {
      // Lỗi từ backend: trùng mã/ISBN, dữ liệu sai, không có quyền…
      showToast(err instanceof Error ? err.message : "Không lưu được thông tin sách.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (book: Book) => {
    if (!window.confirm(`Xác nhận xóa đầu sách "${book.title}"?`)) return;
    try {
      // Sách đã có giao dịch / còn tồn: backend chuyển "Ngừng kinh doanh" thay vì xóa.
      const message = await inventoryService.deleteBook(book.id);
      await loadAll();
      showToast(message ?? "Đã xóa đầu sách", "info");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không xóa được đầu sách.", "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="Quản lý danh mục đầu sách"
        subtitle="Tra cứu, xem chi tiết, thêm mới và cập nhật giá bán, kệ trưng bày của toàn bộ đầu sách"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
          >
            <Plus className="h-4 w-4" />
            Thêm đầu sách mới
          </button>
        }
      />

      {/* Search & Filters */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#E6E8E5] bg-white p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên sách, mã SP, ISBN hoặc tác giả..."
            className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] py-2 pl-10 pr-4 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2 text-sm text-zinc-700"
        >
          <option value="ALL">Tất cả thể loại</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={pubFilter}
          onChange={(e) => setPubFilter(e.target.value)}
          className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2 text-sm text-zinc-700"
        >
          <option value="ALL">Tất cả NXB</option>
          {publishers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Books Table */}
      <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã / ISBN</th>
                <th className="px-5 py-3.5">Tên sách &amp; Tác giả</th>
                <th className="px-5 py-3.5">Thể loại / NXB</th>
                <th className="px-5 py-3.5 text-right">Giá nhập</th>
                <th className="px-5 py-3.5 text-right">Giá bán</th>
                <th className="px-5 py-3.5 text-center">Tồn kho</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filtered.map((b) => (
                <tr key={b.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5">
                    <div className="font-mono text-xs font-bold text-[#2D6A4F]">{b.sku}</div>
                    <div className="font-mono text-[11px] text-zinc-400">{b.isbn}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-zinc-900">{b.title}</div>
                    <div className="text-xs text-zinc-500">
                      {b.authorName} • {b.shelfLocation}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    <div className="font-medium text-zinc-700">{b.categoryName}</div>
                    <div className="text-zinc-400">
                      {b.publisherName} ({b.publishYear})
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right text-zinc-600">
                    {formatCurrency(b.importPrice)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-zinc-900">
                    {formatCurrency(b.sellPrice)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge
                      variant={
                        b.stock === 0
                          ? "crimson"
                          : b.stock <= b.minStock
                            ? "amber"
                            : "sage"
                      }
                    >
                      {b.stock === 0 ? "Hết hàng" : `${b.stock} cuốn`}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailBook(b)}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                        title="Xem chi tiết"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(b)}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                        title="Sửa"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-500 hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
                        title="Xóa"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Book Detail Drawer */}
      <Drawer
        open={Boolean(detailBook)}
        onClose={() => setDetailBook(null)}
        title={detailBook?.title ?? ""}
        subtitle={`${detailBook?.sku ?? ""} • ISBN: ${detailBook?.isbn ?? ""}`}
      >
        {detailBook && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#F7F8F6] p-4 text-xs">
              <div>
                <span className="text-zinc-400">Tác giả:</span>
                <div className="mt-0.5 font-semibold text-zinc-900">{detailBook.authorName}</div>
              </div>
              <div>
                <span className="text-zinc-400">Nhà xuất bản:</span>
                <div className="mt-0.5 font-semibold text-zinc-900">
                  {detailBook.publisherName} ({detailBook.publishYear})
                </div>
              </div>
              <div>
                <span className="text-zinc-400">Thể loại:</span>
                <div className="mt-0.5 font-semibold text-zinc-900">{detailBook.categoryName}</div>
              </div>
              <div>
                <span className="text-zinc-400">Vị trí kệ trưng bày:</span>
                <div className="mt-0.5 font-semibold text-zinc-900">{detailBook.shelfLocation}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[#E6E8E5] p-3 text-xs">
                <div className="text-zinc-400">Giá nhập</div>
                <div className="mt-1 text-sm font-bold text-zinc-800">
                  {formatCurrency(detailBook.importPrice)}
                </div>
              </div>
              <div className="rounded-xl border border-[#E6E8E5] p-3 text-xs">
                <div className="text-zinc-400">Giá bán lẻ</div>
                <div className="mt-1 text-sm font-bold text-[#2D6A4F]">
                  {formatCurrency(detailBook.sellPrice)}
                </div>
              </div>
              <div className="rounded-xl border border-[#E6E8E5] p-3 text-xs">
                <div className="text-zinc-400">Tồn hiện tại</div>
                <div className="mt-1 text-sm font-bold text-zinc-900">
                  {detailBook.stock} (Min: {detailBook.minStock})
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E6E8E5] p-4 text-xs">
              <div className="font-semibold text-zinc-700">Mô tả nội dung</div>
              <p className="mt-1.5 leading-relaxed text-zinc-600">
                {detailBook.description || "Chưa có mô tả chi tiết."}
              </p>
            </div>
          </div>
        )}
      </Drawer>

      {/* Add / Edit Book Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Chỉnh sửa sách ${editing.sku}` : "Thêm đầu sách mới"}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Mã sách (SKU) *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={!!editing}
                title={editing ? "Mã sách không đổi sau khi tạo" : undefined}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-600">Mã ISBN *</label>
              <input
                type="text"
                required
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600">Tên đầu sách *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Thể loại</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Tác giả</label>
              <select
                value={authorId}
                onChange={(e) => setAuthorId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              >
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Nhà xuất bản</label>
              <select
                value={publisherId}
                onChange={(e) => setPublisherId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              >
                {publishers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Giá nhập (VNĐ)</label>
              <input
                type="number"
                min={0}
                value={importPrice}
                onChange={(e) => setImportPrice(toNumberInput(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Giá bán (VNĐ)</label>
              <input
                type="number"
                min={0}
                value={sellPrice}
                onChange={(e) => setSellPrice(toNumberInput(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Tồn kho</label>
              <input
                type="number"
                min={0}
                value={stockEditable ? stock : (editing?.stock ?? 0)}
                onChange={(e) => setStock(Number(e.target.value))}
                disabled={!stockEditable}
                title={stockEditable ? undefined : "Tồn kho chỉ thay đổi qua phiếu nhập, bán hàng, đổi trả, kiểm kê"}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Định mức tối thiểu</label>
              <input
                type="number"
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(toNumberInput(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Năm xuất bản</label>
              <input
                type="number"
                value={publishYear}
                onChange={(e) => setPublishYear(toNumberInput(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Vị trí kệ</label>
              <input
                type="text"
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Trạng thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as BookStatus)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
              >
                <option value="ACTIVE">Đang kinh doanh</option>
                <option value="OUT_OF_STOCK">Tạm hết hàng</option>
                <option value="DISCONTINUED">Ngừng kinh doanh</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600">Mô tả tóm tắt</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3 py-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D] disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu đầu sách"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
