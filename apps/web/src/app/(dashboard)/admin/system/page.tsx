"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, DatabaseBackup, Download, KeyRound, Lock, Minus, Plus, Unlock, Upload } from "lucide-react";
import { Badge, Modal, PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/config/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { downloadJson } from "@/lib/export";
import { formatDateTime } from "@/lib/format";
import { adminService } from "@/services";
import type { BackupRecord, Employee, RolePermissionItem, SystemAccount, UserRole } from "@/types";

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
const INPUT = "mt-1 w-full rounded-xl border border-[#E6E8E5] px-3.5 py-2";

export default function SystemAdminPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<"ACCOUNTS" | "RBAC" | "BACKUP">("ACCOUNTS");
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [permissions, setPermissions] = useState<RolePermissionItem[]>([]);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [busy, setBusy] = useState(false);

  // Tạo / sửa tài khoản
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<SystemAccount | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("SALES");
  const [initialPassword, setInitialPassword] = useState("");

  // Đặt lại mật khẩu
  const [resetTarget, setResetTarget] = useState<SystemAccount | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [backupNote, setBackupNote] = useState("");

  const loadAll = async () => {
    try {
      const [acc, emp, perm, bkp] = await Promise.all([
        adminService.getAccounts(),
        adminService.getEmployees(),
        adminService.getPermissions(),
        adminService.getBackups(),
      ]);
      setAccounts(acc);
      setEmployees(emp);
      setPermissions(perm);
      setBackups(bkp);
    } catch (err) {
      showToast(errorMessage(err), "error");
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadAll());
    // Chỉ tải một lần khi mở trang; các thao tác tự gọi loadAll sau khi lưu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Nhân viên được cấp tài khoản: chưa có tài khoản và chưa thôi việc. */
  const employeesWithoutAccount = useMemo(() => {
    const owners = new Set(accounts.map((a) => a.employeeId));
    return employees.filter((e) => !owners.has(e.id) && e.status !== "RESIGNED");
  }, [accounts, employees]);

  const openCreateAccount = () => {
    const first = employeesWithoutAccount[0];
    setEditingAcc(null);
    setEmployeeId(first?.id ?? "");
    setUsername("");
    setEmail("");
    setRole(first?.role ?? "SALES");
    setInitialPassword("");
    setAccModalOpen(true);
  };

  const openEditAccount = (acc: SystemAccount) => {
    setEditingAcc(acc);
    setEmployeeId(acc.employeeId);
    setUsername(acc.username);
    setEmail(acc.email);
    setRole(acc.role);
    setAccModalOpen(true);
  };

  const run = async (action: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    try {
      const message = await action();
      await loadAll();
      showToast(message);
      return true;
    } catch (err) {
      showToast(errorMessage(err), "error");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(async () => {
      if (editingAcc) {
        await adminService.updateAccount(editingAcc.id, { username, email, role });
        return editingAcc.role !== role
          ? `Đã cập nhật ${username}. Vai trò thay đổi – tài khoản này cần đăng nhập lại.`
          : `Đã cập nhật tài khoản ${username}`;
      }
      await adminService.createAccount({
        employeeId,
        username,
        email: email.trim() || undefined,
        role,
        password: initialPassword,
      });
      return `Đã cấp tài khoản ${username.toLowerCase()}`;
    });
    if (ok) setAccModalOpen(false);
  };

  const handleToggleLock = (acc: SystemAccount) =>
    run(async () => {
      const locking = acc.status === "ACTIVE";
      await adminService.setAccountLocked(acc.id, locking);
      return locking
        ? `Đã khóa ${acc.username}; các phiên đăng nhập của tài khoản đã kết thúc.`
        : `Đã mở khóa ${acc.username}. Người dùng cần đăng nhập lại.`;
    });

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    const target = resetTarget;
    const ok = await run(() => adminService.resetAccountPassword(target.id, newPassword));
    if (ok) {
      setResetTarget(null);
      setNewPassword("");
    }
  };

  const handleCreateBackup = () =>
    run(async () => {
      const { record, snapshot } = await adminService.createBackup(backupNote.trim() || undefined);
      downloadJson(record.fileName, snapshot);
      setBackupNote("");
      return `Đã xuất ${record.fileName} và ghi vào lịch sử sao lưu.`;
    });

  const tabButton = (key: typeof tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-lg px-4 py-2 text-xs font-semibold ${
        tab === key ? "bg-[#E8F3EE] text-[#2D6A4F]" : "text-zinc-600"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <PageHeader
        title="Quản lý hệ thống &amp; Bảo mật"
        subtitle="Tài khoản đăng nhập, ma trận phân quyền (chỉ xem) và sao lưu dữ liệu dạng JSON"
        actions={
          tab === "ACCOUNTS" ? (
            <button
              type="button"
              onClick={openCreateAccount}
              disabled={employeesWithoutAccount.length === 0}
              title={employeesWithoutAccount.length === 0 ? "Mọi nhân viên đang làm việc đều đã có tài khoản" : undefined}
              className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#23533D] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Cấp tài khoản
            </button>
          ) : null
        }
      />

      <div className="mb-6 inline-flex flex-wrap rounded-xl border border-[#E6E8E5] bg-white p-1">
        {tabButton("ACCOUNTS", `Tài khoản người dùng (${accounts.length})`)}
        {tabButton("RBAC", "Phân quyền theo vai trò")}
        {tabButton("BACKUP", "Sao lưu dữ liệu")}
      </div>

      {/* Tab 1: Tài khoản */}
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
              {accounts.map((acc) => {
                const isSelf = acc.id === user?.id;
                const resigned = acc.employeeStatus === "RESIGNED";
                return (
                  <tr key={acc.id} className="hover:bg-[#F7F8F6]/70">
                    <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#2D6A4F]">
                      {acc.username}
                      {isSelf && <span className="ml-1 font-sans font-normal text-zinc-400">(bạn)</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-zinc-900">
                        {acc.fullName} <span className="text-xs font-normal text-zinc-400">{acc.employeeId}</span>
                      </div>
                      <div className="text-xs text-zinc-500">{acc.email}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="blue">{ROLE_LABELS[acc.role]}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-zinc-500">{formatDateTime(acc.lastLogin)}</td>
                    <td className="px-5 py-3.5 text-center">
                      {acc.status === "ACTIVE" ? (
                        <Badge variant="sage">Hoạt động</Badge>
                      ) : (
                        <Badge variant="crimson">Đã khóa</Badge>
                      )}
                      {resigned && <div className="mt-1 text-xs text-zinc-400">NV đã thôi việc</div>}
                      {!resigned && (acc.failedLoginCount ?? 0) > 0 && (
                        <div className="mt-1 text-xs text-zinc-400">Sai mật khẩu {acc.failedLoginCount} lần</div>
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
                          onClick={() => {
                            setNewPassword("");
                            setResetTarget(acc);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E6E8E5] px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Đặt lại MK
                        </button>
                        {!isSelf && !(resigned && acc.status === "LOCKED") && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleToggleLock(acc)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
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
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 2: Ma trận quyền – chỉ xem */}
      {tab === "RBAC" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-4 py-3 text-xs text-zinc-600">
            Phân quyền cố định theo 3 vai trò và được kiểm tra ở máy chủ. Bảng này chỉ để xem, không chỉnh sửa
            được. Thao tác đánh dấu “—” cho mọi vai trò là chức năng không có trong hệ thống (ví dụ sửa/xóa hóa đơn).
          </div>
          {(["SALES", "WAREHOUSE", "MANAGER"] as UserRole[]).map((roleKey) => (
            <div key={roleKey} className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
              <div className="border-b border-[#E6E8E5] bg-[#F7F8F6] px-5 py-3 text-sm font-semibold text-zinc-900">
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
                    <th className="px-5 py-2.5">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E8E5]">
                  {permissions.map((perm) => {
                    const p = perm.permissions[roleKey];
                    return (
                      <tr key={perm.moduleKey}>
                        <td className="px-5 py-2.5 font-medium text-zinc-800">{perm.moduleName}</td>
                        {(["view", "create", "edit", "delete"] as const).map((field) => (
                          <td key={field} className="px-3 py-2.5 text-center">
                            {p[field] ? (
                              <Check className="mx-auto h-4 w-4 text-[#2D6A4F]" aria-label="Được phép" />
                            ) : (
                              <Minus className="mx-auto h-4 w-4 text-zinc-300" aria-label="Không" />
                            )}
                          </td>
                        ))}
                        <td className="px-5 py-2.5 text-zinc-500">{p.view ? (perm.note ?? "") : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Sao lưu (xuất JSON) */}
      {tab === "BACKUP" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-[#E6E8E5] bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F3EE] text-[#2D6A4F]">
                  <DatabaseBackup className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900">Xuất dữ liệu (JSON)</h3>
                  <p className="text-xs text-zinc-500">
                    Xuất dữ liệu nghiệp vụ hiện tại (sách, khách hàng, nhân viên, hóa đơn, đổi/trả, nhập hàng,
                    kiểm kê…) và ghi vào lịch sử. Không chứa mật khẩu, mã OTP hay phiên đăng nhập.
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={backupNote}
                onChange={(e) => setBackupNote(e.target.value)}
                placeholder="Ghi chú (VD: Trước khi cập nhật giá sách quý 4)..."
                className="w-full rounded-xl border border-[#E6E8E5] bg-[#F7F8F6] px-3.5 py-2 text-sm focus:border-[#2D6A4F] focus:bg-white focus:outline-none"
              />

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCreateBackup()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#23533D] disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Xuất JSON &amp; tải xuống
              </button>
            </div>

            <div className="space-y-4 rounded-2xl border border-dashed border-[#E6E8E5] bg-[#F7F8F6] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-200 text-zinc-500">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-500">Phục hồi dữ liệu – chưa hỗ trợ</h3>
                  <p className="text-xs text-zinc-500">
                    Phục hồi nằm ngoài phạm vi bản demo. Tệp JSON dùng để lưu trữ và đối chiếu, không nạp ngược
                    vào hệ thống. Khôi phục cơ sở dữ liệu cần thực hiện bởi quản trị kỹ thuật.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-[#E6E8E5] bg-white px-4 py-2.5 text-sm font-medium text-zinc-400"
              >
                <Upload className="h-4 w-4" />
                Phục hồi từ tệp (không khả dụng)
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E6E8E5] bg-white">
            <div className="border-b border-[#E6E8E5] px-5 py-3.5 text-sm font-semibold text-zinc-900">
              Lịch sử xuất dữ liệu ({backups.length})
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E6E8E5] bg-[#F7F8F6] text-xs font-semibold uppercase text-zinc-500">
                <tr>
                  <th className="px-5 py-3">Tên tệp</th>
                  <th className="px-5 py-3">Thời gian</th>
                  <th className="px-5 py-3">Người thực hiện</th>
                  <th className="px-5 py-3">Dung lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8E5]">
                {backups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-xs text-zinc-400">
                      Chưa có lần xuất dữ liệu nào.
                    </td>
                  </tr>
                )}
                {backups.map((b) => (
                  <tr key={b.id}>
                    <td className="px-5 py-3">
                      <div className="font-mono text-xs font-semibold text-zinc-900">{b.fileName}</div>
                      <div className="text-xs text-zinc-400">{b.note}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-600">{formatDateTime(b.createdAt)}</td>
                    <td className="px-5 py-3 text-xs text-zinc-600">{b.createdBy}</td>
                    <td className="px-5 py-3 font-mono text-xs">{b.sizeLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cấp / sửa tài khoản */}
      <Modal
        open={accModalOpen}
        onClose={() => setAccModalOpen(false)}
        title={editingAcc ? `Cập nhật tài khoản ${editingAcc.username}` : "Cấp tài khoản cho nhân viên"}
      >
        <form onSubmit={handleSaveAccount} className="space-y-4 text-sm">
          {editingAcc ? (
            <div className="rounded-xl bg-[#F7F8F6] px-3.5 py-2 text-xs text-zinc-600">
              Nhân viên: <strong>{editingAcc.fullName}</strong> ({editingAcc.employeeId}). Họ tên, SĐT sửa ở trang
              Nhân viên.
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Nhân viên *</label>
              <select
                required
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  const emp = employees.find((x) => x.id === e.target.value);
                  if (emp) setRole(emp.role);
                }}
                className={INPUT}
              >
                {employeesWithoutAccount.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.code} – {emp.fullName} ({ROLE_LABELS[emp.role]})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-400">Chỉ hiện nhân viên chưa có tài khoản và chưa thôi việc.</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Tên đăng nhập *</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="vd: thao.bh"
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600">
              Email khôi phục {editingAcc ? "*" : "(bỏ trống = email nhân viên)"}
            </label>
            <input
              type="email"
              required={Boolean(editingAcc)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={employees.find((x) => x.id === employeeId)?.email}
              className={INPUT}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Vai trò</label>
            <select
              value={role}
              disabled={editingAcc?.id === user?.id}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className={INPUT}
            >
              <option value="SALES">Nhân viên bán hàng</option>
              <option value="WAREHOUSE">Nhân viên kho</option>
              <option value="MANAGER">Quản lý cửa hàng</option>
            </select>
            <p className="mt-1 text-xs text-zinc-400">
              Bộ phận của nhân viên được cập nhật theo vai trò.
              {editingAcc && " Đổi vai trò sẽ kết thúc các phiên đăng nhập hiện có của tài khoản này."}
            </p>
          </div>
          {!editingAcc && (
            <div>
              <label className="block text-xs font-semibold text-zinc-600">Mật khẩu khởi tạo * (tối thiểu 6 ký tự)</label>
              <input
                type="text"
                required
                minLength={6}
                value={initialPassword}
                onChange={(e) => setInitialPassword(e.target.value)}
                className={`${INPUT} font-mono`}
              />
            </div>
          )}
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
              disabled={busy || (!editingAcc && !employeeId)}
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D] disabled:opacity-50"
            >
              {busy ? "Đang lưu..." : "Lưu tài khoản"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Đặt lại mật khẩu */}
      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title={`Đặt lại mật khẩu cho ${resetTarget?.username ?? ""}`}
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-sm">
          <p className="text-xs text-zinc-500">
            Đặt mật khẩu mới cho <strong>{resetTarget?.fullName}</strong> và báo trực tiếp cho nhân viên. Các phiên
            đăng nhập hiện có của tài khoản sẽ kết thúc. Thao tác này không mở khóa tài khoản.
          </p>
          <div>
            <label className="block text-xs font-semibold text-zinc-600">Mật khẩu mới (tối thiểu 6 ký tự)</label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`${INPUT} font-mono`}
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
              disabled={busy || newPassword.length < 6}
              onClick={() => void handleResetPassword()}
              className="rounded-xl bg-[#2D6A4F] px-4 py-2 font-semibold text-white hover:bg-[#23533D] disabled:opacity-50"
            >
              Xác nhận đặt lại
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
