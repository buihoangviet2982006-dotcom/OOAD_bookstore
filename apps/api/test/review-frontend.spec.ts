/** Focused handler tests using the existing Vitest runner; no DOM/test-library dependency.
 * JSX and hooks are stubbed, so these cover state transitions, not browser layout/React scheduling.
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

type Node = { type: unknown; props: Record<string, any> };
function nodes(value: any): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object') return [];
  return [value, ...nodes(value.props?.children), ...nodes(value.props?.actions)];
}
function label(value: any): string {
  if (Array.isArray(value)) return value.map(label).join('');
  return value && typeof value === 'object' ? label(value.props?.children) : String(value ?? '');
}

class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function pageHarness(page: string, services: object) {
  const values: any[] = [];
  const deps: any[][] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  const react = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], (next: any) => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
    },
    useRef(initial: any) { return react.useState(() => ({ current: initial }))[0]; },
    useMemo(fn: () => any) { return fn(); },
    useEffect(fn: () => void, next: any[]) {
      const index = cursor++;
      if (!deps[index] || next.some((v, i) => v !== deps[index][i])) effects.push(fn);
      deps[index] = next;
    },
  };
  const downloadCsv = vi.fn();
  const modules: Record<string, any> = {
    react, '@/services': services, '@/lib/http-client': { ApiError },
    'react/jsx-runtime': { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) },
    '@/config/api': { shouldUseMock: () => false }, '@/config/brand': { BRAND_CONFIG: { store: {} } },
    '@/context/AuthContext': { useAuth: () => ({ user: { id: 'TEST', fullName: 'Test' } }) },
    '@/context/ToastContext': { useToast: () => ({ showToast: vi.fn() }) },
    '@/lib/export': { downloadCsv, triggerPrint: vi.fn() },
    '@/lib/format': { formatCurrency: String, formatDate: String, formatDateTime: String, formatIsoDate: String,
      percentChange: () => 0, todayIsoDate: () => '2026-11-27', shiftIsoDate: (s: string) => s },
  };
  const source = readFileSync(new URL(`../../web/src/app/(dashboard)/${page}/page.tsx`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports: any = {};
  runInNewContext(code, { exports, require: (id: string) => modules[id] ?? {}, crypto, Error,
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay), clearTimeout });
  let tree: any;
  const render = () => { cursor = 0; effects = []; tree = exports.default(); effects.forEach((fn) => fn()); return tree; };
  const button = (text: string) => {
    const found = nodes(tree).find((n) => n.type === 'button' && label(n).includes(text));
    if (!found) throw new Error(`Missing button: ${text}`);
    return found.props;
  };
  return { render, button, downloadCsv, tree: () => tree };
}

afterEach(() => vi.useRealTimers());

it.each(['last stock', 'last voucher'])('POS recovers %s with original payload despite invalid fresh preview', async (reason) => {
  vi.useFakeTimers();
  const book = { id: 'TEST-BOOK', sku: 'TEST', title: 'Test Book', status: 'ACTIVE', stock: 1, sellPrice: 20000 };
  const previewInvoice = vi.fn().mockResolvedValue({ valid: true, subtotal: 20000, discountAmount: 0, totalAmount: 20000, messages: [] });
  const createInvoice = vi.fn().mockRejectedValueOnce(new ApiError('timeout', 0))
    .mockImplementationOnce(async (payload) => ({ ...payload, id: 'TEST-INVOICE', code: 'TEST-INVOICE' }));
  const h = pageHarness('sales/pos', {
    inventoryService: { getBooks: async () => [book], getCategories: async () => [] },
    adminService: { getPromotions: async () => [], getVouchers: async () => [] },
    salesService: { getCustomers: async () => [], previewInvoice, createInvoice },
  });
  h.render();
  await vi.runAllTimersAsync();
  h.render();
  h.button('Test Book').onClick();
  h.render();
  await vi.runAllTimersAsync();
  h.render();
  expect(h.button('Lập hóa đơn & Thanh toán').disabled).toBe(false);
  previewInvoice.mockResolvedValue({ valid: false, subtotal: 20000, discountAmount: 0, messages: [reason] });
  await h.button('Lập hóa đơn & Thanh toán').onClick();
  const original = structuredClone(createInvoice.mock.calls[0][0]);
  h.render();
  await vi.runAllTimersAsync();
  h.render();
  // Attempts to edit the unresolved draft must not alter the sent payload.
  h.button('Test Book').onClick();
  h.render();
  expect(h.button('Khôi phục kết quả').disabled).toBe(false);
  await h.button('Khôi phục kết quả').onClick();
  expect(createInvoice).toHaveBeenCalledTimes(2);
  expect(createInvoice.mock.calls[1][0]).toEqual(original);
  h.render();
  expect(h.button('Lập hóa đơn & Thanh toán').disabled).toBe(true);
});

it.each(['inventory', 'debt'])('reports: %s failure is visible and blocks CSV while the other dataset remains usable', async (failed) => {
  vi.useFakeTimers();
  const h = pageHarness('admin/reports', {
    inventoryService: { getBooks: async () => { if (failed === 'inventory') throw new Error('Stock API failed'); return []; } },
    adminService: {
      getSuppliers: async () => { if (failed === 'debt') throw new Error('Debt API failed'); return []; },
      getRevenueReport: async () => null, getBestsellers: async () => [],
    },
  });
  h.render();
  h.button(failed === 'inventory' ? 'Báo cáo tồn kho' : 'Báo cáo công nợ NCC').onClick();
  h.render();
  expect(h.button('Xuất file CSV').disabled).toBe(true);
  expect(label(h.tree())).toContain('Đang tải báo cáo');
  await vi.runAllTimersAsync();
  h.render();
  expect(label(h.tree())).toContain(failed === 'inventory' ? 'Stock API failed' : 'Debt API failed');
  expect(h.button('Xuất file CSV').disabled).toBe(true);
  h.button('Xuất file CSV').onClick();
  expect(h.downloadCsv).not.toHaveBeenCalled();
  h.button(failed === 'inventory' ? 'Báo cáo công nợ NCC' : 'Báo cáo tồn kho').onClick();
  h.render();
  expect(h.button('Xuất file CSV').disabled).toBe(false);
  h.button('Xuất file CSV').onClick();
  expect(h.downloadCsv).toHaveBeenCalledTimes(1);
});
