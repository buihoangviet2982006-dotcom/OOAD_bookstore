"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Edit2, Eye, Plus, Search, Trash2 } from "lucide-react";
import { Badge, Drawer, Modal, PageHeader } from "@/components/ui";
import { BRAND_CONFIG } from "@/config/brand";
import { ROLE_LABELS } from "@/config/navigation";
import { useToast } from "@/context/ToastContext";
import { formatCurrency, formatDate } from "@/lib/format";
import { adminService } from "@/services";
import type { Employee, UserRole } from "@/types";

export default function EmployeesPage() {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");
  const [positionTitle, setPositionTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [branchName, setBranchName] = useState<string>(BRAND_CONFIG.branches[0].name);
  const [joinDate, setJoinDate] = useState("2026-11-26");
  const [baseSalary, setBaseSalary] = useState(9000000);
  const [status, setStatus] = useState<Employee["status"]>("WORKING");
  const [address, setAddress] = useState("");

  const loadAll = async () => {
    const list = await adminService.getEmployees();
    setEmployees(list);
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadAll());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (roleFilter !== "ALL" && e.role !== roleFilter) return false;
      if (!q) return true;
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.code.toLowerCase().includes(q) ||
        e.phone.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q)
      );
    });
  }, [employees, query, roleFilter]);

  const openCreate = () => {
    setEditing(null);
    setFullName("");
    setRole("SALES");
    setPositionTitle("Nhân viên bán hàng");
    setPhone("");
    setEmail("");
    setBranchName(BRAND_CONFIG.branches[0].name);
    setJoinDate("2026-11-26");
    setBaseSalary(9000000);
    setStatus("WORKING");
    setAddress("");
    setFormOpen(true);
  };

  const openEdit = (e: Employee) => {
    setEditing(e);
    setFullName(e.fullName);
    setRole(e.role);
    setPositionTitle(e.positionTitle);
    setPhone(e.phone);
    setEmail(e.email);
    setBranchName(e.branchName);
    setJoinDate(e.joinDate);
    setBaseSalary(e.baseSalary);
    setStatus(e.status);
    setAddress(e.address);
    setFormOpen(true);
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    await adminService.saveEmployee({
      id: editing?.id,
      fullName,
      role,
      positionTitle,
      phone,
      email,
      branchName,
      joinDate,
      baseSalary,
      status,
      address,
    });
    await loadAll();
    setFormOpen(false);
    showToast(editing ? "Đã cập nhật hồ sơ nhân viên" : "Đã thêm nhân viên mới");
  };

  return (
    <div>
      <PageHeader
        title="Quản lý nhân viên"
        subtitle="Tra cứu, xem chi tiết hồ sơ nhân sự, phân công bộ phận và cập nhật thông tin làm việc"
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
          >
            <Plus className="h-4 w-4" />
            Thêm nhân viên
          </button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#E6E8E5] bg-white p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo họ tên, mã NV, số điện thoại hoặc email..."
            className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] py-2 pl-10 pr-4 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2 text-sm text-zinc-700"
        >
          <option value="ALL">Tất cả vai trò</option>
          <option value="MANAGER">Quản lý cửa hàng</option>
          <option value="SALES">Nhân viên bán hàng</option>
          <option value="WAREHOUSE">Nhân viên kho</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-3.5">Mã NV</th>
              <th className="px-5 py-3.5">Họ và tên</th>
              <th className="px-5 py-3.5">Chức danh / Vai trò</th>
              <th className="px-5 py-3.5">Chi nhánh</th>
              <th className="px-5 py-3.5 text-right">Lương cơ bản</th>
              <th className="px-5 py-3.5 text-center">Trạng thái</th>
              <th className="px-5 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6E8E5]">
            {filtered.map((emp) => (
              <tr key={emp.id} className="hover:bg-[#F7F8F6]/70">
                <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                  {emp.code}
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-semibold text-zinc-900">{emp.fullName}</div>
                  <div className="text-xs text-zinc-500">
                    {emp.phone} • {emp.email}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs">
                  <div className="font-medium text-zinc-800">{emp.positionTitle}</div>
                  <div className="text-zinc-400">{ROLE_LABELS[emp.role]}</div>
                </td>
                <td className="px-5 py-3.5 text-xs text-zinc-600">{emp.branchName}</td>
                <td className="px-5 py-3.5 text-right font-semibold text-zinc-900">
                  {formatCurrency(emp.baseSalary)}
                </td>
                <td className="px-5 py-3.5 text-center">
                  {emp.status === "WORKING" && <Badge variant="sage">Đang làm việc</Badge>}
                  {emp.status === "ON_LEAVE" && <Badge variant="amber">Nghỉ phép</Badge>}
                  {emp.status === "RESIGNED" && <Badge variant="crimson">Đã nghỉ việc</Badge>}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="inline-flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDetailEmp(emp)}
                      className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(emp)}
                      className="rounded-lg border border-[#E6E8E5] p-1.5 text-zinc-600 hover:bg-zinc-100"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Xóa hồ sơ nhân viên "${emp.fullName}"?`)) return;
                        await adminService.deleteEmployee(emp.id);
                        loadAll();
                        showToast("Đã xóa hồ sơ nhân viên", "info");
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

      {/* Employee Profile Drawer */}
      <Drawer
        open={Boolean(detailEmp)}
        onClose={() => setDetailEmp(null)}
        title={detailEmp?.fullName ?? ""}
        subtitle={`${detailEmp?.code ?? ""} • ${detailEmp?.positionTitle ?? ""}`}
      >
        {detailEmp && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl bg-[#F7F8F6] p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Vai trò phân hệ:</span>
                <span className="font-semibold text-zinc-900">{ROLE_LABELS[detailEmp.role]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Chi nhánh làm việc:</span>
                <span className="font-semibold text-zinc-900">{detailEmp.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Ngày vào làm:</span>
                <span className="font-semibold text-zinc-900">
                  {formatDate(detailEmp.joinDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Mức lương cơ bản:</span>
                <span className="font-bold text-[#2D6A4F]">
                  {formatCurrency(detailEmp.baseSalary)}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-[#E6E8E5] p-4 space-y-1.5 text-zinc-600">
              <div>Điện thoại: <strong>{detailEmp.phone}</strong></div>
              <div>Email công việc: <strong>{detailEmp.email}</strong></div>
              <div>Địa chỉ thường trú: {detailEmp.address}</div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Add / Edit Employee Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Cập nhật nhân sự ${editing.code}` : "Thêm hồ sơ nhân viên mới"}
      >
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Họ và tên *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Vai trò hệ thống</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              >
                <option value="SALES">Nhân viên bán hàng</option>
                <option value="WAREHOUSE">Nhân viên kho</option>
                <option value="MANAGER">Quản lý cửa hàng</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Chức danh công việc *</label>
              <input
                type="text"
                required
                value={positionTitle}
                onChange={(e) => setPositionTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Số điện thoại *</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Lương cơ bản (VNĐ)</label>
              <input
                type="number"
                value={baseSalary}
                onChange={(e) => setBaseSalary(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Ngày vào làm</label>
              <input
                type="date"
                value={joinDate}
                onChange={(e) => setJoinDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Trạng thái làm việc</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Employee["status"])}
                className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
              >
                <option value="WORKING">Đang làm việc</option>
                <option value="ON_LEAVE">Đang nghỉ phép</option>
                <option value="RESIGNED">Đã nghỉ việc</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600">Địa chỉ</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
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
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D]"
            >
              Lưu hồ sơ
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
