import { API_ENDPOINTS, shouldUseMock } from "@/config/api";
import { generateCode } from "@/lib/format";
import { httpClient } from "@/lib/http-client";
import { getMockDb, saveMockDb } from "@/mocks/store";
import type {
  Author,
  Book,
  Category,
  Publisher,
  PurchaseOrder,
  StockAdjustment,
  SupplierPayment,
} from "@/types";

export const inventoryService = {
  async getBooks(): Promise<Book[]> {
    if (!shouldUseMock("books")) {
      return httpClient.get<Book[]>(API_ENDPOINTS.books);
    }
    return [...getMockDb().books];
  },

  async saveBook(payload: Omit<Book, "id"> & { id?: string }): Promise<Book> {
    if (!shouldUseMock("books")) {
      return payload.id
        ? httpClient.patch<Book>(`${API_ENDPOINTS.books}/${payload.id}`, payload)
        : httpClient.post<Book>(API_ENDPOINTS.books, payload);
    }

    const db = getMockDb();
    if (payload.id) {
      const idx = db.books.findIndex((b) => b.id === payload.id);
      if (idx >= 0) {
        db.books[idx] = { ...payload, id: payload.id };
        saveMockDb(db);
        return db.books[idx];
      }
    }

    const created: Book = {
      ...payload,
      id: `BK-${Date.now()}`,
      sku: payload.sku || `SP${String(db.books.length + 1).padStart(3, "0")}`,
    };
    db.books.unshift(created);
    saveMockDb(db);
    return created;
  },

  async deleteBook(id: string): Promise<void> {
    if (!shouldUseMock("books")) {
      await httpClient.delete(`${API_ENDPOINTS.books}/${id}`);
      return;
    }
    const db = getMockDb();
    db.books = db.books.filter((b) => b.id !== id);
    saveMockDb(db);
  },

  async getCategories(): Promise<Category[]> {
    if (!shouldUseMock("catalog")) {
      return httpClient.get<Category[]>(API_ENDPOINTS.categories);
    }
    const db = getMockDb();
    return db.categories.map((c) => ({
      ...c,
      bookCount: db.books.filter((b) => b.categoryId === c.id).length,
    }));
  },

  async saveCategory(payload: Omit<Category, "id" | "bookCount"> & { id?: string }): Promise<Category> {
    if (!shouldUseMock("catalog")) {
      return payload.id
        ? httpClient.patch<Category>(`${API_ENDPOINTS.categories}/${payload.id}`, payload)
        : httpClient.post<Category>(API_ENDPOINTS.categories, payload);
    }
    const db = getMockDb();
    if (payload.id) {
      const idx = db.categories.findIndex((c) => c.id === payload.id);
      if (idx >= 0) {
        db.categories[idx] = { ...db.categories[idx], ...payload };
        db.books.forEach((b) => {
          if (b.categoryId === payload.id) b.categoryName = payload.name;
        });
        saveMockDb(db);
        return db.categories[idx];
      }
    }
    const created: Category = { ...payload, id: `CAT-${Date.now()}` };
    db.categories.push(created);
    saveMockDb(db);
    return created;
  },

  async deleteCategory(id: string): Promise<void> {
    if (!shouldUseMock("catalog")) {
      await httpClient.delete(`${API_ENDPOINTS.categories}/${id}`);
      return;
    }
    const db = getMockDb();
    db.categories = db.categories.filter((c) => c.id !== id);
    saveMockDb(db);
  },

  async getAuthors(): Promise<Author[]> {
    if (!shouldUseMock("catalog")) {
      return httpClient.get<Author[]>(API_ENDPOINTS.authors);
    }
    const db = getMockDb();
    return db.authors.map((a) => ({
      ...a,
      bookCount: db.books.filter((b) => b.authorId === a.id).length,
    }));
  },

  async saveAuthor(payload: Omit<Author, "id" | "bookCount"> & { id?: string }): Promise<Author> {
    if (!shouldUseMock("catalog")) {
      return payload.id
        ? httpClient.patch<Author>(`${API_ENDPOINTS.authors}/${payload.id}`, payload)
        : httpClient.post<Author>(API_ENDPOINTS.authors, payload);
    }
    const db = getMockDb();
    if (payload.id) {
      const idx = db.authors.findIndex((a) => a.id === payload.id);
      if (idx >= 0) {
        db.authors[idx] = { ...db.authors[idx], ...payload };
        db.books.forEach((b) => {
          if (b.authorId === payload.id) b.authorName = payload.name;
        });
        saveMockDb(db);
        return db.authors[idx];
      }
    }
    const created: Author = { ...payload, id: `AUT-${Date.now()}` };
    db.authors.push(created);
    saveMockDb(db);
    return created;
  },

  async deleteAuthor(id: string): Promise<void> {
    if (!shouldUseMock("catalog")) {
      await httpClient.delete(`${API_ENDPOINTS.authors}/${id}`);
      return;
    }
    const db = getMockDb();
    db.authors = db.authors.filter((a) => a.id !== id);
    saveMockDb(db);
  },

  async getPublishers(): Promise<Publisher[]> {
    if (!shouldUseMock("catalog")) {
      return httpClient.get<Publisher[]>(API_ENDPOINTS.publishers);
    }
    const db = getMockDb();
    return db.publishers.map((p) => ({
      ...p,
      bookCount: db.books.filter((b) => b.publisherId === p.id).length,
    }));
  },

  async savePublisher(payload: Omit<Publisher, "id" | "bookCount"> & { id?: string }): Promise<Publisher> {
    if (!shouldUseMock("catalog")) {
      return payload.id
        ? httpClient.patch<Publisher>(`${API_ENDPOINTS.publishers}/${payload.id}`, payload)
        : httpClient.post<Publisher>(API_ENDPOINTS.publishers, payload);
    }
    const db = getMockDb();
    if (payload.id) {
      const idx = db.publishers.findIndex((p) => p.id === payload.id);
      if (idx >= 0) {
        db.publishers[idx] = { ...db.publishers[idx], ...payload };
        db.books.forEach((b) => {
          if (b.publisherId === payload.id) b.publisherName = payload.name;
        });
        saveMockDb(db);
        return db.publishers[idx];
      }
    }
    const created: Publisher = { ...payload, id: `PUB-${Date.now()}` };
    db.publishers.push(created);
    saveMockDb(db);
    return created;
  },

  async deletePublisher(id: string): Promise<void> {
    if (!shouldUseMock("catalog")) {
      await httpClient.delete(`${API_ENDPOINTS.publishers}/${id}`);
      return;
    }
    const db = getMockDb();
    db.publishers = db.publishers.filter((p) => p.id !== id);
    saveMockDb(db);
  },

  async getAdjustments(): Promise<StockAdjustment[]> {
    if (!shouldUseMock("inventory")) {
      return httpClient.get<StockAdjustment[]>(API_ENDPOINTS.stockAdjustments);
    }
    return [...getMockDb().adjustments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createAdjustment(
    payload: Omit<StockAdjustment, "id" | "code" | "createdAt" | "status">,
  ): Promise<StockAdjustment> {
    if (!shouldUseMock("inventory")) {
      return httpClient.post<StockAdjustment>(API_ENDPOINTS.stockAdjustments, payload);
    }
    const db = getMockDb();
    const record: StockAdjustment = {
      ...payload,
      id: `ADJ-${Date.now()}`,
      code: generateCode("KK"),
      createdAt: new Date().toISOString(),
      status: "APPLIED",
    };

    record.items.forEach((item) => {
      const book = db.books.find((b) => b.id === item.bookId);
      if (book) {
        book.stock = Math.max(0, item.actualStock);
        if (book.stock === 0 && book.status === "ACTIVE") book.status = "OUT_OF_STOCK";
        if (book.stock > 0 && book.status === "OUT_OF_STOCK") book.status = "ACTIVE";
      }
    });

    db.adjustments.unshift(record);
    saveMockDb(db);
    return record;
  },

  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    if (!shouldUseMock("imports")) {
      return httpClient.get<PurchaseOrder[]>(API_ENDPOINTS.purchaseOrders);
    }
    return [...getMockDb().purchaseOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createPurchaseOrder(
    payload: Omit<PurchaseOrder, "id" | "code" | "createdAt" | "debtAmount" | "debtStatus">,
  ): Promise<PurchaseOrder> {
    if (!shouldUseMock("imports")) {
      return httpClient.post<PurchaseOrder>(API_ENDPOINTS.purchaseOrders, payload);
    }
    const db = getMockDb();
    const debtAmount = Math.max(0, payload.totalAmount - payload.paidAmount);
    const debtStatus =
      debtAmount === 0 ? "PAID" : payload.paidAmount > 0 ? "PARTIAL" : "UNPAID";

    const po: PurchaseOrder = {
      ...payload,
      id: `PO-${Date.now()}`,
      code: generateCode("PN"),
      createdAt: new Date().toISOString(),
      debtAmount,
      debtStatus,
    };

    // Increase book stock & update latest import price
    po.items.forEach((item) => {
      const book = db.books.find((b) => b.id === item.bookId);
      if (book) {
        book.stock += item.quantity;
        book.importPrice = item.importPrice;
        if (book.stock > 0 && book.status === "OUT_OF_STOCK") book.status = "ACTIVE";
      }
    });

    // Update supplier total & debt
    const supplier = db.suppliers.find((s) => s.id === po.supplierId);
    if (supplier) {
      supplier.totalImportAmount += po.totalAmount;
      supplier.currentDebt += debtAmount;
      if (po.dueDate && (!supplier.dueDate || po.dueDate < supplier.dueDate)) {
        supplier.dueDate = po.dueDate;
      }
    }

    if (po.paidAmount > 0) {
      db.supplierPayments.unshift({
        id: `PAY-${Date.now()}`,
        code: generateCode("PC"),
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        purchaseOrderId: po.id,
        purchaseOrderCode: po.code,
        paidAt: po.createdAt,
        amount: po.paidAmount,
        paymentMethod: "TRANSFER",
        recordedBy: po.createdBy,
        note: `Thanh toán khi lập phiếu nhập ${po.code}`,
      });
    }

    db.purchaseOrders.unshift(po);
    saveMockDb(db);
    return po;
  },

  async getSupplierPayments(): Promise<SupplierPayment[]> {
    if (!shouldUseMock("imports")) {
      return httpClient.get<SupplierPayment[]>(API_ENDPOINTS.supplierPayments);
    }
    return [...getMockDb().supplierPayments].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  },

  async recordSupplierPayment(
    payload: Omit<SupplierPayment, "id" | "code" | "paidAt">,
  ): Promise<SupplierPayment> {
    if (!shouldUseMock("imports")) {
      return httpClient.post<SupplierPayment>(API_ENDPOINTS.supplierPayments, payload);
    }
    const db = getMockDb();
    const payment: SupplierPayment = {
      ...payload,
      id: `PAY-${Date.now()}`,
      code: generateCode("PC"),
      paidAt: new Date().toISOString(),
    };

    const supplier = db.suppliers.find((s) => s.id === payload.supplierId);
    if (supplier) {
      supplier.currentDebt = Math.max(0, supplier.currentDebt - payload.amount);
      if (supplier.currentDebt === 0) supplier.dueDate = null;
    }

    if (payload.purchaseOrderId) {
      const po = db.purchaseOrders.find((p) => p.id === payload.purchaseOrderId);
      if (po) {
        po.paidAmount += payload.amount;
        po.debtAmount = Math.max(0, po.totalAmount - po.paidAmount);
        po.debtStatus = po.debtAmount === 0 ? "PAID" : "PARTIAL";
      }
    }

    db.supplierPayments.unshift(payment);
    saveMockDb(db);
    return payment;
  },
};
