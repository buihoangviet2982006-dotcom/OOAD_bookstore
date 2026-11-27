/**
 * Sinh mã tuần tự dạng PREFIX + số (vd TG001, NXB012) từ các mã hiện có.
 * Mã không khớp mẫu bị bỏ qua. Hai yêu cầu tạo đồng thời có thể sinh trùng mã –
 * khi đó DB từ chối (khóa chính) và API trả 409, người dùng thử lại (chấp nhận cho demo).
 */
export function nextSequentialCode(prefix: string, existingCodes: string[], width = 3): string {
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  const max = existingCodes.reduce((highest, code) => {
    const match = pattern.exec(code);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(width, '0')}`;
}
