"use client";

import React, { useEffect, useState } from "react";
import {
  DatabaseBackup,
  Download,
  KeyRound,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Unlock,
  Upload,
} from "lucide-react";
import { Badge, Modal, PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/config/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { downloadJson } from "@/lib/export";
import { formatDateTime } from "@/lib/format";
import { adminService } from "@/services";
import type { BackupRecord, RolePermissionItem, SystemAccount, UserRole } from "@/types";

export default function SystemAdminPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<"ACCOUNTS" | "RBAC" | "BACKUP">("ACCOUNTS");
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [permissions, setPermissions] = useState<RolePermissionItem[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);

  // Create/Edit Account Modal
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<SystemAccount | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");

  // Reset Password Modal
  const [resetTarget, setResetTarget] = useState<SystemAccount | null>(null);
  const [tempPassword, setTempPassword] = useState("MocBooks@2026");

  // Backup note
  const [backupNote, setBackupNote] = useState("");

  const loadAll = async () => {
    const [acc, perm, bkp] = await Promise.all([
      adminService.getAccounts(),
      adminService.getPermissions(),
      adminService.getBackups(),
    ]);
    setAccounts(acc);
    setPermissions(perm);
    setBackups(bkp);
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadAll());
  }, []);

  const openCreateAccount = () => {
    setEditingAcc(null);
    setUsername("");
    setFullName("");
    setEmail("");
    setRole("SALES");
    setAccModalOpen(true);
  };

  const openEditAccount = (acc: SystemAccount) => {
    setEditingAcc(acc);
    setUsername(acc.username);
    setFullName(acc.fullName);
    setEmail(acc.email);
    setRole(acc.role);
    setAccModalOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    await adminService.saveAccount({
      id: editingAcc?.id,
      username,
      employeeId: editingAcc?.employeeId ?? `EMP-${Date.now()}`,
      fullName,
      email,
      role,
      status: editingAcc?.status ?? "ACTIVE",
    });
    await loadAll();
    setAccModalOpen(false);
    showToast(editingAcc ? "Đã cập nhật tài khoản" : "Đã cấp tài khoản đăng nhập mới");
  };

  const togglePermission = (
    moduleKey: string,
    roleKey: UserRole,
    field: keyof RolePermissionItem["permissions"]["MANAGER"],
  ) => {
    setPermissions((prev) =>
      prev.map((item) => {
        if (item.moduleKey !== moduleKey) return item;
        return {
          ...item,
          permissions: {
            ...item.permissions,
            [roleKey]: {
              ...item.permissions[roleKey],
              [field]: !item.permissions[roleKey][field],
            },
          },
        };
      }),
    );
  };

  const handleSavePermissions = async () => {
    await adminService.savePermissions(permissions);
    showToast("Đã lưu cấu hình phân quyền người dùng!");
  };

  const handleCreateBackup = async () => {
    const { record, snapshot } = await adminService.createBackup(
      user?.fullName ?? "Quản trị viên",
      backupNote,
    );
    downloadJson(record.fileName, snapshot);
    setBackupNote("");
    await loadAll();
    showToast(`Đã tạo bản sao lưu ${record.fileName} và tải về máy!`);
  };

  const handleRestoreFromFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        await adminService.restoreBackup(parsed);
        await loadAll();
        showToast(`Đã phục hồi dữ liệu từ tệp ${file.name} thành công!`);
      } catch {
        showToast("Tệp sao lưu không đúng định dạng JSON hợp lệ.", "error");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <PageHeader
        title="Quản lý hệ thống &amp; Bảo mật"
        subtitle="Quản trị tài khoản đăng nhập, ma trận phân quyền người dùng và sao lưu - phục hồi dữ liệu"
        actions={
          tab === "ACCOUNTS" ? (
            <button
              type="button"
              onClick={openCreateAccount}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              <Plus className="h-4 w-4" />
              Thêm tài khoản
            </button>
          ) : tab === "RBAC" ? (
            <button
              type="button"
              onClick={handleSavePermissions}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D]"
            >
              <Save className="h-4 w-4" />
              Lưu phân quyền
            </button>
          ) : null
        }
      />

      {/* Tabs */}
      <div className="mb-6 inline-flex flex-wrap rounded-xl border border-[#E6E8E5] bg-white p-1">
        <button
          type="button"
          onClick={() => setTab("ACCOUNTS")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold ${
            tab === "ACCOUNTS" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
          }`}
        >
          Tài khoản người dùng ({accounts.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("RBAC")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold ${
            tab === "RBAC" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
          }`}
        >
          Phân quyền theo vai trò
        </button>
        <button
          type="button"
          onClick={() => setTab("BACKUP")}
          className={`rounded-lg px-4 py-2 text-xs font-semibold ${
            tab === "BACKUP" ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
          }`}
        >
          Sao lưu &amp; Phục hồi dữ liệu
        </button>
      </div>

      {/* Tab 1: Accounts */}
      {tab === "ACCOUNTS" && (
        <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3.5">Tên đăng nhập</th>
                <th className="px-5 py-3.5">Nhân viên sở hữu</th>
                <th className="px-5 py-3.5">Vai trò</th>
                <th className="px-5 py-3.5">Đăng nhập gần nhất</th>
                <th className="px-5 py-3.5 text-center">Trạng thái</th>
                <th className="px-5 py-3.5 text-right">Quản trị tài khoản</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E5]">
              {accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-[#F7F8F6]/70">
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                    {acc.username}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-zinc-900">{acc.fullName}</div>
                    <div className="text-xs text-zinc-500">{acc.email}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant="blue">{ROLE_LABELS[acc.role]}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500">
                    {formatDateTime(acc.lastLogin)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {acc.status === "ACTIVE" ? (
                      <Badge variant="sage">Hoạt động</Badge>
                    ) : (
                      <Badge variant="crimson">Đã khóa</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditAccount(acc)}
                        className="rounded-lg border border-[#E6E8E5] px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetTarget(acc)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E6E8E5] px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Đặt lại MK
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await adminService.toggleAccountStatus(acc.id);
                          await loadAll();
                          showToast(
                            acc.status === "ACTIVE"
                              ? `Đã khóa tài khoản ${acc.username}`
                              : `Đã mở khóa tài khoản ${acc.username}`,
                            "info",
                          );
                        }}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                          acc.status === "ACTIVE"
                            ? "border-[#FECACA] text-[#B91C1C] hover:bg-[#FEE2E2]"
                            : "border-[#CBE4D7] text-[#2D6A4F] hover:bg-[#E8F3EE]"
                        }`}
                      >
                        {acc.status === "ACTIVE" ? (
                          <>
                            <Lock className="h-3.5 w-3.5" /> Khóa
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5" /> Mở khóa
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: RBAC Matrix */}
      {tab === "RBAC" && (
        <div className="space-y-4">
          {(["SALES", "WAREHOUSE", "MANAGER"] as UserRole[]).map((roleKey) => (
            <div
              key={roleKey}
              className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white"
            >
              <div className="border-b border-[#E6E8E5] bg-[#F7F8F6] px-5 py-3 font-semibold text-sm text-zinc-900">
                Vai trò: <span className="text-[#2D6A4F]">{ROLE_LABELS[roleKey]}</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E6E8E5] text-zinc-500">
                  <tr>
                    <th className="px-5 py-2.5">Phân hệ chức năng</th>
                    <th className="px-3 py-2.5 text-center">Xem</th>
                    <th className="px-3 py-2.5 text-center">Thêm mới</th>
                    <th className="px-3 py-2.5 text-center">Chỉnh sửa</th>
                    <th className="px-3 py-2.5 text-center">Xóa</th>
                    <th className="px-3 py-2.5 text-center">Xuất BC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E8E5]">
                  {permissions.map((perm) => {
                    const p = perm.permissions[roleKey];
                    return (
                      <tr key={perm.moduleKey}>
                        <td className="px-5 py-2.5 font-medium text-zinc-800">
                          {perm.moduleName}
                        </td>
                        {(["view", "create", "edit", "delete", "export"] as const).map((field) => (
                          <td key={field} className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={p[field]}
                              onChange={() => togglePermission(perm.moduleKey, roleKey, field)}
                              className="h-4 w-4 accent-[#2D6A4F] cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Backup & Restore */}
      {tab === "BACKUP" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#E6E8E5] bg-white p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F3EE] text-[#2D6A4F]">
                  <DatabaseBackup className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">
                    Sao lưu dữ liệu (Backup)
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Xuất toàn bộ dữ liệu hiện tại thành tệp an toàn và lưu vào lịch sử hệ thống
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={backupNote}
                onChange={(e) => setBackupNote(e.target.value)}
                placeholder="Ghi chú bản sao lưu (VD: Trước khi cập nhật giá sách quý 4)..."
                className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
              />

              <button
                type="button"
                onClick={handleCreateBackup}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#23533D]"
              >
                <Download className="h-4 w-4" />
                Tạo bản sao lưu &amp; Tải xuống ngay
              </button>
            </div>

            <div className="rounded-2xl border border-[#E6E8E5] bg-white p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FEF3C7] text-[#B45309]">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">
                    Phục hồi dữ liệu từ tệp (Restore)
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Khôi phục trạng thái cửa hàng từ tệp JSON sao lưu đã tải xuống trước đó
                  </p>
                </div>
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#2D6A4F] bg-[#F7F8F6] py-5 text-xs font-medium text-[#2D6A4F] hover:bg-[#E8F3EE]/50">
                <span>Nhấn để chọn tệp sao lưu (.json) từ máy tính</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFromFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
            <div className="border-b border-[#E6E8E5] px-5 py-3.5 font-semibold text-sm text-zinc-900">
              Lịch sử các bản sao lưu ({backups.length})
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Tên tệp sao lưu</th>
                  <th className="px-5 py-3">Thời gian</th>
                  <th className="px-5 py-3">Người thực hiện</th>
                  <th className="px-5 py-3">Dung lượng</th>
                  <th className="px-5 py-3 text-right">Khôi phục</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8E5]">
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td className="px-5 py-3">
                      <div className="font-mono text-xs font-semibold text-zinc-900">
                        {b.fileName}
                      </div>
                      <div className="text-xs text-zinc-400">{b.note}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-600">
                      {formatDateTime(b.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-600">{b.createdBy}</td>
                    <td className="px-5 py-3 text-xs font-mono">{b.sizeLabel}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Xác nhận phục hồi dữ liệu hệ thống về bản sao lưu "${b.fileName}"?`,
                            )
                          )
                            return;
                          await adminService.restoreBackup(b.id);
                          await loadAll();
                          showToast(`Đã phục hồi dữ liệu từ bản sao lưu ${b.fileName}!`);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E6E8E5] px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Phục hồi bản này
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Account Create / Edit Modal */}
      <Modal
        open={accModalOpen}
        onClose={() => setAccModalOpen(false)}
        title={editingAcc ? "Cập nhật tài khoản hệ thống" : "Tạo tài khoản người dùng mới"}
      >
        <form onSubmit={handleSaveAccount} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Tên đăng nhập *</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Họ và tên nhân viên *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
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
            <label className="block text-xs font-semibold text-zinc-600">Phân quyền vai trò</label>
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
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAccModalOpen(false)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D]"
            >
              Lưu tài khoản
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Đặt lại mật khẩu cho ${resetTarget?.username ?? ""}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-zinc-500">
            Cấp mật khẩu tạm thời mới cho nhân viên <strong>{resetTarget?.fullName}</strong>. Nhân viên sẽ đổi lại mật khẩu ở lần đăng nhập kế tiếp.
          </p>
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Mật khẩu tạm thời mới</label>
            <input
              type="text"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2 font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setResetTarget(null)}
              className="rounded-xl border border-[#E6E8E5] px-4 py-2 text-zinc-600"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!resetTarget) return;
                await adminService.resetAccountPassword(resetTarget.id, tempPassword);
                setResetTarget(null);
                showToast(`Đã đặt lại mật khẩu cho tài khoản ${resetTarget.username}!`);
              }}
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D]"
            >
              Xác nhận đặt lại
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
