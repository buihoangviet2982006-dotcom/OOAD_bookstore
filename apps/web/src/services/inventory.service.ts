import { API_ENDPOINTS } from "@/config/api";
import { httpClient } from "@/lib/http-client";
import type {
  Author,
  Book,
  Category,
  PaymentMethod,
  Publisher,
  PurchaseOrder,
  StockAdjustment,
  SupplierPayment,
} from "@/types";

export const inventoryService = {
  async getBooks(): Promise<Book[]> {
    return httpClient.get<Book[]>(API_ENDPOINTS.books);
  },

  async saveBook(payload: Omit<Book, "id"> & { id?: string }): Promise<Book> {
    return payload.id
      ? httpClient.patch<Book>(`${API_ENDPOINTS.books}/${payload.id}`, payload)
      : httpClient.post<Book>(API_ENDPOINTS.books, payload);
  },

  /** Trả về thông báo của backend: đã xóa hẳn hoặc đã chuyển "Ngừng kinh doanh". */
  async deleteBook(id: string): Promise<string | undefined> {
    const res = await httpClient.delete<{ action: "DELETED" | "DISCONTINUED"; message: string }>(
      `${API_ENDPOINTS.books}/${id}`,
    );
    return res.message;
  },

  async getCategories(): Promise<Category[]> {
    return httpClient.get<Category[]>(API_ENDPOINTS.categories);
  },

  async saveCategory(
    payload: Omit<Category, "id" | "bookCount"> & { id?: string },
  ): Promise<Category> {
    return payload.id
      ? httpClient.patch<Category>(`${API_ENDPOINTS.categories}/${payload.id}`, payload)
      : httpClient.post<Category>(API_ENDPOINTS.categories, payload);
  },

  async deleteCategory(id: string): Promise<void> {
    await httpClient.delete(`${API_ENDPOINTS.categories}/${id}`);
  },

  async getAuthors(): Promise<Author[]> {
    return httpClient.get<Author[]>(API_ENDPOINTS.authors);
  },

  async saveAuthor(payload: Omit<Author, "id" | "bookCount"> & { id?: string }): Promise<Author> {
    return payload.id
      ? httpClient.patch<Author>(`${API_ENDPOINTS.authors}/${payload.id}`, payload)
      : httpClient.post<Author>(API_ENDPOINTS.authors, payload);
  },

  async deleteAuthor(id: string): Promise<void> {
    await httpClient.delete(`${API_ENDPOINTS.authors}/${id}`);
  },

  async getPublishers(): Promise<Publisher[]> {
    return httpClient.get<Publisher[]>(API_ENDPOINTS.publishers);
  },

  async savePublisher(
    payload: Omit<Publisher, "id" | "bookCount"> & { id?: string },
  ): Promise<Publisher> {
    return payload.id
      ? httpClient.patch<Publisher>(`${API_ENDPOINTS.publishers}/${payload.id}`, payload)
      : httpClient.post<Publisher>(API_ENDPOINTS.publishers, payload);
  },

  async deletePublisher(id: string): Promise<void> {
    await httpClient.delete(`${API_ENDPOINTS.publishers}/${id}`);
  },

  async getAdjustments(): Promise<StockAdjustment[]> {
    return httpClient.get<StockAdjustment[]>(API_ENDPOINTS.stockAdjustments);
  },

  async createAdjustment(
    payload: Omit<StockAdjustment, "id" | "code" | "createdAt" | "status"> & {
      requestKey?: string;
    },
  ): Promise<StockAdjustment> {
    return httpClient.post<StockAdjustment>(API_ENDPOINTS.stockAdjustments, payload);
  },

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    return httpClient.get<PurchaseOrder[]>(API_ENDPOINTS.purchaseOrders);
  },

  async createPurchaseOrder(
    payload: Omit<PurchaseOrder, "id" | "code" | "createdAt" | "debtAmount" | "debtStatus"> & {
      requestKey?: string;
      prepaymentMethod?: PaymentMethod;
    },
  ): Promise<PurchaseOrder> {
    return httpClient.post<PurchaseOrder>(API_ENDPOINTS.purchaseOrders, payload);
  },

  async getSupplierPayments(): Promise<SupplierPayment[]> {
    return httpClient.get<SupplierPayment[]>(API_ENDPOINTS.supplierPayments);
  },

  async recordSupplierPayment(
    payload: Omit<SupplierPayment, "id" | "code" | "paidAt"> & { requestKey?: string },
  ): Promise<SupplierPayment> {
    return httpClient.post<SupplierPayment>(API_ENDPOINTS.supplierPayments, payload);
  },
};
