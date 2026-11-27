import { API_ENDPOINTS, shouldUseMock } from "@/config/api";
import { generateCode } from "@/lib/format";
import { httpClient } from "@/lib/http-client";
import { getMockDb, saveMockDb } from "@/mocks/store";
import type { Customer, Invoice, ReturnOrder } from "@/types";

export const salesService = {
  async getInvoices(): Promise<Invoice[]> {
    if (!shouldUseMock("sales")) {
      return httpClient.get<Invoice[]>(API_ENDPOINTS.invoices);
    }
    return [...getMockDb().invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createInvoice(
    payload: Omit<Invoice, "id" | "code" | "createdAt" | "status">,
  ): Promise<Invoice> {
    if (!shouldUseMock("sales")) {
      return httpClient.post<Invoice>(API_ENDPOINTS.invoices, payload);
    }

    const db = getMockDb();
    const newInvoice: Invoice = {
      ...payload,
      id: `INV-${Date.now()}`,
      code: generateCode("HD"),
      createdAt: new Date().toISOString(),
      status: "COMPLETED",
    };

    // Deduct book stock
    newInvoice.items.forEach((item) => {
      const book = db.books.find((b) => b.id === item.bookId);
      if (book) {
        book.stock = Math.max(0, book.stock - item.quantity);
        if (book.stock === 0 && book.status === "ACTIVE") {
          book.status = "OUT_OF_STOCK";
        }
      }
    });

    // Update customer metrics
    if (newInvoice.customerId) {
      const customer = db.customers.find((c) => c.id === newInvoice.customerId);
      if (customer) {
        customer.totalSpent += newInvoice.totalAmount;
        customer.orderCount += 1;
        customer.points += Math.floor(newInvoice.totalAmount / 10000);
        customer.lastPurchaseDate = newInvoice.createdAt;
        if (customer.totalSpent >= 8000000) customer.tier = "DIAMOND";
        else if (customer.totalSpent >= 3500000) customer.tier = "GOLD";
        else if (customer.totalSpent >= 1200000) customer.tier = "SILVER";
      }
    }

    // Track voucher usage if applied
    if (newInvoice.voucherCode) {
      const voucher = db.vouchers.find(
        (v) => v.code.toUpperCase() === newInvoice.voucherCode?.toUpperCase(),
      );
      if (voucher) {
        voucher.usedCount += 1;
        if (voucher.usedCount >= voucher.usageLimit) voucher.isActive = false;
      }
      db.voucherUsages.unshift({
        id: `VU-${Date.now()}`,
        voucherCode: newInvoice.voucherCode.toUpperCase(),
        invoiceCode: newInvoice.code,
        customerName: newInvoice.customerName,
        usedAt: newInvoice.createdAt,
        discountAmount: newInvoice.discountAmount,
        orderTotal: newInvoice.totalAmount,
      });
    }

    db.invoices.unshift(newInvoice);
    saveMockDb(db);
    return newInvoice;
  },

  async getReturns(): Promise<ReturnOrder[]> {
    if (!shouldUseMock("sales")) {
      return httpClient.get<ReturnOrder[]>(API_ENDPOINTS.returns);
    }
    return [...getMockDb().returns].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createReturn(
    payload: Omit<ReturnOrder, "id" | "code" | "createdAt" | "status">,
  ): Promise<ReturnOrder> {
    if (!shouldUseMock("sales")) {
      return httpClient.post<ReturnOrder>(API_ENDPOINTS.returns, payload);
    }

    const db = getMockDb();
    const record: ReturnOrder = {
      ...payload,
      id: `RET-${Date.now()}`,
      code: generateCode("DT"),
      createdAt: new Date().toISOString(),
      status: "COMPLETED",
    };

    const invoice = db.invoices.find((i) => i.id === payload.invoiceId);
    if (invoice) {
      invoice.status = "PARTIAL_RETURN";
    }

    // Restock returned books & deduct exchanged book if applicable
    payload.returnItems.forEach((ri) => {
      const book = db.books.find((b) => b.id === ri.bookId);
      if (book) {
        book.stock += ri.quantity;
        if (book.stock > 0 && book.status === "OUT_OF_STOCK") book.status = "ACTIVE";
      }
    });

    if (payload.type === "EXCHANGE" && payload.exchangeBookId && payload.exchangeQuantity) {
      const exBook = db.books.find((b) => b.id === payload.exchangeBookId);
      if (exBook) {
        exBook.stock = Math.max(0, exBook.stock - payload.exchangeQuantity);
      }
    }

    db.returns.unshift(record);
    saveMockDb(db);
    return record;
  },

  async getCustomers(): Promise<Customer[]> {
    if (!shouldUseMock("customers")) {
      return httpClient.get<Customer[]>(API_ENDPOINTS.customers);
    }
    return [...getMockDb().customers];
  },

  async saveCustomer(
    payload: Omit<Customer, "id" | "code" | "points" | "totalSpent" | "orderCount" | "lastPurchaseDate" | "createdAt"> & {
      id?: string;
    },
  ): Promise<Customer> {
    if (!shouldUseMock("customers")) {
      return payload.id
        ? httpClient.patch<Customer>(`${API_ENDPOINTS.customers}/${payload.id}`, payload)
        : httpClient.post<Customer>(API_ENDPOINTS.customers, payload);
    }

    const db = getMockDb();
    if (payload.id) {
      const idx = db.customers.findIndex((c) => c.id === payload.id);
      if (idx >= 0) {
        db.customers[idx] = { ...db.customers[idx], ...payload };
        saveMockDb(db);
        return db.customers[idx];
      }
    }

    const created: Customer = {
      id: `CUS-${Date.now()}`,
      code: `KH${String(db.customers.length + 1).padStart(3, "0")}`,
      fullName: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      tier: payload.tier ?? "STANDARD",
      points: 0,
      totalSpent: 0,
      orderCount: 0,
      lastPurchaseDate: null,
      createdAt: new Date().toISOString(),
      notes: payload.notes,
    };
    db.customers.unshift(created);
    saveMockDb(db);
    return created;
  },

  async deleteCustomer(id: string): Promise<void> {
    if (!shouldUseMock("customers")) {
      await httpClient.delete(`${API_ENDPOINTS.customers}/${id}`);
      return;
    }
    const db = getMockDb();
    db.customers = db.customers.filter((c) => c.id !== id);
    saveMockDb(db);
  },
};
