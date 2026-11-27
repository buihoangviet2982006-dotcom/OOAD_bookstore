import { API_ENDPOINTS } from "@/config/api";
import { httpClient } from "@/lib/http-client";
import type {
  CartRequest,
  Customer,
  Invoice,
  InvoicePreview,
  ReturnOrder,
  ReturnPreview,
  ReturnRequest,
} from "@/types";

export const salesService = {
  /** Xem trước giỏ hàng: giá, khuyến mãi, tổng tiền do backend tính, không ghi DB. */
  async previewInvoice(cart: CartRequest): Promise<InvoicePreview> {
    return httpClient.post<InvoicePreview>(API_ENDPOINTS.invoicePreview, cart);
  },

  async getInvoices(): Promise<Invoice[]> {
    return httpClient.get<Invoice[]>(API_ENDPOINTS.invoices);
  },

  async createInvoice(
    payload: Omit<Invoice, "id" | "code" | "createdAt" | "status"> & {
      requestKey?: string;
      expectedTotal?: number;
    },
  ): Promise<Invoice> {
    return httpClient.post<Invoice>(API_ENDPOINTS.invoices, payload);
  },

  /** Xem trước phiếu đổi/trả: giá trị trả, tiền hoàn / khách bù do backend tính. */
  async previewReturn(payload: ReturnRequest): Promise<ReturnPreview> {
    return httpClient.post<ReturnPreview>(API_ENDPOINTS.returnPreview, payload);
  },

  async getReturns(): Promise<ReturnOrder[]> {
    return httpClient.get<ReturnOrder[]>(API_ENDPOINTS.returns);
  },

  async createReturn(
    payload: Omit<ReturnOrder, "id" | "code" | "createdAt" | "status"> & {
      requestKey?: string;
      expectedRefundAmount?: number;
      expectedExtraPayment?: number;
    },
  ): Promise<ReturnOrder> {
    return httpClient.post<ReturnOrder>(API_ENDPOINTS.returns, payload);
  },

  async getCustomers(): Promise<Customer[]> {
    return httpClient.get<Customer[]>(API_ENDPOINTS.customers);
  },

  async saveCustomer(
    payload: Omit<
      Customer,
      "id" | "code" | "points" | "totalSpent" | "orderCount" | "lastPurchaseDate" | "createdAt"
    > & {
      id?: string;
    },
  ): Promise<Customer> {
    return payload.id
      ? httpClient.patch<Customer>(`${API_ENDPOINTS.customers}/${payload.id}`, payload)
      : httpClient.post<Customer>(API_ENDPOINTS.customers, payload);
  },

  async deleteCustomer(id: string): Promise<void> {
    await httpClient.delete(`${API_ENDPOINTS.customers}/${id}`);
  },
};
