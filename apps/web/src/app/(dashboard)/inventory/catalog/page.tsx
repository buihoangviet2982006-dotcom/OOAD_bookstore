"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit2, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Modal, PageHeader } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { inventoryService } from "@/services";
import type { Author, Category, Publisher } from "@/types";

type CatalogTab = "CATEGORY" | "AUTHOR" | "PUBLISHER";

export default function CatalogPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<CatalogTab>("CATEGORY");
  const [query, setQuery] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [fCode, setFCode] = useState("");
  const [fName, setFName] = useState("");
  const [fDescOrBio, setFDescOrBio] = useState("");
  const [fNationOrPhone, setFNationOrPhone] = useState("");
  const [fEmail, setFEmail] = useState("");
  const [fAddress, setFAddress] = useState("");

  const loadAll = async () => {
    const [c, a, p] = await Promise.all([
      inventoryService.getCategories(),
      inventoryService.getAuthors(),
      inventoryService.getPublishers(),
    ]);
    setCategories(c);
    setAuthors(a);
    setPublishers(p);
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadAll());
  }, []);

  const q = query.trim().toLowerCase();

  const filteredCategories = useMemo(
    () =>
      categories.filter(
        (c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
      ),
    [categories, q],
  );

  const filteredAuthors = useMemo(
    () =>
      authors.filter(
        (a) => !q || a.name.toLowerCase().includes(q) || a.nationality.toLowerCase().includes(q),
      ),
    [authors, q],
  );

  const filteredPublishers = useMemo(
    () =>
      publishers.filter(
        (p) => !q || p.name.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q),
      ),
    [publishers, q],
  );

  const openCreate = () => {
    setEditingId(undefined);
    setFCode("");
    setFName("");
    setFDescOrBio("");
    setFNationOrPhone("");
    setFEmail("");
    setFAddress("");
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "CATEGORY") {
      await inventoryService.saveCategory({
        id: editingId,
        code: fCode.toUpperCase() || "DM",
        name: fName,
        description: fDescOrBio,
      });
    } else if (tab === "AUTHOR") {
      await inventoryService.saveAuthor({
        id: editingId,
        name: fName,
        nationality: fNationOrPhone || "Việt Nam",
        bio: fDescOrBio,
      });
    } else {
      await inventoryService.savePublisher({
        id: editingId,
        name: fName,
        phone: fNationOrPhone,
        email: fEmail,
        address: fAddress,
      });
    }
    await loadAll();
    setModalOpen(false);
    showToast("Đã lưu thông tin danh mục thành công!");
  };

  return (
    <div>
      <PageHeader
        title="Quản lý danh mục sách"
        subtitle="Tìm kiếm, thêm mới, chỉnh sửa hoặc xóa Thể loại, Tác giả và Nhà xuất bản (NXB)"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
          >
            <Plus className="h-4 w-4" />
            {tab === "CATEGORY"
              ? "Thêm thể loại"
              : tab === "AUTHOR"
                ? "Thêm tác giả"
                : "Thêm NXB"}
          </button>
        }
      />

      {/* Tabs + Search */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-[#E6E8E5] bg-white p-1 self-start">
          {(
            [
              ["CATEGORY", `Thể loại (${categories.length})`],
              ["AUTHOR", `Tác giả (${authors.length})`],
              ["PUBLISHER", `Nhà xuất bản (${publishers.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                tab === key ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm nhanh trong danh mục..."
            className="w-full rounded-xl border border-[#E6E8E5] bg-white py-2 pl-10 pr-4 text-sm focus:border-[#2D6A4F] focus:outline-none"
          />
        </div>
      </div>

      {/* Category Table */}
      {tab === "CATEGORY" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Mã</th>
                <th className="px-5 py-3.5">Tên thể loại</th>
                <th className="px-5 py-3.5">Mô tả</th>
                <th className="px-5 py-3.5 text-center">Số đầu sách</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filteredCategories.map((c) => (
                <tr key={c.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                    {c.code}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{c.name}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">{c.description}</td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge variant="sage">{c.bookCount ?? 0} sách</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(c.id);
                          setFCode(c.code);
                          setFName(c.name);
                          setFDescOrBio(c.description);
                          setModalOpen(true);
                        }}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Xóa thể loại "${c.name}"?`)) return;
                          await inventoryService.deleteCategory(c.id);
                          loadAll();
                          showToast("Đã xóa thể loại", "info");
                        }}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-500 hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
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
      )}

      {/* Author Table */}
      {tab === "AUTHOR" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Tên tác giả</th>
                <th className="px-5 py-3.5">Quốc tịch</th>
                <th className="px-5 py-3.5">Tiểu sử tóm tắt</th>
                <th className="px-5 py-3.5 text-center">Số đầu sách</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filteredAuthors.map((a) => (
                <tr key={a.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{a.name}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">{a.nationality}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">{a.bio}</td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge variant="sage">{a.bookCount ?? 0} sách</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(a.id);
                          setFName(a.name);
                          setFNationOrPhone(a.nationality);
                          setFDescOrBio(a.bio);
                          setModalOpen(true);
                        }}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Xóa tác giả "${a.name}"?`)) return;
                          await inventoryService.deleteAuthor(a.id);
                          loadAll();
                          showToast("Đã xóa tác giả", "info");
                        }}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-500 hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
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
      )}

      {/* Publisher Table */}
      {tab === "PUBLISHER" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Tên Nhà xuất bản</th>
                <th className="px-5 py-3.5">Liên hệ</th>
                <th className="px-5 py-3.5">Địa chỉ</th>
                <th className="px-5 py-3.5 text-center">Số đầu sách</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {filteredPublishers.map((p) => (
                <tr key={p.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5 font-semibold text-zinc-900">{p.name}</td>
                  <td className="px-5 py-3.5 text-xs text-zinc-600">
                    <div>{p.phone}</div>
                    <div className="text-zinc-400">{p.email}</div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">{p.address}</td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge variant="sage">{p.bookCount ?? 0} sách</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(p.id);
                          setFName(p.name);
                          setFNationOrPhone(p.phone);
                          setFEmail(p.email);
                          setFAddress(p.address);
                          setModalOpen(true);
                        }}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Xóa NXB "${p.name}"?`)) return;
                          await inventoryService.deletePublisher(p.id);
                          loadAll();
                          showToast("Đã xóa Nhà xuất bản", "info");
                        }}
                        className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-500 hover:bg-[#FEE2E2] hover:text-[#B91C1C]"
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
      )}

      {/* Unified Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          tab === "CATEGORY"
            ? editingId
              ? "Cập nhật thể loại"
              : "Thêm thể loại mới"
            : tab === "AUTHOR"
              ? editingId
                ? "Cập nhật tác giả"
                : "Thêm tác giả mới"
              : editingId
                ? "Cập nhật Nhà xuất bản"
                : "Thêm Nhà xuất bản mới"
        }
      >
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          {tab === "CATEGORY" && (
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Mã thể loại *</label>
              <input
                type="text"
                required
                value={fCode}
                onChange={(e) => setFCode(e.target.value)}
                placeholder="VD: VH, KT, TN"
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2 uppercase"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-600">
              {tab === "CATEGORY"
                ? "Tên thể loại *"
                : tab === "AUTHOR"
                  ? "Họ tên tác giả *"
                  : "Tên Nhà xuất bản *"}
            </label>
            <input
              type="text"
              required
              value={fName}
              onChange={(e) => setFName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            />
          </div>

          {tab !== "CATEGORY" && (
            <div>
              <label className="block text-xs font-semibold text-zinc-600">
                {tab === "AUTHOR" ? "Quốc tịch" : "Số điện thoại"}
              </label>
              <input
                type="text"
                value={fNationOrPhone}
                onChange={(e) => setFNationOrPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
          )}

          {tab === "PUBLISHER" ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-zinc-600">Email</label>
                <input
                  type="email"
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-600">Địa chỉ trụ sở</label>
                <input
                  type="text"
                  value={fAddress}
                  onChange={(e) => setFAddress(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-zinc-600">
                {tab === "CATEGORY" ? "Mô tả thể loại" : "Tiểu sử / Ghi chú"}
              </label>
              <textarea
                rows={3}
                value={fDescOrBio}
                onChange={(e) => setFDescOrBio(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D]"
            >
              Lưu danh mục
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
