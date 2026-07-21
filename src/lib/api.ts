/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { QueryClient } from '@tanstack/react-query';

// Create React Query Client instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 1000,
    },
  },
});

// Configure Axios Instance
const API_URL = (import.meta as any).env.VITE_API_URL || '/api';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

// Add token to each request
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Exclude authentication endpoints from requiring a token
    const isAuthEndpoint = config.url && (
      config.url.includes('/auth/login') ||
      config.url.includes('/auth/register') ||
      config.url.includes('/auth/refresh') ||
      config.url.includes('/org/invite/')
    );

    if (isAuthEndpoint) {
      return config;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
      // Reject client-side to prevent sending unauthenticated requests to the server
      return Promise.reject(new axios.Cancel('No active session token available.'));
    }

    if (config.headers) {
      if (typeof config.headers.set === 'function') {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers.Authorization = `Bearer ${token}`;
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept 401s and attempt refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              if (typeof originalRequest.headers.set === 'function') {
                originalRequest.headers.set('Authorization', `Bearer ${token}`);
              } else {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                originalRequest.headers['Authorization'] = `Bearer ${token}`;
              }
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        isRefreshing = false;
        clearAuthData();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem('accessToken', newAccessToken);
        localStorage.setItem('refreshToken', newRefreshToken);

        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        if (originalRequest.headers) {
          if (typeof originalRequest.headers.set === 'function') {
            originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
          } else {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          }
        }

        processQueue(null, newAccessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        clearAuthData();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        window.location.href = '/auth/login'; // Client-side router path
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

function clearAuthData() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem('organisation');
}

// =========================================================================
// TYPED ENDPOINTS FUNCTIONS EXPORTS
// =========================================================================

// 1. Authentication
export const authApi = {
  login: async (data: any) => {
    const res = await api.post('/auth/login', data);
    return res.data;
  },
  register: async (data: any) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  signup: async (data: any) => {
    const res = await api.post('/auth/signup', data);
    return res.data;
  },
  refresh: async (refreshToken: string) => {
    const res = await api.post('/auth/refresh', { refreshToken });
    return res.data;
  },
  logout: async (refreshToken?: string) => {
    const res = await api.post('/auth/logout', { refreshToken });
    clearAuthData();
    return res.data;
  },
  me: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  updateProfile: async (data: { fullName?: string; email?: string }) => {
    const res = await api.patch('/auth/me', data);
    return res.data;
  },
  uploadAvatar: async (formData: FormData) => {
    const res = await api.post('/auth/me/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  forgotPassword: async (email: string) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },
  resetPassword: async (token: string, password: string) => {
    const res = await api.post('/auth/reset-password', { token, password });
    return res.data;
  },
};

// 2b. Platform Branding
export const platformApi = {
  getBranding: async (): Promise<{ developerLogoUrl: string | null }> => {
    const res = await api.get('/platform/branding');
    return res.data;
  },
};

export interface NotificationItem {
  id: string;
  icon: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  link: string;
  timestamp: string;
}

export const notificationsApi = {
  getNotifications: async (): Promise<NotificationItem[]> => {
    const res = await api.get('/notifications');
    return res.data;
  },
};

// 2c. Organisation Management
export const orgApi = {
  inviteUser: async (data: { name: string; email: string; role: string }) => {
    const res = await api.post('/org/invite', data);
    return res.data;
  },
  clearInvites: async () => {
    const res = await api.post('/org/invites/clear');
    return res.data;
  },
  getOrg: async () => {
    const res = await api.get('/org');
    return res.data;
  },
  updateOrg: async (data: any) => {
    const res = await api.patch('/org', data);
    return res.data;
  },
  uploadLogo: async (formData: FormData) => {
    const res = await api.post('/org/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getSettings: async (): Promise<Record<string, any>> => {
    const res = await api.get('/org/settings');
    return res.data;
  },
  updateSettings: async (settings: Record<string, any>): Promise<Record<string, any>> => {
    const res = await api.patch('/org/settings', { settings });
    return res.data;
  },
  getUsers: async () => {
    const res = await api.get('/org/users');
    return res.data;
  },
  createUser: async (data: { name: string; email: string; role: string; password: string }) => {
    const res = await api.post('/org/users/manual', data);
    return res.data;
  },
  updateUser: async (userId: string, data: any) => {
    const res = await api.patch(`/org/users/${userId}`, data);
    return res.data;
  },
  exportUsersCsv: async () => {
    const res = await api.get('/org/users/export/csv', { responseType: 'blob' });
    return res.data;
  },
  exportUsersPdf: async () => {
    const res = await api.get('/org/users/export/pdf', { responseType: 'blob' });
    return res.data;
  },
};

// 3. Banking Endpoints
export const bankingApi = {
  getAccounts: async () => {
    const res = await api.get('/banking/accounts');
    return res.data;
  },
  getGLAccounts: async () => {
    const res = await api.get('/banking/gl-accounts');
    return res.data;
  },
  createAccount: async (data: any) => {
    const res = await api.post('/banking/accounts', data);
    return res.data;
  },
  updateAccount: async (id: string, data: any) => {
    const res = await api.patch(`/banking/accounts/${id}`, data);
    return res.data;
  },
  updateBalance: async (id: string, data: any) => {
    const res = await api.patch(`/banking/accounts/${id}/balance`, data);
    return res.data;
  },
  importOpeningBalance: async (data: any) => {
    const res = await api.post('/banking/accounts/import-opening-balances', data);
    return res.data;
  },
  clearImportedStatements: async (accountId: string) => {
    const res = await api.delete(`/banking/accounts/${accountId}/clear-imported-statements`);
    return res.data;
  },
  deleteAccount: async (id: string) => {
    const res = await api.delete(`/banking/accounts/${id}`);
    return res.data;
  },
  connectFlutterwave: async (id: string) => {
    const res = await api.post(`/banking/accounts/${id}/connect-flutterwave`);
    return res.data;
  },
  flutterwaveCallback: async (id: string, code: string) => {
    const res = await api.post(`/banking/accounts/${id}/flutterwave-callback`, { code });
    return res.data;
  },
  uploadStatement: async (id: string, formData: FormData) => {
    const res = await api.post(`/banking/accounts/${id}/upload-statement`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  },
  syncAccount: async (id: string, lastSyncDate?: string) => {
    const res = await api.post(`/banking/accounts/${id}/sync`, { lastSyncDate });
    return res.data;
  },
  getTransactions: async (accountId: string, params?: any) => {
    const res = await api.get(`/banking/accounts/${accountId}/transactions`, { params });
    return res.data;
  },
  getUnmatchedJournalLines: async (accountId: string) => {
    const res = await api.get(`/banking/accounts/${accountId}/unmatched-journal-lines`);
    return res.data;
  },
  getPaymentsByAccount: async (accountId: string, params?: { from?: string; to?: string }) => {
    const query = params?.from || params?.to
      ? `?${params?.from ? `from=${params.from}` : ''}${params?.from && params?.to ? '&' : ''}${params?.to ? `to=${params.to}` : ''}`
      : '';
    const res = await api.get(`/banking/accounts/${accountId}/payments${query}`);
    return res.data;
  },
  reconcileTransaction: async (transactionId: string, journalLineId: string) => {
    const res = await api.patch(`/banking/transactions/${transactionId}/reconcile`, { journalLineId });
    return res.data;
  },
  createRecordFromFeed: async (transactionId: string, data: any) => {
    const res = await api.post(`/banking/transactions/${transactionId}/create-record`, data);
    return res.data;
  },
  batchCreateRecordFromFeed: async (ids: string[], data: any) => {
    const res = await api.post('/banking/transactions/batch-create-record', { ids, data });
    return res.data;
  },
  autoMatchTransactions: async (accountId: string) => {
    const res = await api.post(`/banking/accounts/${accountId}/auto-match`);
    return res.data;
  },
  getReconciliationStatement: async (bankAccountId: string, params?: { asOfDate?: string }) => {
    const res = await api.get(`/banking/accounts/${bankAccountId}/reconciliation-statement`, { params });
    return res.data;
  },
  suggestMatches: async (transactionId: string) => {
    const res = await api.get(`/banking/transactions/${transactionId}/suggest-matches`);
    return res.data;
  },
  partialMatchTransaction: async (transactionId: string, data: { journalLineId: string; allocatedAmount: number }) => {
    const res = await api.post(`/banking/transactions/${transactionId}/partial-match`, data);
    return res.data;
  },
  batchReconcile: async (accountId: string, data: { matches: { bankTransactionId: string; journalLineId: string }[] }) => {
    const res = await api.post(`/banking/accounts/${accountId}/batch-reconcile`, data);
    return res.data;
  },
  generateAdjustment: async (accountId: string, data: any) => {
    const res = await api.post(`/banking/accounts/${accountId}/adjustment`, data);
    return res.data;
  },
  getPerfectMatch: async (transactionId: string) => {
    const res = await api.get(`/banking/transactions/${transactionId}/perfect-match`);
    return res.data;
  },
  getRules: async () => {
    const res = await api.get('/banking/rules');
    return res.data;
  },
  createRule: async (data: any) => {
    const res = await api.post('/banking/rules', data);
    return res.data;
  },
  updateRule: async (id: string, data: any) => {
    const res = await api.patch(`/banking/rules/${id}`, data);
    return res.data;
  },
  deleteRule: async (id: string) => {
    const res = await api.delete(`/banking/rules/${id}`);
    return res.data;
  },
  getCurrencyRates: async () => {
    const res = await api.get('/banking/currency-rates');
    return res.data;
  },
  refreshCurrencyRates: async () => {
    const res = await api.post('/banking/currency-rates/refresh');
    return res.data;
  },
  getTransfers: async (params?: { from?: string; to?: string }) => {
    const query = params?.from || params?.to
      ? `?${params?.from ? `from=${params.from}` : ''}${params?.from && params?.to ? '&' : ''}${params?.to ? `to=${params.to}` : ''}`
      : '';
    const res = await api.get(`/banking/transfers${query}`);
    return res.data;
  },
  createTransfer: async (data: any) => {
    const res = await api.post('/banking/transfers', data);
    return res.data;
  },
  updateTransfer: async (id: string, data: any) => {
    const res = await api.patch(`/banking/transfers/${id}`, data);
    return res.data;
  },
  deleteTransfer: async (id: string) => {
    const res = await api.delete(`/banking/transfers/${id}`);
    return res.data;
  },
  // ══════════════════════════════════════════════
  // Nigerian Banking Integration — New Methods
  // ══════════════════════════════════════════════
  getConnections: async () => {
    const res = await api.get('/banking/connections');
    return res.data;
  },
  connectMonoCallback: async (bankAccountId: string, code: string) => {
    const res = await api.post('/banking/connections/mono/callback', { bankAccountId, code });
    return res.data;
  },
  syncConnection: async (connectionId: string) => {
    const res = await api.post(`/banking/connections/${connectionId}/sync`);
    return res.data;
  },
  deleteConnection: async (connectionId: string) => {
    const res = await api.delete(`/banking/connections/${connectionId}`);
    return res.data;
  },
  getGatewayTransactions: async (params?: { provider?: string; status?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const res = await api.get('/banking/payment-gateway/transactions', { params });
    return res.data;
  },
  syncGatewayTransactions: async (provider: string) => {
    const res = await api.post(`/banking/payment-gateway/sync/${provider}`);
    return res.data;
  },
  autoMatchGateway: async (bankAccountId?: string) => {
    const res = await api.post('/banking/payment-gateway/auto-match', { bankAccountId });
    return res.data;
  },
  getGatewaySummary: async () => {
    const res = await api.get('/banking/payment-gateway/summary');
    return res.data;
  },
  getGatewayProviders: async () => {
    const res = await api.get('/banking/payment-gateway/providers');
    return res.data;
  },
  initializePayment: async (data: { provider: string; email: string; amount: number; currency?: string; callbackUrl?: string; customerName?: string; phone?: string; description?: string; bankAccountId?: string }) => {
    const res = await api.post('/banking/payment-gateway/initialize', data);
    return res.data;
  },
  getBanksList: async () => {
    const res = await api.get('/banking/banks');
    return res.data;
  },
  resolveAccount: async (accountNumber: string, bankCode: string) => {
    const res = await api.post('/banking/resolve-account', { accountNumber, bankCode });
    return res.data;
  },
  disburse: async (data: { provider: string; amount: number; bankCode: string; accountNumber: string; accountName: string; narration?: string; reference?: string }) => {
    const res = await api.post('/banking/disburse', data);
    return res.data;
  },
  getProviderStatus: async () => {
    const res = await api.get('/banking/providers/status');
    return res.data;
  },
};

export const periodsApi = {
  getClosedPeriods: async () => {
    const res = await api.get('/periods/closed');
    return res.data;
  },
  closePeriod: async (data: { periodStart: string; periodEnd: string }) => {
    const res = await api.post('/periods/close', data);
    return res.data;
  },
  reopenPeriod: async (id: string, confirmed: boolean) => {
    const res = await api.delete(`/periods/closed/${id}`, { data: { confirmed } });
    return res.data;
  }
};

// 4. Sales Endpoints
export const salesApi = {
  getInvoices: async (params?: any) => {
    const res = await api.get('/sales/invoices', { params });
    return res.data;
  },
  createInvoice: async (data: any) => {
    const res = await api.post('/sales/invoices', data);
    return res.data;
  },
  getInvoiceAging: async () => {
    const res = await api.get('/sales/invoices/aging-report');
    return res.data;
  },
  getInvoice: async (id: string) => {
    const res = await api.get(`/sales/invoices/${id}`);
    return res.data;
  },
  updateInvoice: async (id: string, data: any) => {
    const res = await api.patch(`/sales/invoices/${id}`, data);
    return res.data;
  },
  sendInvoice: async (id: string) => {
    const res = await api.post(`/sales/invoices/${id}/send`);
    return res.data;
  },
  bulkSendInvoices: async (ids: string[]) => {
    const res = await api.post('/sales/invoices/bulk-send', { ids });
    return res.data;
  },
  voidInvoice: async (id: string) => {
    const res = await api.post(`/sales/invoices/${id}/void`);
    return res.data;
  },
  duplicateInvoice: async (id: string) => {
    const res = await api.post(`/sales/invoices/${id}/duplicate`);
    return res.data;
  },
  getInvoicePdf: async (id: string) => {
    const res = await api.get(`/sales/invoices/${id}/pdf`, { responseType: 'blob' });
    return res.data;
  },
  getQuotePdf: async (id: string) => {
    const res = await api.get(`/sales/quotes/${id}/pdf`, { responseType: 'blob' });
    return res.data;
  },
  getPaymentsReceived: async (params?: any) => {
    const res = await api.get('/sales/payments', { params });
    return res.data;
  },
  createPaymentReceived: async (data: any) => {
    const res = await api.post('/sales/payments', data);
    return res.data;
  },
  getPaymentReceived: async (id: string) => {
    const res = await api.get(`/sales/payments/${id}`);
    return res.data;
  },
  deletePaymentReceived: async (id: string) => {
    const res = await api.delete(`/sales/payments/${id}`);
    return res.data;
  },
  getCreditNotes: async () => {
    const res = await api.get('/sales/credit-notes');
    return res.data;
  },
  createCreditNote: async (data: any) => {
    const res = await api.post('/sales/credit-notes', data);
    return res.data;
  },
  getCreditNote: async (id: string) => {
    const res = await api.get(`/sales/credit-notes/${id}`);
    return res.data;
  },
  applyCreditNote: async (id: string, data: any) => {
    const res = await api.post(`/sales/credit-notes/${id}/apply`, data);
    return res.data;
  },
  getCustomers: async () => {
    const res = await api.get('/sales/customers');
    return res.data;
  },
  createCustomer: async (data: any) => {
    const res = await api.post('/sales/customers', data);
    return res.data;
  },
  getCustomer: async (id: string) => {
    const res = await api.get(`/sales/customers/${id}`);
    return res.data;
  },
  updateCustomer: async (id: string, data: any) => {
    const res = await api.patch(`/sales/customers/${id}`, data);
    return res.data;
  },
  getCustomerStatement: async (id: string) => {
    const res = await api.get(`/sales/customers/${id}/statement`);
    return res.data;
  },
};

// 5. Purchases Endpoints
export const purchasesApi = {
  getBills: async (params?: any) => {
    const res = await api.get('/purchases/bills', { params });
    return res.data;
  },
  createBill: async (data: any) => {
    const res = await api.post('/purchases/bills', data);
    return res.data;
  },
  getBillAgingReport: async () => {
    const res = await api.get('/purchases/bills/aging-report');
    return res.data;
  },
  getBill: async (id: string) => {
    const res = await api.get(`/purchases/bills/${id}`);
    return res.data;
  },
  updateBill: async (id: string, data: any) => {
    const res = await api.patch(`/purchases/bills/${id}`, data);
    return res.data;
  },
  approveBill: async (id: string) => {
    const res = await api.post(`/purchases/bills/${id}/approve`);
    return res.data;
  },
  voidBill: async (id: string) => {
    const res = await api.post(`/purchases/bills/${id}/void`);
    return res.data;
  },
  duplicateBill: async (id: string) => {
    const res = await api.post(`/purchases/bills/${id}/duplicate`);
    return res.data;
  },
  getPaymentsMade: async (params?: any) => {
    const res = await api.get('/purchases/payments', { params });
    return res.data;
  },
  createPaymentMade: async (data: any) => {
    const res = await api.post('/purchases/payments', data);
    return res.data;
  },
  getPaymentMade: async (id: string) => {
    const res = await api.get(`/purchases/payments/${id}`);
    return res.data;
  },
  deletePaymentMade: async (id: string) => {
    const res = await api.delete(`/purchases/payments/${id}`);
    return res.data;
  },
  getExpenses: async (params?: any) => {
    const res = await api.get('/purchases/expenses', { params });
    return res.data;
  },
  createExpense: async (data: any) => {
    const res = await api.post('/purchases/expenses', data);
    return res.data;
  },
  uploadExpenseReceipt: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/purchases/expenses/${id}/receipt`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getExpense: async (id: string) => {
    const res = await api.get(`/purchases/expenses/${id}`);
    return res.data;
  },
  updateExpense: async (id: string, data: any) => {
    const res = await api.patch(`/purchases/expenses/${id}`, data);
    return res.data;
  },
  deleteExpense: async (id: string) => {
    const res = await api.delete(`/purchases/expenses/${id}`);
    return res.data;
  },
  getPurchaseOrders: async () => {
    const res = await api.get('/purchases/orders');
    return res.data;
  },
  createPurchaseOrder: async (data: any) => {
    const res = await api.post('/purchases/orders', data);
    return res.data;
  },
  getPurchaseOrder: async (id: string) => {
    const res = await api.get(`/purchases/orders/${id}`);
    return res.data;
  },
  updatePurchaseOrder: async (id: string, data: any) => {
    const res = await api.patch(`/purchases/orders/${id}`, data);
    return res.data;
  },
  deletePurchaseOrder: async (id: string) => {
    const res = await api.delete(`/purchases/orders/${id}`);
    return res.data;
  },
  convertToBill: async (id: string) => {
    const res = await api.post(`/purchases/orders/${id}/convert-to-bill`);
    return res.data;
  },
  getVendors: async () => {
    const res = await api.get('/purchases/vendors');
    return res.data;
  },
  createVendor: async (data: any) => {
    const res = await api.post('/purchases/vendors', data);
    return res.data;
  },
  getVendor: async (id: string) => {
    const res = await api.get(`/purchases/vendors/${id}`);
    return res.data;
  },
  updateVendor: async (id: string, data: any) => {
    const res = await api.patch(`/purchases/vendors/${id}`, data);
    return res.data;
  },
  getVendorStatement: async (id: string) => {
    const res = await api.get(`/purchases/vendors/${id}/statement`);
    return res.data;
  },
  getVendorCreditNotes: async () => {
    const res = await api.get('/purchases/credit-notes');
    return res.data;
  },
  createVendorCreditNote: async (data: any) => {
    const res = await api.post('/purchases/credit-notes', data);
    return res.data;
  },
  getVendorCreditNote: async (id: string) => {
    const res = await api.get(`/purchases/credit-notes/${id}`);
    return res.data;
  },
  applyVendorCreditNote: async (id: string, data: any) => {
    const res = await api.post(`/purchases/credit-notes/${id}/apply`, data);
    return res.data;
  },
  voidVendorCreditNote: async (id: string) => {
    const res = await api.post(`/purchases/credit-notes/${id}/void`);
    return res.data;
  },
  getBillsPdf: async (params?: any) => {
    const res = await api.get('/purchases/bills/pdf', { params, responseType: 'blob' });
    return res.data;
  },
  getBillPdf: async (id: string) => {
    const res = await api.get(`/purchases/bills/${id}/pdf`, { responseType: 'blob' });
    return res.data;
  },
};

// 6. Payroll Endpoints
export const payrollApi = {
  getEmployees: async () => {
    const res = await api.get('/payroll/employees');
    return res.data;
  },
  createEmployee: async (data: any) => {
    const res = await api.post('/payroll/employees', data);
    return res.data;
  },
  getEmployee: async (id: string) => {
    const res = await api.get(`/payroll/employees/${id}`);
    return res.data;
  },
  updateEmployee: async (id: string, data: any) => {
    const res = await api.patch(`/payroll/employees/${id}`, data);
    return res.data;
  },
  getPayrollRuns: async () => {
    const res = await api.get('/payroll/runs');
    return res.data;
  },
  createPayrollRun: async (data: any) => {
    const res = await api.post('/payroll/runs', data);
    return res.data;
  },
  getPayrollRun: async (id: string) => {
    const res = await api.get(`/payroll/runs/${id}`);
    return res.data;
  },
  approvePayrollRun: async (id: string) => {
    const res = await api.post(`/payroll/runs/${id}/approve`);
    return res.data;
  },
  payPayrollRun: async (id: string) => {
    const res = await api.post(`/payroll/runs/${id}/pay`);
    return res.data;
  },
  getPayslip: async (id: string, employeeId: string) => {
    const res = await api.get(`/payroll/runs/${id}/payslips/${employeeId}`);
    return res.data;
  },
  getPayrollSummary: async () => {
    const res = await api.get('/payroll/summary');
    return res.data;
  },
  getEmployeesPdf: async () => {
    const res = await api.get('/payroll/employees/pdf', { responseType: 'blob' });
    return res.data;
  },
  getPayrollRunsPdf: async (params?: any) => {
    const res = await api.get('/payroll/runs/pdf', { params, responseType: 'blob' });
    return res.data;
  },
  getPAYESchedulePdf: async (runId: string) => {
    const res = await api.get(`/payroll/runs/${runId}/paye-schedule/pdf`, { responseType: 'blob' });
    return res.data;
  },
  getPensionSchedulePdf: async (runId: string) => {
    const res = await api.get(`/payroll/runs/${runId}/pension-schedule/pdf`, { responseType: 'blob' });
    return res.data;
  },
  getPayslipPdf: async (runId: string, employeeId: string) => {
    const res = await api.get(`/payroll/runs/${runId}/payslips/${employeeId}/pdf`, { responseType: 'blob' });
    return res.data;
  },
  bulkDeleteEmployees: async (ids: string[]) => {
    const res = await api.post('/payroll/employees/bulk-delete', { ids });
    return res.data;
  },
  deleteEmployee: async (id: string) => {
    const res = await api.delete(`/payroll/employees/${id}`);
    return res.data;
  },
  deletePayrollRun: async (id: string) => {
    const res = await api.delete(`/payroll/runs/${id}`);
    return res.data;
  },
  bulkDeletePayrollRuns: async (ids: string[]) => {
    const res = await api.post('/payroll/runs/bulk-delete', { ids });
    return res.data;
  },
  deletePayslipLine: async (runId: string, employeeId: string) => {
    const res = await api.delete(`/payroll/runs/${runId}/payslips/${employeeId}`);
    return res.data;
  },
  bulkDeletePayslipLines: async (runId: string, employeeIds: string[]) => {
    const res = await api.post(`/payroll/runs/${runId}/payslips/bulk-delete`, { employeeIds });
    return res.data;
  },
};

// 7. Accountant Endpoints
export const accountantApi = {
  getAccounts: async () => {
    const res = await api.get('/accountant/accounts');
    return res.data;
  },
  importAccountsCsv: async (data: { csvData: string }) => {
    const res = await api.post('/accountant/accounts/import-csv', data);
    return res.data;
  },
  exportAccountsCsv: async () => {
    const res = await api.get('/accountant/accounts/export-csv', { responseType: 'blob' });
    return res.data;
  },
  getManualJournalsPdf: async (params?: any) => {
    const res = await api.get('/accountant/manual-journals/pdf', { params, responseType: 'blob' });
    return res.data;
  },
  getAccountsPdf: async () => {
    const res = await api.get('/accountant/accounts/pdf', { responseType: 'blob' });
    return res.data;
  },
  getBudgetsPdf: async () => {
    const res = await api.get('/accountant/budgets/pdf', { responseType: 'blob' });
    return res.data;
  },
  importJournalsCsv: async (csvData: string) => {
    const res = await api.post('/journals/import-csv', { csvData });
    return res.data;
  },
  importBudgetsCsv: async (csvData: string) => {
    const res = await api.post('/budgets/import-csv', { csvData });
    return res.data;
  },
  getAccountLedger: async (accountId: string, params: { startDate: string; endDate: string; page?: number; limit?: number }) => {
    const res = await api.get(`/accountant/accounts/${accountId}/ledger`, { params });
    return res.data;
  },
};

// 7b. Journals Endpoints
export const journalsApi = {
  getJournals: async (params?: { from?: string; to?: string; accountId?: string }) => {
    const res = await api.get('/journals', { params });
    return res.data;
  },
  getJournal: async (id: string) => {
    const res = await api.get(`/journals/${id}`);
    return res.data;
  },
  createJournal: async (data: any) => {
    const res = await api.post('/journals', data);
    return res.data;
  },
  reverseJournal: async (id: string) => {
    const res = await api.post(`/journals/${id}/reverse`);
    return res.data;
  },
  updateJournal: async (id: string, data: any) => {
    const res = await api.put(`/journals/${id}`, data);
    return res.data;
  },
  tagJournal: async (id: string, isOpeningBalance: boolean) => {
    const res = await api.patch(`/journals/${id}/tag`, { isOpeningBalance });
    return res.data;
  },
  submitReview: async (id: string) => {
    const res = await api.post(`/journals/${id}/submit-review`);
    return res.data;
  },
  approveJournal: async (id: string) => {
    const res = await api.post(`/journals/${id}/approve`);
    return res.data;
  },
  postJournal: async (id: string) => {
    const res = await api.post(`/journals/${id}/post`);
    return res.data;
  },
  lockJournal: async (id: string) => {
    const res = await api.post(`/journals/${id}/lock`);
    return res.data;
  },
  cancelJournal: async (id: string) => {
    const res = await api.post(`/journals/${id}/cancel`);
    return res.data;
  },
};

// 7c. Budgets Endpoints
export const budgetsApi = {
  getBudgets: async () => {
    const res = await api.get('/budgets');
    return res.data;
  },
  getBudget: async (id: string) => {
    const res = await api.get(`/budgets/${id}`);
    return res.data;
  },
  createBudget: async (data: any) => {
    const res = await api.post('/budgets', data);
    return res.data;
  },
  updateBudget: async (id: string, data: any) => {
    const res = await api.patch(`/budgets/${id}`, data);
    return res.data;
  },
  deleteBudget: async (id: string) => {
    const res = await api.delete(`/budgets/${id}`);
    return res.data;
  },
};

// 7d. Fixed Assets Endpoints
export const fixedAssetsApi = {
  getAssets: async () => { const res = await api.get('/fixed-assets'); return res.data; },
  getAsset: async (id: string) => { const res = await api.get(`/fixed-assets/${id}`); return res.data; },
  createAsset: async (data: any) => { const res = await api.post('/fixed-assets', data); return res.data; },
  updateAsset: async (id: string, data: any) => { const res = await api.patch(`/fixed-assets/${id}`, data); return res.data; },
  deleteAsset: async (id: string) => { const res = await api.delete(`/fixed-assets/${id}`); return res.data; },
  bulkDeleteAssets: async (ids: string[]) => { const res = await api.post('/fixed-assets/bulk-delete', { ids }); return res.data; },
  importAssetsCsv: async (data: { csvData: string }) => { const res = await api.post('/fixed-assets/import-csv', data); return res.data; },
  exportAssetsCsv: async () => { const res = await api.get('/fixed-assets/export-csv', { responseType: 'blob' }); return res.data; },
  getAssetsPdf: async () => { const res = await api.get('/fixed-assets/pdf', { responseType: 'blob' }); return res.data; },
  runDepreciation: async (periodDate?: string) => { const res = await api.post('/fixed-assets/run-depreciation', { periodDate }); return res.data; },

  // Asset Classes
  getClasses: async () => { const res = await api.get('/fixed-assets/classes'); return res.data; },
  createClass: async (data: any) => { const res = await api.post('/fixed-assets/classes', data); return res.data; },
  updateClass: async (id: string, data: any) => { const res = await api.put(`/fixed-assets/classes/${id}`, data); return res.data; },
  deleteClass: async (id: string) => { const res = await api.delete(`/fixed-assets/classes/${id}`); return res.data; },

  // Components
  getComponents: async (assetId: string) => { const res = await api.get(`/fixed-assets/${assetId}/components`); return res.data; },
  createComponent: async (assetId: string, data: any) => { const res = await api.post(`/fixed-assets/${assetId}/components`, data); return res.data; },
  updateComponent: async (componentId: string, data: any) => { const res = await api.put(`/fixed-assets/components/${componentId}`, data); return res.data; },
  deleteComponent: async (componentId: string) => { const res = await api.delete(`/fixed-assets/components/${componentId}`); return res.data; },

  // Revaluation
  revalueAsset: async (assetId: string, data: any) => { const res = await api.post(`/fixed-assets/${assetId}/revalue`, data); return res.data; },
  getRevaluations: async (assetId?: string) => { const res = await api.get('/fixed-assets/revaluations', { params: { assetId } }); return res.data; },

  // Impairment
  impairAsset: async (assetId: string, data: any) => { const res = await api.post(`/fixed-assets/${assetId}/impair`, data); return res.data; },
  getImpairments: async (assetId?: string) => { const res = await api.get('/fixed-assets/impairments', { params: { assetId } }); return res.data; },

  // Disposal
  disposeAsset: async (assetId: string, data: any) => { const res = await api.post(`/fixed-assets/${assetId}/dispose`, data); return res.data; },

  // Transfer
  transferAsset: async (assetId: string, data: any) => { const res = await api.post(`/fixed-assets/${assetId}/transfer`, data); return res.data; },
  getTransfers: async (assetId: string) => { const res = await api.get(`/fixed-assets/${assetId}/transfers`); return res.data; },

  // Maintenance
  addMaintenance: async (assetId: string, data: any) => { const res = await api.post(`/fixed-assets/${assetId}/maintenance`, data); return res.data; },
  getMaintenance: async (assetId: string) => { const res = await api.get(`/fixed-assets/${assetId}/maintenance`); return res.data; },

  // CWIP
  capitalizeCwip: async (data: any) => { const res = await api.post('/fixed-assets/capitalize-cwip', data); return res.data; },

  // IFRS Reports
  getAssetRegister: async () => { const res = await api.get('/fixed-assets/reports/register'); return res.data; },
  getAssetSummary: async () => { const res = await api.get('/fixed-assets/reports/summary'); return res.data; },
  getAssetAging: async () => { const res = await api.get('/fixed-assets/reports/aging'); return res.data; },
  getMovementSchedule: async (fromDate: string, toDate: string) => { const res = await api.get('/fixed-assets/reports/movement-schedule', { params: { fromDate, toDate } }); return res.data; },
};

// 7e. Depreciation History Endpoint
export const depreciationHistoryApi = {
  list: async () => { const res = await api.get('/fixed-assets/depreciation-history'); return res.data; },
};

// 7g. Audit Log Endpoints
export const auditLogApi = {
  getLogs: async (params?: any) => {
    const res = await api.get('/audit-log', { params });
    return res.data;
  },
  getAuditLogsPdf: async (params?: any) => {
    const res = await api.get('/audit-log/pdf', { params, responseType: 'blob' });
    return res.data;
  },
  getLogStats: async () => {
    const res = await api.get('/audit-log/stats');
    return res.data;
  },
  verifyChain: async () => {
    const res = await api.get('/audit-log/verify');
    return res.data;
  },
  getLogById: async (id: string) => {
    const res = await api.get(`/audit-log/${id}`);
    return res.data;
  },
};

// 8. Reports Endpoints
export const customReportsApi = {
  getCustomerSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/customer-summary', { params }); return res.data;
  },
  getSupplierSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/supplier-summary', { params }); return res.data;
  },
  getInventorySummary: async () => {
    const res = await api.get('/custom-reports/inventory-summary'); return res.data;
  },
  getCustomerStatements: async (params?: { customerId?: string; startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/customer-statements', { params }); return res.data;
  },
  getSupplierStatements: async (params?: { vendorId?: string; startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/supplier-statements', { params }); return res.data;
  },
  getSalesByCustomer: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/sales-by-customer', { params }); return res.data;
  },
  getSalesByItem: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/sales-by-item', { params }); return res.data;
  },
  getFixedAssetSummary: async () => {
    const res = await api.get('/custom-reports/fixed-asset-summary'); return res.data;
  },
  getExpenseClaimsSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/expense-claims-summary', { params }); return res.data;
  },
  getEmployeeSummary: async () => {
    const res = await api.get('/custom-reports/employee-summary'); return res.data;
  },
  getTaxSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/tax-summary', { params }); return res.data;
  },
  getReceiptsPaymentsSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/receipts-payments-summary', { params }); return res.data;
  },
  getBankAccountSummary: async () => {
    const res = await api.get('/custom-reports/bank-account-summary'); return res.data;
  },
  getCashEquivalents: async (params?: { asOfDate?: string }) => {
    const res = await api.get('/custom-reports/cash-equivalents', { params }); return res.data;
  },
  getCapitalAccountsSummary: async () => {
    const res = await api.get('/custom-reports/capital-accounts-summary'); return res.data;
  },
  getPayslipSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/payslip-summary', { params }); return res.data;
  },
  getPayslipByItem: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/payslip-by-item', { params }); return res.data;
  },
  getActualVsBudget: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/actual-vs-budget', { params }); return res.data;
  },
  getGlSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/gl-summary', { params }); return res.data;
  },
  getGlTransactions: async (params?: { startDate?: string; endDate?: string; accountId?: string }) => {
    const res = await api.get('/custom-reports/gl-transactions', { params }); return res.data;
  },
  getTaxTransactions: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/tax-transactions', { params }); return res.data;
  },
  getTaxableSalesPerCustomer: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/taxable-sales-per-customer', { params }); return res.data;
  },
  getTaxablePurchasesPerSupplier: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/taxable-purchases-per-supplier', { params }); return res.data;
  },
  getFixedAssetDepreciation: async () => {
    const res = await api.get('/custom-reports/fixed-asset-depreciation'); return res.data;
  },
  getIntangibleAssetsSummary: async () => {
    const res = await api.get('/custom-reports/intangible-assets-summary'); return res.data;
  },
  getIntangibleAssetAmortization: async () => {
    const res = await api.get('/custom-reports/intangible-asset-amortization'); return res.data;
  },
  getChangesInEquity: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/custom-reports/changes-in-equity', { params }); return res.data;
  },
};

export const reportsApi = {
  getTrialBalance: async (params: { startDate: string; endDate: string; format?: 'json' | 'pdf' | 'excel' | 'csv' }) => {
    const res = await api.get('/reports/trial-balance', { params, responseType: params.format === 'csv' || params.format === 'pdf' ? 'blob' : undefined });
    return res.data;
  },
  importTrialBalanceOpeningBalances: async (data: { csvData: string }) => {
    const res = await api.post('/reports/trial-balance/import-opening-balances', data);
    return res.data;
  },
  recordTrialBalanceOpeningBalances: async (data: { lines: { accountCode: string; debit: number; credit: number }[] }) => {
    const res = await api.post('/reports/trial-balance/record-opening-balances', data);
    return res.data;
  },
  setTrialBalanceOpeningBalances: async (data: { lines: { accountCode: string; openingBalance: number }[] }) => {
    const res = await api.post('/reports/trial-balance/set-opening-balances', data);
    return res.data;
  },

  getIncomeStatement: async (params: { startDate: string; endDate: string; format?: 'json' | 'pdf' | 'excel'; compareStart?: string; compareEnd?: string }) => {
    const res = await api.get('/reports/income-statement', { params, responseType: params.format === 'pdf' || params.format === 'excel' ? 'blob' : undefined });
    return res.data;
  },
  getBalanceSheet: async (params: { asOfDate?: string; compareAsOf?: string; format?: 'json' | 'pdf' | 'excel' }) => {
    const res = await api.get('/reports/balance-sheet', { params, responseType: params.format === 'pdf' || params.format === 'excel' ? 'blob' : undefined });
    return res.data;
  },
  getCashFlow: async (params: { startDate: string; endDate: string; format?: 'json' | 'pdf' | 'excel'; compareStart?: string; compareEnd?: string }) => {
    const res = await api.get('/reports/cash-flow', { params, responseType: params.format === 'pdf' || params.format === 'excel' ? 'blob' : undefined });
    return res.data;
  },
  getGeneralLedger: async (params: { accountId: string; startDate: string; endDate: string; format?: 'pdf' | 'excel' | 'json' }) => {
    const res = await api.get('/reports/general-ledger', { params });
    return res.data;
  },
  getAgedReceivables: async (params?: { format?: 'json' | 'pdf' | 'excel' }) => {
    const isBinary = params?.format === 'pdf' || params?.format === 'excel';
    const res = await api.get('/reports/aged-receivables', { params, responseType: isBinary ? 'blob' : undefined });
    return res.data;
  },
  getAgedPayables: async (params?: { format?: 'json' | 'pdf' | 'excel' }) => {
    const isBinary = params?.format === 'pdf' || params?.format === 'excel';
    const res = await api.get('/reports/aged-payables', { params, responseType: isBinary ? 'blob' : undefined });
    return res.data;
  },
  getPayrollSchedule: async (params: { runId: string; format?: 'pdf' | 'excel' }) => {
    const res = await api.get('/reports/payroll-schedule', { params });
    return res.data;
  },
  getCustomReportPdf: async (data: { title: string; headers: string[]; rows: any[][] }) => {
    const res = await api.post('/reports/custom/pdf', data, { responseType: 'blob' });
    return res.data;
  },
  getDashboardSummary: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/reports/dashboard-summary', { params });
    return res.data;
  },
  getDashboardMetrics: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/reports/dashboard-metrics', { params });
    return res.data;
  },
   getStatementOfChangesInEquity: async (params: { asOfDate: string; compareAsOf?: string; format?: 'json' | 'pdf' | 'excel' }) => {
    const isBinary = params.format === 'pdf' || params.format === 'excel';
    const res = await api.get('/reports/statement-of-changes-in-equity', { params, responseType: isBinary ? 'blob' : undefined });
    return res.data;
  },
  // Report Section Mappings
  getMappings: async (params?: { reportType?: string }) => {
    const res = await api.get('/reports/mappings', { params });
    return res.data;
  },
  saveMappings: async (data: { mappings: any[] }) => {
    const res = await api.put('/reports/mappings', data);
    return res.data;
  },
  applyMappings: async (data: { reportType: string; reportData: any }) => {
    const res = await api.post('/reports/mappings/apply', data);
    return res.data;
  },
  // Financial Notes
  getNotes: async (params?: { sourceReport?: string }) => {
    const res = await api.get('/reports/notes', { params });
    return res.data;
  },
  saveNote: async (data: any) => {
    const res = await api.post('/reports/notes', data);
    return res.data;
  },
  updateNote: async (id: string, data: any) => {
    const res = await api.put(`/reports/notes/${id}`, data);
    return res.data;
  },
  deleteNote: async (id: string) => {
    const res = await api.delete(`/reports/notes/${id}`);
    return res.data;
  },
  generateNotes: async (data: { reportDate: string; regenerate?: boolean }) => {
    const res = await api.post('/reports/notes/generate', data);
    return res.data;
  },
  // Consolidated Reports
  getConsolidated: async (params: { reportType: string; orgIds: string; startDate?: string; endDate?: string; asOfDate?: string }) => {
    const res = await api.get('/reports/consolidated', { params });
    return res.data;
  },
  // Usage Monitor
  getUsageDashboard: async () => { const res = await api.get('/reports/usage-monitor/dashboard'); return res.data; },
  checkUsageResource: async (resource: string) => { const res = await api.get(`/reports/usage-monitor/check/${resource}`); return res.data; },
  getUsageHistory: async (resource?: string) => { const res = await api.get('/reports/usage-monitor/history', { params: { resource } }); return res.data; },
};

// 9a. Legacy / Migration Endpoints
export const legacyApi = {
  getOrg: async () => { const res = await api.get('/org'); return res.data; },
  updateOrg: async (data: any) => { const res = await api.patch('/org', data); return res.data; },

  // Income Statements
  listIncomeStatements: async () => { const res = await api.get('/legacy/income-statements'); return res.data; },
  getIncomeStatement: async (fiscalYear: number) => { const res = await api.get(`/legacy/income-statements/${fiscalYear}`); return res.data; },
  upsertIncomeStatement: async (fiscalYear: number, data: any) => { const res = await api.put(`/legacy/income-statements/${fiscalYear}`, data); return res.data; },
  unlockIncomeStatement: async (fiscalYear: number) => { const res = await api.patch(`/legacy/income-statements/${fiscalYear}/unlock`); return res.data; },

  // Cash Flow Statements
  listCashFlowStatements: async () => { const res = await api.get('/legacy/cash-flow-statements'); return res.data; },
  getCashFlowStatement: async (fiscalYear: number) => { const res = await api.get(`/legacy/cash-flow-statements/${fiscalYear}`); return res.data; },
  upsertCashFlowStatement: async (fiscalYear: number, data: any) => { const res = await api.put(`/legacy/cash-flow-statements/${fiscalYear}`, data); return res.data; },
  unlockCashFlowStatement: async (fiscalYear: number) => { const res = await api.patch(`/legacy/cash-flow-statements/${fiscalYear}/unlock`); return res.data; },

  // SOCIE
  listSocieStatements: async () => { const res = await api.get('/legacy/statements-of-changes-in-equity'); return res.data; },
  getSocieStatement: async (fiscalYear: number) => { const res = await api.get(`/legacy/statements-of-changes-in-equity/${fiscalYear}`); return res.data; },
  upsertSocieStatement: async (fiscalYear: number, data: any) => { const res = await api.put(`/legacy/statements-of-changes-in-equity/${fiscalYear}`, data); return res.data; },
  unlockSocieStatement: async (fiscalYear: number) => { const res = await api.patch(`/legacy/statements-of-changes-in-equity/${fiscalYear}/unlock`); return res.data; },
};

// 9. Projects Endpoints
export const projectsApi = {
  list: async () => { const res = await api.get('/projects'); return res.data; },
  get: async (id: string) => { const res = await api.get(`/projects/${id}`); return res.data; },
  create: async (data: any) => { const res = await api.post('/projects', data); return res.data; },
  update: async (id: string, data: any) => { const res = await api.patch(`/projects/${id}`, data); return res.data; },
  delete: async (id: string) => { const res = await api.delete(`/projects/${id}`); return res.data; },
};

// 10. VAT Endpoints
export const taxApi = {
  getConfiguration: async (params?: { taxYear?: string }) => {
    const res = await api.get('/tax/configuration', { params });
    return res.data;
  },
  updateConfiguration: async (data: any) => {
    const res = await api.put('/tax/configuration', data);
    return res.data;
  },
  compute: async (params: { taxYear?: string; startDate?: string; endDate?: string }) => {
    const res = await api.get('/tax/compute', { params });
    return res.data;
  },
  post: async (data: { taxYear: string; startDate: string; endDate: string; confirmed?: boolean }) => {
    const res = await api.post('/tax/post', data);
    return res.data;
  },
  getCapitalAllowances: async (params?: { taxYear?: string }) => {
    const res = await api.get('/tax/capital-allowances', { params });
    return res.data;
  },
  saveCapitalAllowance: async (data: any) => {
    const res = await api.post('/tax/capital-allowances', data);
    return res.data;
  },
  deleteCapitalAllowance: async (id: string) => {
    const res = await api.delete(`/tax/capital-allowances/${id}`);
    return res.data;
  },
  getLosses: async () => {
    const res = await api.get('/tax/losses');
    return res.data;
  },
  getSchedule: async () => {
    const res = await api.get('/tax/schedule');
    return res.data;
  },
  // === NIGERIAN TAX ENGINE EXTENSIONS ===
  getDashboard: async () => {
    const res = await api.get('/tax/dashboard'); return res.data;
  },
  getPayeSchedules: async () => {
    const res = await api.get('/tax/paye-schedules'); return res.data;
  },
  getPayeScheduleById: async (id: string) => {
    const res = await api.get(`/tax/paye-schedules/${id}`); return res.data;
  },
  createPayeSchedule: async (data: any) => {
    const res = await api.post('/tax/paye-schedules', data); return res.data;
  },
  postPayeJournal: async (id: string, data: { date: string; bankAccountId?: string }) => {
    const res = await api.post(`/tax/paye-schedules/${id}/post`, data); return res.data;
  },
  getItfAssessments: async () => {
    const res = await api.get('/tax/itf-assessments'); return res.data;
  },
  createItfAssessment: async (data: any) => {
    const res = await api.post('/tax/itf-assessments', data); return res.data;
  },
  postItfJournal: async (id: string, data: { date: string }) => {
    const res = await api.post(`/tax/itf-assessments/${id}/post`, data); return res.data;
  },
  getStampDuty: async (params?: { fromDate?: string; toDate?: string }) => {
    const res = await api.get('/tax/stamp-duty', { params }); return res.data;
  },
  getStampDutySummary: async (params?: { fromDate?: string; toDate?: string }) => {
    const res = await api.get('/tax/stamp-duty/summary', { params }); return res.data;
  },
  createStampDuty: async (data: any) => {
    const res = await api.post('/tax/stamp-duty', data); return res.data;
  },
  getExemptions: async (params?: { taxType?: string; status?: string }) => {
    const res = await api.get('/tax/exemptions', { params }); return res.data;
  },
  createExemption: async (data: any) => {
    const res = await api.post('/tax/exemptions', data); return res.data;
  },
  updateExemptionStatus: async (id: string, status: string) => {
    const res = await api.patch(`/tax/exemptions/${id}/status`, { status }); return res.data;
  },
  getFirsReports: async (params?: { reportType?: string }) => {
    const res = await api.get('/tax/firs-reports', { params }); return res.data;
  },
  generateFirsReport: async (data: any) => {
    const res = await api.post('/tax/firs-reports/generate', data); return res.data;
  },
  fileFirsReport: async (id: string) => {
    const res = await api.post(`/tax/firs-reports/${id}/file`); return res.data;
  },
  getAutoTaxJournals: async (params?: { taxType?: string; fromDate?: string; toDate?: string }) => {
    const res = await api.get('/tax/auto-journals', { params }); return res.data;
  },
};

export const vatApi = {
  getReturn: async (params: { startDate: string; endDate: string }) => {
    const res = await api.get('/vat/return', { params });
    return res.data;
  },
  settle: async (data: { startDate: string; endDate: string; totalOutputVat: number; totalInputVat: number; excessInputBroughtForward?: number }) => {
    const res = await api.post('/vat/settle', data);
    return res.data;
  },
  getPeriods: async () => {
    const res = await api.get('/vat/periods');
    return res.data;
  },
  getSettings: async () => {
    const res = await api.get('/vat/settings');
    return res.data;
  },
  updateSettings: async (data: any) => {
    const res = await api.put('/vat/settings', data);
    return res.data;
  },
};

// 11. IFRS 15 Revenue Recognition Endpoints
export const revenueApi = {
  listContracts: async () => {
    const res = await api.get('/revenue/contracts');
    return res.data;
  },
  getContract: async (id: string) => {
    const res = await api.get(`/revenue/contracts/${id}`);
    return res.data;
  },
  createContract: async (data: any) => {
    const res = await api.post('/revenue/contracts', data);
    return res.data;
  },
  updateContract: async (id: string, data: any) => {
    const res = await api.put(`/revenue/contracts/${id}`, data);
    return res.data;
  },
  deleteContract: async (id: string) => {
    const res = await api.delete(`/revenue/contracts/${id}`);
    return res.data;
  },
  // Obligations
  getObligations: async (contractId: string) => {
    const res = await api.get(`/revenue/contracts/${contractId}/obligations`);
    return res.data;
  },
  getObligation: async (id: string) => {
    const res = await api.get(`/revenue/obligations/${id}`);
    return res.data;
  },
  createObligation: async (data: any) => {
    const res = await api.post('/revenue/obligations', data);
    return res.data;
  },
  updateObligation: async (id: string, data: any) => {
    const res = await api.put(`/revenue/obligations/${id}`, data);
    return res.data;
  },
  deleteObligation: async (id: string) => {
    const res = await api.delete(`/revenue/obligations/${id}`);
    return res.data;
  },
  // Schedules
  getSchedules: async (obligationId: string) => {
    const res = await api.get(`/revenue/obligations/${obligationId}/schedules`);
    return res.data;
  },
  addManualSchedule: async (obligationId: string, data: any) => {
    const res = await api.post(`/revenue/obligations/${obligationId}/schedules`, data);
    return res.data;
  },
  generateSchedule: async (obligationId: string, data: any) => {
    const res = await api.post(`/revenue/obligations/${obligationId}/generate-schedule`, data);
    return res.data;
  },
  // Recognition
  recognizeSchedule: async (scheduleId: string, data?: any) => {
    const res = await api.post(`/revenue/recognize/${scheduleId}`, data || {});
    return res.data;
  },
  recognizeAll: async (data?: any) => {
    const res = await api.post('/revenue/recognize-all', data || {});
    return res.data;
  },
  // Reports
  getRecognitionReport: async (params?: { startDate?: string; endDate?: string }) => {
    const res = await api.get('/revenue/recognition-report', { params });
    return res.data;
  },
  getDeferredSummary: async (params?: { asOfDate?: string }) => {
    const res = await api.get('/revenue/deferred-summary', { params });
    return res.data;
  },
};

// 9. IFRS 16 Lease Accounting Endpoints
export const leaseApi = {
  listLeases: async (): Promise<any[]> => {
    const res = await api.get('/leases');
    return res.data;
  },
  getLease: async (id: string): Promise<any> => {
    const res = await api.get(`/leases/${id}`);
    return res.data;
  },
  createLease: async (data: any): Promise<any> => {
    const res = await api.post('/leases', data);
    return res.data;
  },
  updateLease: async (id: string, data: any): Promise<any> => {
    const res = await api.put(`/leases/${id}`, data);
    return res.data;
  },
  postCommencement: async (id: string): Promise<any> => {
    const res = await api.post(`/leases/${id}/commencement`);
    return res.data;
  },
  processPayment: async (id: string, periodNumber: number, paymentDate?: string): Promise<any> => {
    const res = await api.post(`/leases/${id}/payments`, { periodNumber, paymentDate });
    return res.data;
  },
  batchProcessPayments: async (id: string, upToPeriod?: number): Promise<any> => {
    const res = await api.post(`/leases/${id}/payments/batch`, { upToPeriod });
    return res.data;
  },
  postDepreciation: async (id: string, periodNumber: number): Promise<any> => {
    const res = await api.post(`/leases/${id}/depreciation`, { periodNumber });
    return res.data;
  },
  batchPostDepreciation: async (id: string, upToPeriod?: number): Promise<any> => {
    const res = await api.post(`/leases/${id}/depreciation/batch`, { upToPeriod });
    return res.data;
  },
  modifyLease: async (id: string, data: any): Promise<any> => {
    const res = await api.post(`/leases/${id}/modify`, data);
    return res.data;
  },
  terminateLease: async (id: string, terminationDate: string): Promise<any> => {
    const res = await api.post(`/leases/${id}/terminate`, { terminationDate });
    return res.data;
  },
  getLeaseReport: async (): Promise<any> => {
    const res = await api.get('/leases/report');
    return res.data;
  },
};

export function downloadBlob(blob: Blob, filename: string) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Download failed. Please try again or contact support.', type: 'error' } }));
    console.error('Download error:', e);
  }
}

export interface OrgPrintInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}

let _orgInfo: OrgPrintInfo | null = null;

export function setPrintOrgInfo(info: OrgPrintInfo | null) {
  _orgInfo = info;
}

export function printWindow(title: string, bodyHtml: string, subtitle?: string) {
  const org = _orgInfo;
  const logoHtml = org?.logoUrl ? `<img src="${org.logoUrl}" alt="" style="max-height:48px;max-width:160px;object-fit:contain" />` : '';
  const orgDetails = [org?.address, org?.phone, org?.email].filter(Boolean).join(' &bull; ');
  const html = `<!DOCTYPE html><html><head><title>${title}</title><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#1e293b}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0f172a}
    .org-info{display:flex;align-items:center;gap:12px}
    .org-name{font-size:15px;font-weight:700;color:#0f172a}
    .org-details{font-size:11px;color:#64748b;margin-top:2px}
    .title{font-size:18px;font-weight:700;color:#0f172a}
    .date{font-size:11px;color:#64748b;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em}
    td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;vertical-align:top}
    tr:nth-child(even) td{background:#f8fafc}
    .footer{margin-top:40px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
    .r{text-align:right} .c{text-align:center}
    @media print{body{padding:20px;color-adjust:exact;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style></head><body>
  <div class="header">
    <div><div class="org-info">${logoHtml}<div><div class="org-name">${org?.name || 'SkyBooks'}</div>${orgDetails ? `<div class="org-details">${orgDetails}</div>` : '<div class="org-details">By Skyhouse Accountants &amp; Technologies</div>'}</div></div></div>
    <div style="text-align:right"><div class="title">${title}</div>${subtitle ? `<div class="date">${subtitle}</div>` : ''}<div class="date">Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div></div>
  </div>
  ${bodyHtml}
  <div class="footer">${org?.name || 'SkyBooks'} &bull; Confidential</div>
  </body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.name = 'printPopup'; setTimeout(() => { try { w.print(); } catch(e) {} }, 1500); }
  else { window.dispatchEvent(new CustomEvent('app:toast', { detail: { message: 'Popup blocked. Please allow popups for this site and try again.', type: 'warning' } })); }
}

export function apiDownload(url: string, filename: string) {
  const token = localStorage.getItem('accessToken');
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${sep}token=${encodeURIComponent(token || '')}`;
  const a = document.createElement('a');
  a.href = fullUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export const emailSettingsApi = {
  get: () => api.get('/email-settings'),
  save: (data: any) => api.post('/email-settings', data),
  test: (data: any) => api.post('/email-settings/test', data),
  reset: () => api.delete('/email-settings'),
};

export const postingRulesApi = {
  list: async (source?: string) => {
    const res = await api.get('/accountant/posting-rules', { params: source ? { source } : {} });
    return res.data;
  },
  create: async (data: {
    name: string;
    source: string;
    eventType?: string;
    accountRole?: string;
    accountId?: string;
    priority?: number;
  }) => {
    const res = await api.post('/accountant/posting-rules', data);
    return res.data;
  },
  deactivate: (id: string) => api.delete(`/accountant/posting-rules/${id}`),
};

// 11. IFRS 9 Expected Credit Loss Endpoints
export const eclApi = {
  getParameters: async (): Promise<any[]> => {
    const res = await api.get('/ecl/parameters');
    return res.data;
  },
  saveParameters: async (data: any[]): Promise<any[]> => {
    const res = await api.put('/ecl/parameters', data);
    return res.data;
  },
  compute: async (asOfDate?: string): Promise<any> => {
    const res = await api.get('/ecl/compute', { params: { asOfDate } });
    return res.data;
  },
  postProvision: async (asOfDate?: string): Promise<any> => {
    const res = await api.post('/ecl/post', { asOfDate });
    return res.data;
  },
  getHistory: async (): Promise<any[]> => {
    const res = await api.get('/ecl/history');
    return res.data;
  },
  getHistoryDetail: async (id: string): Promise<any> => {
    const res = await api.get(`/ecl/history/${id}`);
    return res.data;
  },
};

export const inventoryApi = {
  getTransfers: async (): Promise<any[]> => {
    const res = await api.get('/inventory/transfers'); return res.data;
  },
  getTransferById: async (id: string): Promise<any> => {
    const res = await api.get(`/inventory/transfers/${id}`); return res.data;
  },
  createTransfer: async (data: any): Promise<any> => {
    const res = await api.post('/inventory/transfers', data); return res.data;
  },
  getStockCounts: async (): Promise<any[]> => {
    const res = await api.get('/inventory/stock-counts'); return res.data;
  },
  getStockCountById: async (id: string): Promise<any> => {
    const res = await api.get(`/inventory/stock-counts/${id}`); return res.data;
  },
  createStockCount: async (data: any): Promise<any> => {
    const res = await api.post('/inventory/stock-counts', data); return res.data;
  },
  applyStockCount: async (id: string): Promise<any> => {
    const res = await api.post(`/inventory/stock-counts/${id}/apply`); return res.data;
  },
  getWriteoffs: async (): Promise<any[]> => {
    const res = await api.get('/inventory/writeoffs'); return res.data;
  },
  getWriteoffById: async (id: string): Promise<any> => {
    const res = await api.get(`/inventory/writeoffs/${id}`); return res.data;
  },
  createWriteoff: async (data: any): Promise<any> => {
    const res = await api.post('/inventory/writeoffs', data); return res.data;
  },
  postWriteoff: async (id: string): Promise<any> => {
    const res = await api.post(`/inventory/writeoffs/${id}/post`); return res.data;
  },
  getLandedCosts: async (): Promise<any[]> => {
    const res = await api.get('/inventory/landed-costs'); return res.data;
  },
  getLandedCostById: async (id: string): Promise<any> => {
    const res = await api.get(`/inventory/landed-costs/${id}`); return res.data;
  },
  createLandedCost: async (data: any): Promise<any> => {
    const res = await api.post('/inventory/landed-costs', data); return res.data;
  },
  allocateLandedCost: async (id: string): Promise<any> => {
    const res = await api.post(`/inventory/landed-costs/${id}/allocate`); return res.data;
  },
  getValuation: async (asOfDate?: string): Promise<any[]> => {
    const res = await api.get('/inventory/valuation', { params: { asOfDate } }); return res.data;
  },
  getAging: async (): Promise<any[]> => {
    const res = await api.get('/inventory/aging'); return res.data;
  },
  getTurnover: async (fromDate: string, toDate: string): Promise<any> => {
    const res = await api.get('/inventory/turnover', { params: { fromDate, toDate } }); return res.data;
  },
  getStockStatus: async (): Promise<any[]> => {
    const res = await api.get('/inventory/stock-status'); return res.data;
  },
};

// ===== APPROVAL WORKFLOW API =====
export const approvalApi = {
  getWorkflows: async (): Promise<any[]> => {
    const res = await api.get('/approval/workflows'); return res.data;
  },
  setWorkflow: async (module: string, level: number): Promise<any> => {
    const res = await api.put('/approval/workflows', { module, level }); return res.data;
  },
  deleteWorkflow: async (module: string): Promise<any> => {
    const res = await api.delete(`/approval/workflows/${module}`); return res.data;
  },
  getHistory: async (module: string, entityId: string): Promise<any[]> => {
    const res = await api.get(`/approval/history/${module}/${entityId}`); return res.data;
  },
};

export const assistantApi = {
  query: async (query: string): Promise<any> => {
    const res = await api.post('/assistant/query', { query }); return res.data;
  },
  queryByCapability: async (capability: string, query?: string): Promise<any> => {
    const res = await api.post(`/assistant/query/${capability}`, { query }); return res.data;
  },
  getCapabilities: async (): Promise<any> => {
    const res = await api.get('/assistant/capabilities'); return res.data;
  },
};

export const ocrApi = {
  upload: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/ocr/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  list: async (params?: { status?: string; docType?: string; limit?: number }): Promise<any> => {
    const res = await api.get('/ocr/documents', { params }); return res.data;
  },
  get: async (id: string): Promise<any> => {
    const res = await api.get(`/ocr/documents/${id}`); return res.data;
  },
  reprocess: async (id: string): Promise<any> => {
    const res = await api.post(`/ocr/documents/${id}/reprocess`); return res.data;
  },
  confirm: async (id: string, data: { suggestedJournal: any }): Promise<any> => {
    const res = await api.post(`/ocr/documents/${id}/confirm`, data); return res.data;
  },
  delete: async (id: string): Promise<any> => {
    const res = await api.delete(`/ocr/documents/${id}`); return res.data;
  },
};

export const featureFlagApi = {
  list: async (category?: string) => { const res = await api.get('/feature-flags', { params: { category } }); return res.data; },
  get: async (code: string) => { const res = await api.get(`/feature-flags/${code}`); return res.data; },
  evaluate: async (code: string, userId?: string) => { const res = await api.get(`/feature-flags/evaluate/${code}`, { params: { userId } }); return res.data; },
  evaluateAll: async (userId?: string) => { const res = await api.get('/feature-flags/evaluate', { params: { userId } }); return res.data; },
  getOrgOverrides: async () => { const res = await api.get('/feature-flags/org'); return res.data; },
  setOrgOverride: async (code: string, data: { state?: string; usageLimit?: number }) => { const res = await api.put(`/feature-flags/org/${code}`, data); return res.data; },
  resetOrgOverride: async (code: string) => { const res = await api.delete(`/feature-flags/org/${code}`); return res.data; },
  getPlanFlags: async (planId: string) => { const res = await api.get(`/feature-flags/plan/${planId}`); return res.data; },
  setPlanFlag: async (planId: string, code: string, data: { state: string; usageLimit?: number }) => { const res = await api.put(`/feature-flags/plan/${planId}/${code}`, data); return res.data; },
  bulkSetPlanFlags: async (planId: string, flags: Array<{ featureCode: string; state: string; usageLimit?: number }>) => { const res = await api.put(`/feature-flags/plan/${planId}/bulk`, { flags }); return res.data; },
};

export const promotionsEngineApi = {
  // Campaigns
  listCampaigns: async (orgId?: string) => { const res = await api.get('/promotions/campaigns', { params: { orgId } }); return res.data; },
  getCampaign: async (id: string) => { const res = await api.get(`/promotions/campaigns/${id}`); return res.data; },
  createCampaign: async (data: any) => { const res = await api.post('/promotions/campaigns', data); return res.data; },
  updateCampaign: async (id: string, data: any) => { const res = await api.put(`/promotions/campaigns/${id}`, data); return res.data; },
  deleteCampaign: async (id: string) => { const res = await api.delete(`/promotions/campaigns/${id}`); return res.data; },

  // Referrals
  listReferrals: async (orgId?: string) => { const res = await api.get('/promotions/referrals', { params: { orgId } }); return res.data; },
  getReferral: async (id: string) => { const res = await api.get(`/promotions/referrals/${id}`); return res.data; },
  createReferral: async (data: any) => { const res = await api.post('/promotions/referrals', data); return res.data; },
  updateReferral: async (id: string, data: any) => { const res = await api.put(`/promotions/referrals/${id}`, data); return res.data; },
  deleteReferral: async (id: string) => { const res = await api.delete(`/promotions/referrals/${id}`); return res.data; },

  // Partners
  listPartners: async (orgId?: string) => { const res = await api.get('/promotions/partners', { params: { orgId } }); return res.data; },
  getPartner: async (id: string) => { const res = await api.get(`/promotions/partners/${id}`); return res.data; },
  createPartner: async (data: any) => { const res = await api.post('/promotions/partners', data); return res.data; },
  updatePartner: async (id: string, data: any) => { const res = await api.put(`/promotions/partners/${id}`, data); return res.data; },
  deletePartner: async (id: string) => { const res = await api.delete(`/promotions/partners/${id}`); return res.data; },

  // Redemptions
  listRedemptions: async (orgId: string, filters?: { type?: string; subscriptionId?: string; invoiceId?: string }) => {
    const res = await api.get('/promotions/redemptions', { params: { orgId, ...filters } }); return res.data;
  },

  // Application
  applyDiscounts: async (data: { orgId: string; planId: string; amountKobo: number; couponCode?: string; referralCode?: string; partnerCode?: string; isFirstOrder?: boolean; region?: string }) => {
    const res = await api.post('/promotions/apply', data); return res.data;
  },
  autoApply: async (data: { orgId: string; planId: string; amountKobo: number; isFirstOrder?: boolean; region?: string }) => {
    const res = await api.post('/promotions/auto-apply', data); return res.data;
  },
  recordRedemption: async (data: any) => { const res = await api.post('/promotions/record', data); return res.data; },

  // Extended coupon/promotion CRUD (for admin UI)
  createCouponExtended: async (data: any) => { const res = await api.post('/promotions/coupons', data); return res.data; },
  updateCouponExtended: async (id: string, data: any) => { const res = await api.put(`/promotions/coupons/${id}`, data); return res.data; },
  createPromotionExtended: async (data: any) => { const res = await api.post('/promotions/promotions', data); return res.data; },
  updatePromotionExtended: async (id: string, data: any) => { const res = await api.put(`/promotions/promotions/${id}`, data); return res.data; },
};

export const supportApi = {
  getTickets: async (params?: { status?: string; priority?: string }) => { const res = await api.get('/support', { params }); return res.data; },
  getAllTickets: async (params?: { status?: string; priority?: string }) => { const res = await api.get('/support/all', { params }); return res.data; },
  getTicket: async (id: string) => { const res = await api.get(`/support/${id}`); return res.data; },
  createTicket: async (data: { subject: string; message: string; category?: string; priority?: string }) => { const res = await api.post('/support', data); return res.data; },
  addMessage: async (id: string, data: { message: string; isInternal?: boolean }) => { const res = await api.post(`/support/${id}/messages`, data); return res.data; },
  updateStatus: async (id: string, data: { status: string; resolution?: string; assignedTo?: string }) => { const res = await api.put(`/support/${id}/status`, data); return res.data; },
};

export const announcementApi = {
  getAnnouncements: async (orgId?: string) => { const res = await api.get('/announcements', { params: { orgId } }); return res.data; },
  createAnnouncement: async (data: any) => { const res = await api.post('/announcements', data); return res.data; },
  dismissAnnouncement: async (id: string) => { const res = await api.post(`/announcements/${id}/dismiss`); return res.data; },
};

export const subscriptionApi = {
  // Plans
  listPlans: async (publicOnly?: boolean) => { const res = await api.get('/subscriptions/plans', { params: { publicOnly } }); return res.data; },
  getPlan: async (id: string) => { const res = await api.get(`/subscriptions/plans/${id}`); return res.data; },
  createPlan: async (data: any) => { const res = await api.post('/subscriptions/plans', data); return res.data; },
  updatePlan: async (id: string, data: any) => { const res = await api.put(`/subscriptions/plans/${id}`, data); return res.data; },
  deletePlan: async (id: string) => { const res = await api.delete(`/subscriptions/plans/${id}`); return res.data; },

  // Subscriptions
  getMySubscription: async () => { const res = await api.get('/subscriptions/'); return res.data; },
  createSubscription: async (data: { planId: string; couponCode?: string; promotionId?: string; billingCycle?: string }) => { const res = await api.post('/subscriptions/', data); return res.data; },
  changePlan: async (id: string, data: { planId: string; prorate?: boolean }) => { const res = await api.put(`/subscriptions/${id}/plan`, data); return res.data; },
  cancelSubscription: async (id: string, atPeriodEnd?: boolean) => { const res = await api.post(`/subscriptions/${id}/cancel`, { atPeriodEnd }); return res.data; },
  renewSubscription: async (id: string) => { const res = await api.post(`/subscriptions/${id}/renew`); return res.data; },

  // Coupons
  listCoupons: async () => { const res = await api.get('/subscriptions/coupons'); return res.data; },
  getCoupon: async (id: string) => { const res = await api.get(`/subscriptions/coupons/${id}`); return res.data; },
  createCoupon: async (data: any) => { const res = await api.post('/subscriptions/coupons', data); return res.data; },
  validateCoupon: async (data: { code: string; planId?: string; amountKobo?: number }) => { const res = await api.post('/subscriptions/coupons/validate', data); return res.data; },

  // Promotions
  listPromotions: async () => { const res = await api.get('/subscriptions/promotions'); return res.data; },
  getPromotion: async (id: string) => { const res = await api.get(`/subscriptions/promotions/${id}`); return res.data; },
  createPromotion: async (data: any) => { const res = await api.post('/subscriptions/promotions', data); return res.data; },
  updatePromotion: async (id: string, data: any) => { const res = await api.put(`/subscriptions/promotions/${id}`, data); return res.data; },

  // Invoices
  listInvoices: async (subscriptionId?: string) => { const res = await api.get('/subscriptions/invoices', { params: { subscriptionId } }); return res.data; },

  // Entitlements & Usage
  getEntitlements: async () => { const res = await api.get('/subscriptions/entitlements'); return res.data; },
  checkFeatureAccess: async (featureKey: string) => { const res = await api.get('/subscriptions/entitlements/check', { params: { featureKey } }); return res.data; },
  recordUsage: async (data: { featureKey: string; count?: number }) => { const res = await api.post('/subscriptions/usage', data); return res.data; },
  getUsage: async (featureKey?: string) => { const res = await api.get('/subscriptions/usage', { params: { featureKey } }); return res.data; },
  checkUsageLimit: async (featureKey: string) => { const res = await api.get('/subscriptions/usage/check-limit', { params: { featureKey } }); return res.data; },

  // Lifecycle methods
  pause: async (id: string, pauseDays?: number) => { const res = await api.post(`/subscriptions/${id}/pause`, { pauseDays }); return res.data; },
  resume: async (id: string) => { const res = await api.post(`/subscriptions/${id}/resume`); return res.data; },
  cancelAtPeriodEnd: async (id: string, reason?: string) => { const res = await api.post(`/subscriptions/${id}/cancel`, { reason }); return res.data; },
  cancelNow: async (id: string, reason?: string) => { const res = await api.post(`/subscriptions/${id}/cancel-now`, { reason }); return res.data; },
  scheduleChange: async (id: string, planId: string, changeType: string) => { const res = await api.post(`/subscriptions/${id}/schedule-change`, { planId, changeType }); return res.data; },
  getHistory: async (id: string) => { const res = await api.get(`/subscriptions/${id}/history`); return res.data; },
  checkAccess: async (id: string) => { const res = await api.get(`/subscriptions/${id}/access`); return res.data; },

  // Billing/Payment methods
  getGatewayConfigs: async () => { const res = await api.get('/subscriptions/billing/gateway-config'); return res.data; },
  saveGatewayConfig: async (data: any) => { const res = await api.put('/subscriptions/billing/gateway-config', data); return res.data; },
  getDefaultGateway: async () => { const res = await api.get('/subscriptions/billing/gateway-default'); return res.data; },
  initializePayment: async (data: { invoiceId: string; gateway?: string; channels?: string[] }) => { const res = await api.post('/subscriptions/billing/initialize', data); return res.data; },
  verifyPayment: async (data: { reference: string; invoiceId: string }) => { const res = await api.post('/subscriptions/billing/verify', data); return res.data; },
  retryPayment: async (data: { invoiceId: string; gateway?: string; channels?: string[] }) => { const res = await api.post('/subscriptions/billing/retry', data); return res.data; },
  getPaymentHistory: async (subscriptionId?: string) => { const res = await api.get('/subscriptions/billing/payments', { params: { subscriptionId } }); return res.data; },
  getPaymentStats: async () => { const res = await api.get('/subscriptions/billing/payments/stats'); return res.data; },
  getReceiptUrl: (paymentId: string) => `/subscriptions/billing/receipts/${paymentId}`,

  // Portal
  getPortalDashboard: async () => { const res = await api.get('/subscriptions/portal/dashboard'); return res.data; },
  changeBillingCycle: async (billingCycle: string) => { const res = await api.put('/subscriptions/portal/billing-cycle', { billingCycle }); return res.data; },
  getPortalPaymentMethodLink: async () => { const res = await api.get('/subscriptions/portal/payment-method-link'); return res.data; },
  redeemPortalCoupon: async (code: string) => { const res = await api.post('/subscriptions/portal/redeem-coupon', { code }); return res.data; },
  downloadInvoice: async (id: string) => { const res = await api.get(`/subscriptions/portal/invoices/${id}/download`, { responseType: 'blob' }); return res.data; },
  requestRefund: async (invoiceId: string, reason: string) => { const res = await api.post('/subscriptions/portal/refund', { invoiceId, reason }); return res.data; },
  getPortalUsage: async () => { const res = await api.get('/subscriptions/portal/usage'); return res.data; },
  listPortalAddons: async () => { const res = await api.get('/subscriptions/portal/addons'); return res.data; },
  createPortalAddon: async (data: any) => { const res = await api.post('/subscriptions/portal/addons', data); return res.data; },
  removePortalAddon: async (id: string) => { const res = await api.delete(`/subscriptions/portal/addons/${id}`); return res.data; },

  // Marketplace Add-ons
  listMarketplaceAddons: async () => { const res = await api.get('/subscriptions/addons/marketplace'); return res.data; },
  getMarketplaceAddon: async (id: string) => { const res = await api.get(`/subscriptions/addons/marketplace/${id}`); return res.data; },
  listMyAddons: async () => { const res = await api.get('/subscriptions/addons/my'); return res.data; },
  purchaseAddon: async (data: { productId: string; quantity?: number; billingCycle?: string; autoRenew?: boolean }) => { const res = await api.post('/subscriptions/addons/purchase', data); return res.data; },
  cancelAddon: async (id: string) => { const res = await api.post(`/subscriptions/addons/${id}/cancel`); return res.data; },
  reactivateAddon: async (id: string) => { const res = await api.post(`/subscriptions/addons/${id}/reactivate`); return res.data; },
  updateAddonQuantity: async (id: string, quantity: number) => { const res = await api.put(`/subscriptions/addons/${id}/quantity`, { quantity }); return res.data; },
  toggleAddonAutoRenew: async (id: string, autoRenew: boolean) => { const res = await api.put(`/subscriptions/addons/${id}/auto-renew`, { autoRenew }); return res.data; },
  getEffectiveLimits: async () => { const res = await api.get('/subscriptions/addons/effective-limits'); return res.data; },

  // Billing Engine
  listBillingInvoices: async (params?: { status?: string }) => { const res = await api.get('/subscriptions/billing/invoices', { params }); return res.data; },
  getBillingInvoice: async (id: string) => { const res = await api.get(`/subscriptions/billing/invoices/${id}`); return res.data; },
  generateBillingInvoice: async (data: any) => { const res = await api.post('/subscriptions/billing/invoices/generate', data); return res.data; },
  downloadBillingInvoicePdf: async (id: string) => { const res = await api.get(`/subscriptions/billing/invoices/${id}/pdf`, { responseType: 'blob' }); return res.data; },
  emailBillingInvoice: async (id: string) => { const res = await api.post(`/subscriptions/billing/invoices/${id}/email`); return res.data; },
  listBillingCreditNotes: async () => { const res = await api.get('/subscriptions/billing/credit-notes'); return res.data; },
  createBillingCreditNote: async (data: { invoiceId?: string; subscriptionId?: string; reason: string; amountKobo: number; taxKobo?: number }) => { const res = await api.post('/subscriptions/billing/credit-notes', data); return res.data; },
  refundBillingInvoice: async (invoiceId: string, reason: string, amountKobo?: number) => { const res = await api.post('/subscriptions/billing/refund', { invoiceId, reason, amountKobo }); return res.data; },
  getBillingTaxRates: async () => { const res = await api.get('/subscriptions/billing/tax-rates'); return res.data; },
  saveBillingTaxRate: async (data: { name: string; rate: number; type?: string; isDefault?: boolean; description?: string }) => { const res = await api.post('/subscriptions/billing/tax-rates', data); return res.data; },
  deleteBillingTaxRate: async (id: string) => { const res = await api.delete(`/subscriptions/billing/tax-rates/${id}`); return res.data; },
  getBillingOutstanding: async () => { const res = await api.get('/subscriptions/billing/outstanding'); return res.data; },
  getBillingHistory: async () => { const res = await api.get('/subscriptions/billing/history'); return res.data; },
  handleBillingInvoiceFailure: async (id: string) => { const res = await api.post(`/subscriptions/billing/invoices/${id}/handle-failure`); return res.data; },
  generateBillingAccountingEntries: async (id: string) => { const res = await api.post(`/subscriptions/billing/invoices/${id}/accounting-entries`); return res.data; },
  generateBillingRenewals: async () => { const res = await api.post('/subscriptions/billing/generate-renewals'); return res.data; },
  calculateBillingProration: async (data: { oldMonthlyKobo: number; newMonthlyKobo: number; daysRemaining: number; daysInPeriod?: number }) => { const res = await api.post('/subscriptions/billing/calculate-proration', data); return res.data; },
};



