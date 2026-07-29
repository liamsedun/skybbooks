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

// ── Auth scope helpers (customer vs platform) ──
function getAuthPrefix(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname.startsWith('/platform') ? 'platform_' : '';
}

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
      config.url.includes('/auth/signup') ||
      config.url.includes('/auth/plans') ||
      config.url.includes('/platform/auth/login') ||
      config.url.includes('/platform/auth/refresh') ||
      config.url.includes('/platform/auth/logout') ||
      config.url.includes('/auth/refresh') ||
      config.url.includes('/auth/logout') ||
      config.url.includes('/org/invite/')
    );

    if (isAuthEndpoint) {
      return config;
    }

    const prefix = getAuthPrefix();
    const token = localStorage.getItem(prefix + 'accessToken');
    if (!token) {
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
      if (typeof window !== 'undefined' && localStorage.getItem('demo_mode_active') === 'true') {
        return Promise.reject(error);
      }
      const prefix = getAuthPrefix();

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

      const refreshToken = localStorage.getItem(prefix + 'refreshToken');

      if (!refreshToken) {
        isRefreshing = false;
        clearAuthData();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject(error);
      }

      try {
        const refreshUrl = prefix === 'platform_' ? '/platform/auth/refresh' : '/auth/refresh';
        const response = await axios.post(`${API_URL}${refreshUrl}`, { refreshToken });
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem(prefix + 'accessToken', newAccessToken);
        localStorage.setItem(prefix + 'refreshToken', newRefreshToken);

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
        const loginUrl = prefix === 'platform_' ? '/platform/login' : '/login';
        window.location.href = loginUrl;
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

function clearAuthData() {
  const prefix = getAuthPrefix();
  localStorage.removeItem(prefix + 'accessToken');
  localStorage.removeItem(prefix + 'refreshToken');
  localStorage.removeItem(prefix + 'user');
  localStorage.removeItem(prefix + 'organisation');
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
  platformLogin: async (data: any) => {
    const res = await api.post('/platform/auth/login', data);
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
  platformRefresh: async (refreshToken: string) => {
    const res = await api.post('/platform/auth/refresh', { refreshToken });
    return res.data;
  },
  logout: async (refreshToken?: string) => {
    const res = await api.post('/auth/logout', { refreshToken });
    clearAuthData();
    return res.data;
  },
  platformLogout: async (refreshToken?: string) => {
    const res = await api.post('/platform/auth/logout', { refreshToken });
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
  inviteUser: async (data: { fullName: string; email: string; role: string }) => {
    const res = await api.post('/org/users/invite', data);
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
  deleteUser: async (userId: string) => {
    const res = await api.delete(`/org/users/${userId}`);
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
  getGatewayConfig: async () => {
    const res = await api.get('/banking/payment-gateway/config');
    return res.data;
  },
  saveGatewayConfig: async (gateway: string, data: { publicKey?: string; secretKey?: string; webhookSecret?: string; environment?: string; isActive?: boolean; isDefault?: boolean }) => {
    const res = await api.put(`/banking/payment-gateway/config/${gateway}`, data);
    return res.data;
  },
  disconnectGateway: async (gateway: string) => {
    const res = await api.delete(`/banking/payment-gateway/config/${gateway}`);
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
  getActiveAnnouncements: async () => { const res = await api.get('/announcements/active'); return res.data; },
  createAnnouncement: async (data: any) => { const res = await api.post('/announcements', data); return res.data; },
  dismissAnnouncement: async (id: string) => { const res = await api.post(`/announcements/${id}/dismiss`); return res.data; },
};

export const subscriptionApi = {
  // Plans
  listPlans: async (publicOnly?: boolean) => { const res = await api.get('/platform/subscriptions/plans', { params: { publicOnly } }); return res.data; },
  getPlan: async (id: string) => { const res = await api.get(`/platform/subscriptions/plans/${id}`); return res.data; },
  createPlan: async (data: any) => { const res = await api.post('/platform/subscriptions/plans', data); return res.data; },
  updatePlan: async (id: string, data: any) => { const res = await api.put(`/platform/subscriptions/plans/${id}`, data); return res.data; },
  deletePlan: async (id: string) => { const res = await api.delete(`/platform/subscriptions/plans/${id}`); return res.data; },

  // Subscriptions
  getMySubscription: async () => { const res = await api.get('/platform/subscriptions/'); return res.data; },
  createSubscription: async (data: { planId: string; couponCode?: string; promotionId?: string; billingCycle?: string }) => { const res = await api.post('/platform/subscriptions/', data); return res.data; },
  changePlan: async (id: string, data: { planId: string; prorate?: boolean }) => { const res = await api.put(`/platform/subscriptions/${id}/plan`, data); return res.data; },
  cancelSubscription: async (id: string, atPeriodEnd?: boolean) => { const res = await api.post(`/platform/subscriptions/${id}/cancel`, { atPeriodEnd }); return res.data; },
  renewSubscription: async (id: string) => { const res = await api.post(`/platform/subscriptions/${id}/renew`); return res.data; },

  // Coupons
  listCoupons: async () => { const res = await api.get('/platform/subscriptions/coupons'); return res.data; },
  getCoupon: async (id: string) => { const res = await api.get(`/platform/subscriptions/coupons/${id}`); return res.data; },
  createCoupon: async (data: any) => { const res = await api.post('/platform/subscriptions/coupons', data); return res.data; },
  validateCoupon: async (data: { code: string; planId?: string; amountKobo?: number }) => { const res = await api.post('/platform/subscriptions/coupons/validate', data); return res.data; },

  // Promotions
  listPromotions: async () => { const res = await api.get('/platform/subscriptions/promotions'); return res.data; },
  getPromotion: async (id: string) => { const res = await api.get(`/platform/subscriptions/promotions/${id}`); return res.data; },
  createPromotion: async (data: any) => { const res = await api.post('/platform/subscriptions/promotions', data); return res.data; },
  updatePromotion: async (id: string, data: any) => { const res = await api.put(`/platform/subscriptions/promotions/${id}`, data); return res.data; },

  // Invoices
  listInvoices: async (subscriptionId?: string) => { const res = await api.get('/platform/subscriptions/invoices', { params: { subscriptionId } }); return res.data; },

  // Entitlements & Usage
  getEntitlements: async () => { const res = await api.get('/platform/subscriptions/entitlements'); return res.data; },
  checkFeatureAccess: async (featureKey: string) => { const res = await api.get('/platform/subscriptions/entitlements/check', { params: { featureKey } }); return res.data; },
  recordUsage: async (data: { featureKey: string; count?: number }) => { const res = await api.post('/platform/subscriptions/usage', data); return res.data; },
  getUsage: async (featureKey?: string) => { const res = await api.get('/platform/subscriptions/usage', { params: { featureKey } }); return res.data; },
  checkUsageLimit: async (featureKey: string) => { const res = await api.get('/platform/subscriptions/usage/check-limit', { params: { featureKey } }); return res.data; },

  // Lifecycle methods
  pause: async (id: string, pauseDays?: number) => { const res = await api.post(`/platform/subscriptions/${id}/pause`, { pauseDays }); return res.data; },
  resume: async (id: string) => { const res = await api.post(`/platform/subscriptions/${id}/resume`); return res.data; },
  cancelAtPeriodEnd: async (id: string, reason?: string) => { const res = await api.post(`/platform/subscriptions/${id}/cancel`, { reason }); return res.data; },
  cancelNow: async (id: string, reason?: string) => { const res = await api.post(`/platform/subscriptions/${id}/cancel-now`, { reason }); return res.data; },
  scheduleChange: async (id: string, planId: string, changeType: string) => { const res = await api.post(`/platform/subscriptions/${id}/schedule-change`, { planId, changeType }); return res.data; },
  getHistory: async (id: string) => { const res = await api.get(`/platform/subscriptions/${id}/history`); return res.data; },
  checkAccess: async (id: string) => { const res = await api.get(`/platform/subscriptions/${id}/access`); return res.data; },

  // Billing/Payment methods
  getGatewayConfigs: async () => { const res = await api.get('/platform/subscriptions/billing/gateway-config'); return res.data; },
  saveGatewayConfig: async (data: any) => { const res = await api.put('/platform/subscriptions/billing/gateway-config', data); return res.data; },
  getDefaultGateway: async () => { const res = await api.get('/platform/subscriptions/billing/gateway-default'); return res.data; },
  initializePayment: async (data: { invoiceId: string; gateway?: string; channels?: string[] }) => { const res = await api.post('/platform/subscriptions/billing/initialize', data); return res.data; },
  verifyPayment: async (data: { reference: string; invoiceId: string }) => { const res = await api.post('/platform/subscriptions/billing/verify', data); return res.data; },
  retryPayment: async (data: { invoiceId: string; gateway?: string; channels?: string[] }) => { const res = await api.post('/platform/subscriptions/billing/retry', data); return res.data; },
  getPaymentHistory: async (subscriptionId?: string) => { const res = await api.get('/platform/subscriptions/billing/payments', { params: { subscriptionId } }); return res.data; },
  getPaymentStats: async () => { const res = await api.get('/platform/subscriptions/billing/payments/stats'); return res.data; },
  getReceiptUrl: (paymentId: string) => `/platform/subscriptions/billing/receipts/${paymentId}`,

  // Portal
  getPortalDashboard: async () => { const res = await api.get('/platform/subscriptions/portal/dashboard'); return res.data; },
  changeBillingCycle: async (billingCycle: string) => { const res = await api.put('/platform/subscriptions/portal/billing-cycle', { billingCycle }); return res.data; },
  getPortalPaymentMethodLink: async () => { const res = await api.get('/platform/subscriptions/portal/payment-method-link'); return res.data; },
  redeemPortalCoupon: async (code: string) => { const res = await api.post('/platform/subscriptions/portal/redeem-coupon', { code }); return res.data; },
  downloadInvoice: async (id: string) => { const res = await api.get(`/platform/subscriptions/portal/invoices/${id}/download`, { responseType: 'blob' }); return res.data; },
  requestRefund: async (invoiceId: string, reason: string) => { const res = await api.post('/platform/subscriptions/portal/refund', { invoiceId, reason }); return res.data; },
  getPortalUsage: async () => { const res = await api.get('/platform/subscriptions/portal/usage'); return res.data; },
  listPortalAddons: async () => { const res = await api.get('/platform/subscriptions/portal/addons'); return res.data; },
  createPortalAddon: async (data: any) => { const res = await api.post('/platform/subscriptions/portal/addons', data); return res.data; },
  removePortalAddon: async (id: string) => { const res = await api.delete(`/platform/subscriptions/portal/addons/${id}`); return res.data; },

  // Marketplace Add-ons
  listMarketplaceAddons: async () => { const res = await api.get('/platform/subscriptions/addons/marketplace'); return res.data; },
  getMarketplaceAddon: async (id: string) => { const res = await api.get(`/platform/subscriptions/addons/marketplace/${id}`); return res.data; },
  listMyAddons: async () => { const res = await api.get('/platform/subscriptions/addons/my'); return res.data; },
  purchaseAddon: async (data: { productId: string; quantity?: number; billingCycle?: string; autoRenew?: boolean }) => { const res = await api.post('/platform/subscriptions/addons/purchase', data); return res.data; },
  cancelAddon: async (id: string) => { const res = await api.post(`/platform/subscriptions/addons/${id}/cancel`); return res.data; },
  reactivateAddon: async (id: string) => { const res = await api.post(`/platform/subscriptions/addons/${id}/reactivate`); return res.data; },
  updateAddonQuantity: async (id: string, quantity: number) => { const res = await api.put(`/platform/subscriptions/addons/${id}/quantity`, { quantity }); return res.data; },
  toggleAddonAutoRenew: async (id: string, autoRenew: boolean) => { const res = await api.put(`/platform/subscriptions/addons/${id}/auto-renew`, { autoRenew }); return res.data; },
  getEffectiveLimits: async () => { const res = await api.get('/platform/subscriptions/addons/effective-limits'); return res.data; },

  // Billing Engine
  listBillingInvoices: async (params?: { status?: string }) => { const res = await api.get('/platform/subscriptions/billing/invoices', { params }); return res.data; },
  getBillingInvoice: async (id: string) => { const res = await api.get(`/platform/subscriptions/billing/invoices/${id}`); return res.data; },
  generateBillingInvoice: async (data: any) => { const res = await api.post('/platform/subscriptions/billing/invoices/generate', data); return res.data; },
  downloadBillingInvoicePdf: async (id: string) => { const res = await api.get(`/platform/subscriptions/billing/invoices/${id}/pdf`, { responseType: 'blob' }); return res.data; },
  emailBillingInvoice: async (id: string) => { const res = await api.post(`/platform/subscriptions/billing/invoices/${id}/email`); return res.data; },
  listBillingCreditNotes: async () => { const res = await api.get('/platform/subscriptions/billing/credit-notes'); return res.data; },
  createBillingCreditNote: async (data: { invoiceId?: string; subscriptionId?: string; reason: string; amountKobo: number; taxKobo?: number }) => { const res = await api.post('/platform/subscriptions/billing/credit-notes', data); return res.data; },
  refundBillingInvoice: async (invoiceId: string, reason: string, amountKobo?: number) => { const res = await api.post('/platform/subscriptions/billing/refund', { invoiceId, reason, amountKobo }); return res.data; },
  getBillingTaxRates: async () => { const res = await api.get('/platform/subscriptions/billing/tax-rates'); return res.data; },
  saveBillingTaxRate: async (data: { name: string; rate: number; type?: string; isDefault?: boolean; description?: string }) => { const res = await api.post('/platform/subscriptions/billing/tax-rates', data); return res.data; },
  deleteBillingTaxRate: async (id: string) => { const res = await api.delete(`/platform/subscriptions/billing/tax-rates/${id}`); return res.data; },
  getBillingOutstanding: async () => { const res = await api.get('/platform/subscriptions/billing/outstanding'); return res.data; },
  getBillingHistory: async () => { const res = await api.get('/platform/subscriptions/billing/history'); return res.data; },
  handleBillingInvoiceFailure: async (id: string) => { const res = await api.post(`/platform/subscriptions/billing/invoices/${id}/handle-failure`); return res.data; },
  generateBillingAccountingEntries: async (id: string) => { const res = await api.post(`/platform/subscriptions/billing/invoices/${id}/accounting-entries`); return res.data; },
  generateBillingRenewals: async () => { const res = await api.post('/platform/subscriptions/billing/generate-renewals'); return res.data; },
  calculateBillingProration: async (data: { oldMonthlyKobo: number; newMonthlyKobo: number; daysRemaining: number; daysInPeriod?: number }) => { const res = await api.post('/platform/subscriptions/billing/calculate-proration', data); return res.data; },
};

export const customerSubscriptionApi = {
  listPlans: async () => { const res = await api.get('/customer-subscriptions/plans'); return res.data; },
  getCurrent: async () => { const res = await api.get('/customer-subscriptions/current'); return res.data; },
  changePlan: async (data: { subscriptionId: string; planId: string; prorate?: boolean }) => { const res = await api.put('/customer-subscriptions/change-plan', data); return res.data; },
  getInvoices: async () => { const res = await api.get('/customer-subscriptions/invoices'); return res.data; },
};

export const platformUsersApi = {
  list: async (params?: { page?: number; pageSize?: number; search?: string; role?: string }) => {
    const res = await api.get('/platform/users', { params });
    return res.data;
  },
  create: async (data: { email: string; password: string; fullName: string; role: string; isActive?: boolean }) => {
    const res = await api.post('/platform/users', data);
    return res.data;
  },
  update: async (id: string, data: { fullName?: string; role?: string; isActive?: boolean }) => {
    const res = await api.put(`/platform/users/${id}`, data);
    return res.data;
  },
  updatePassword: async (id: string, password: string) => {
    const res = await api.put(`/platform/users/${id}/password`, { password });
    return res.data;
  },
  remove: async (id: string) => {
    const res = await api.delete(`/platform/users/${id}`);
    return res.data;
  },
};

export const crmApi = {
  getStages: async (): Promise<any> => { const r = await api.get('/crm/stages'); return r.data; },
  getDeals: async (params?: any): Promise<any> => { const r = await api.get('/crm/deals', { params }); return r.data; },
  getDeal: async (id: string): Promise<any> => { const r = await api.get(`/crm/deals/${id}`); return r.data; },
  createDeal: async (data: any): Promise<any> => { const r = await api.post('/crm/deals', data); return r.data; },
  updateDeal: async (id: string, data: any): Promise<any> => { const r = await api.put(`/crm/deals/${id}`, data); return r.data; },
  deleteDeal: async (id: string): Promise<any> => { const r = await api.delete(`/crm/deals/${id}`); return r.data; },
  updateDealStage: async (id: string, stageId: string): Promise<any> => { const r = await api.patch(`/crm/deals/${id}/stage`, { stageId }); return r.data; },
  getActivities: async (params?: any): Promise<any> => { const r = await api.get('/crm/activities', { params }); return r.data; },
  createActivity: async (data: any): Promise<any> => { const r = await api.post('/crm/activities', data); return r.data; },
  updateActivity: async (id: string, data: any): Promise<any> => { const r = await api.put(`/crm/activities/${id}`, data); return r.data; },
  deleteActivity: async (id: string): Promise<any> => { const r = await api.delete(`/crm/activities/${id}`); return r.data; },
  getDashboard: async (): Promise<any> => { const r = await api.get('/crm/dashboard'); return r.data; },
  getRolePermissions: async (): Promise<any> => { const r = await api.get('/crm/role-permissions'); return r.data; },
  updateRolePermissions: async (role: string, permissions: string[]): Promise<any> => { const r = await api.put('/crm/role-permissions', { role, permissions }); return r.data; },
};

export const hrApi = {
  // ── Dashboard ──
  getDashboard: async (): Promise<any> => { const r = await api.get('/hr/dashboard'); return r.data; },
  getRecruitmentDashboard: async (): Promise<any> => { const r = await api.get('/hr/recruitment/dashboard'); return r.data; },
  getTimeDashboard: async (): Promise<any> => { const r = await api.get('/hr/time/dashboard'); return r.data; },
  getPeopleDashboard: async (): Promise<any> => { const r = await api.get('/hr/people/dashboard'); return r.data; },
  getOperationsDashboard: async (): Promise<any> => { const r = await api.get('/hr/operations/dashboard'); return r.data; },

  // ── Departments ──
  getDepartments: async (): Promise<any> => { const r = await api.get('/hr/departments'); return r.data; },
  getDepartment: async (id: string): Promise<any> => { const r = await api.get(`/hr/departments/${id}`); return r.data; },
  createDepartment: async (data: any): Promise<any> => { const r = await api.post('/hr/departments', data); return r.data; },
  updateDepartment: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/departments/${id}`, data); return r.data; },
  deleteDepartment: async (id: string): Promise<any> => { const r = await api.delete(`/hr/departments/${id}`); return r.data; },

  // ── Designations ──
  getDesignations: async (): Promise<any> => { const r = await api.get('/hr/designations'); return r.data; },
  createDesignation: async (data: any): Promise<any> => { const r = await api.post('/hr/designations', data); return r.data; },
  updateDesignation: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/designations/${id}`, data); return r.data; },
  deleteDesignation: async (id: string): Promise<any> => { const r = await api.delete(`/hr/designations/${id}`); return r.data; },

  // ── Employees ──
  getEmployees: async (params?: any): Promise<any> => { const r = await api.get('/hr/employees', { params }); return r.data; },
  getEmployee: async (id: string): Promise<any> => { const r = await api.get(`/hr/employees/${id}`); return r.data; },
  createEmployee: async (data: any): Promise<any> => { const r = await api.post('/hr/employees', data); return r.data; },
  updateEmployee: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/employees/${id}`, data); return r.data; },
  deleteEmployee: async (id: string): Promise<any> => { const r = await api.delete(`/hr/employees/${id}`); return r.data; },
  getNextEmployeeCode: async (): Promise<any> => { const r = await api.get('/hr/employees/code/next'); return r.data; },
  softDeleteEmployee: async (id: string): Promise<any> => { const r = await api.patch(`/hr/employees/${id}/soft-delete`); return r.data; },
  restoreEmployee: async (id: string): Promise<any> => { const r = await api.patch(`/hr/employees/${id}/restore`); return r.data; },
  updateEmployeePhoto: async (id: string, photoUrl: string): Promise<any> => { const r = await api.patch(`/hr/employees/${id}/photo`, { photoUrl }); return r.data; },
  getEmployeeFullProfile: async (id: string): Promise<any> => { const r = await api.get(`/hr/employees/${id}/profile`); return r.data; },
  getEmployeeDependants: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/dependants`); return r.data; },
  createEmployeeDependant: async (empId: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${empId}/dependants`, data); return r.data; },
  updateEmployeeDependant: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/dependants/${id}`, data); return r.data; },
  deleteEmployeeDependant: async (id: string): Promise<any> => { const r = await api.delete(`/hr/dependants/${id}`); return r.data; },
  getEmployeeEducation: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/education`); return r.data; },
  createEmployeeEducation: async (empId: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${empId}/education`, data); return r.data; },
  updateEmployeeEducation: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/education/${id}`, data); return r.data; },
  deleteEmployeeEducation: async (id: string): Promise<any> => { const r = await api.delete(`/hr/education/${id}`); return r.data; },
  getEmployeeEmploymentHistory: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/employment-history`); return r.data; },
  createEmployeeEmploymentHistory: async (empId: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${empId}/employment-history`, data); return r.data; },
  updateEmployeeEmploymentHistory: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/employment-history/${id}`, data); return r.data; },
  deleteEmployeeEmploymentHistory: async (id: string): Promise<any> => { const r = await api.delete(`/hr/employment-history/${id}`); return r.data; },
  getEmployeeSkills: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/skills`); return r.data; },
  createEmployeeSkill: async (empId: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${empId}/skills`, data); return r.data; },
  updateEmployeeSkill: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/skills/${id}`, data); return r.data; },
  deleteEmployeeSkill: async (id: string): Promise<any> => { const r = await api.delete(`/hr/skills/${id}`); return r.data; },
  getEmployeeCertifications: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/certifications`); return r.data; },
  createEmployeeCertification: async (empId: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${empId}/certifications`, data); return r.data; },
  updateEmployeeCertification: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/certifications/${id}`, data); return r.data; },
  deleteEmployeeCertification: async (id: string): Promise<any> => { const r = await api.delete(`/hr/certifications/${id}`); return r.data; },
  getEmployeeMedical: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/medical`); return r.data; },
  upsertEmployeeMedical: async (empId: string, data: any): Promise<any> => { const r = await api.put(`/hr/employees/${empId}/medical`, data); return r.data; },
  getEmployeeTimeline: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/timeline`); return r.data; },
  addTimelineEntry: async (empId: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${empId}/timeline`, data); return r.data; },
  transferEmployee: async (id: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${id}/transfer`, data); return r.data; },
  getEmployeeTransfers: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/transfers`); return r.data; },
  promoteEmployee: async (id: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${id}/promote`, data); return r.data; },
  getEmployeePromotions: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/promotions`); return r.data; },
  confirmEmployee: async (id: string, data?: any): Promise<any> => { const r = await api.post(`/hr/employees/${id}/confirm`, data || {}); return r.data; },
  suspendEmployee: async (id: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${id}/suspend`, data); return r.data; },
  terminateEmployee: async (id: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${id}/terminate`, data); return r.data; },
  reinstateEmployee: async (id: string, data?: any): Promise<any> => { const r = await api.post(`/hr/employees/${id}/reinstate`, data || {}); return r.data; },
  reactivateEmployee: async (id: string, data?: any): Promise<any> => { const r = await api.post(`/hr/employees/${id}/reactivate`, data || {}); return r.data; },
  getEmployeeDisciplinary: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/disciplinary`); return r.data; },
  bulkImportEmployees: async (data: any): Promise<any> => { const r = await api.post('/hr/employees/bulk-import', data); return r.data; },
  bulkExportEmployees: async (params?: any): Promise<any> => { const r = await api.post('/hr/employees/bulk-export', params || {}); return r.data; },

  // ── Employee Documents ──
  getEmployeeDocuments: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/documents`); return r.data; },
  createEmployeeDocument: async (empId: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${empId}/documents`, data); return r.data; },
  deleteEmployeeDocument: async (id: string): Promise<any> => { const r = await api.delete(`/hr/documents/${id}`); return r.data; },

  // ── Emergency Contacts ──
  getEmergencyContacts: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employees/${empId}/emergency-contacts`); return r.data; },
  createEmergencyContact: async (empId: string, data: any): Promise<any> => { const r = await api.post(`/hr/employees/${empId}/emergency-contacts`, data); return r.data; },
  updateEmergencyContact: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/emergency-contacts/${id}`, data); return r.data; },
  deleteEmergencyContact: async (id: string): Promise<any> => { const r = await api.delete(`/hr/emergency-contacts/${id}`); return r.data; },

  // ── Offboarding ──
  getOffboardingTasks: async (empId: string): Promise<any> => { const r = await api.get(`/hr/offboarding/${empId}`); return r.data; },
  createOffboardingTask: async (data: any): Promise<any> => { const r = await api.post('/hr/offboarding/tasks', data); return r.data; },
  completeOffboardingTask: async (id: string): Promise<any> => { const r = await api.patch(`/hr/offboarding/tasks/${id}/complete`); return r.data; },
  getExitInterviews: async (): Promise<any> => { const r = await api.get('/hr/exit-interviews'); return r.data; },
  getExitInterview: async (empId: string): Promise<any> => { const r = await api.get(`/hr/exit-interviews/${empId}`); return r.data; },
  createExitInterview: async (data: any): Promise<any> => { const r = await api.post('/hr/exit-interviews', data); return r.data; },

  // ── Job Openings ──
  getJobOpenings: async (params?: any): Promise<any> => { const r = await api.get('/hr/job-openings', { params }); return r.data; },
  getJobOpening: async (id: string): Promise<any> => { const r = await api.get(`/hr/job-openings/${id}`); return r.data; },
  createJobOpening: async (data: any): Promise<any> => { const r = await api.post('/hr/job-openings', data); return r.data; },
  updateJobOpening: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/job-openings/${id}`, data); return r.data; },
  deleteJobOpening: async (id: string): Promise<any> => { const r = await api.delete(`/hr/job-openings/${id}`); return r.data; },
  publishJobOpening: async (id: string): Promise<any> => { const r = await api.patch(`/hr/job-openings/${id}/publish`); return r.data; },
  closeJobOpening: async (id: string): Promise<any> => { const r = await api.patch(`/hr/job-openings/${id}/close`); return r.data; },

  // ── Candidates ──
  getCandidates: async (params?: any): Promise<any> => { const r = await api.get('/hr/candidates', { params }); return r.data; },
  getCandidate: async (id: string): Promise<any> => { const r = await api.get(`/hr/candidates/${id}`); return r.data; },
  createCandidate: async (data: any): Promise<any> => { const r = await api.post('/hr/candidates', data); return r.data; },
  updateCandidate: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/candidates/${id}`, data); return r.data; },
  deleteCandidate: async (id: string): Promise<any> => { const r = await api.delete(`/hr/candidates/${id}`); return r.data; },

  // ── Applications ──
  getApplications: async (params?: any): Promise<any> => { const r = await api.get('/hr/applications', { params }); return r.data; },
  createApplication: async (data: any): Promise<any> => { const r = await api.post('/hr/applications', data); return r.data; },
  updateApplicationStatus: async (id: string, data: any): Promise<any> => { const r = await api.patch(`/hr/applications/${id}/status`, data); return r.data; },
  scheduleInterview: async (id: string, data: any): Promise<any> => { const r = await api.post(`/hr/applications/${id}/interview`, data); return r.data; },
  sendOffer: async (id: string, data: any): Promise<any> => { const r = await api.post(`/hr/applications/${id}/offer`, data); return r.data; },

  // ── Onboarding ──
  getOnboardingTasks: async (empId: string): Promise<any> => { const r = await api.get(`/hr/onboarding/${empId}`); return r.data; },
  createOnboardingTask: async (data: any): Promise<any> => { const r = await api.post('/hr/onboarding/tasks', data); return r.data; },
  completeOnboardingTask: async (id: string): Promise<any> => { const r = await api.patch(`/hr/onboarding/tasks/${id}/complete`); return r.data; },
  createOnboardingChecklist: async (empId: string): Promise<any> => { const r = await api.post(`/hr/onboarding/checklist/${empId}`); return r.data; },

  // ── Equipment Assignments ──
  getEquipmentAssignments: async (params?: any): Promise<any> => { const r = await api.get('/hr/equipment-assignments', { params }); return r.data; },
  assignEquipment: async (data: any): Promise<any> => { const r = await api.post('/hr/equipment-assignments', data); return r.data; },
  returnEquipment: async (id: string): Promise<any> => { const r = await api.patch(`/hr/equipment-assignments/${id}/return`); return r.data; },

  // ── Orientation Sessions ──
  getOrientationSessions: async (params?: any): Promise<any> => { const r = await api.get('/hr/orientation-sessions', { params }); return r.data; },
  scheduleOrientationSession: async (data: any): Promise<any> => { const r = await api.post('/hr/orientation-sessions', data); return r.data; },
  completeOrientationSession: async (id: string): Promise<any> => { const r = await api.patch(`/hr/orientation-sessions/${id}/complete`); return r.data; },

  // ── Probation Reviews ──
  getProbationReviews: async (params?: any): Promise<any> => { const r = await api.get('/hr/probation-reviews', { params }); return r.data; },
  createProbationReview: async (data: any): Promise<any> => { const r = await api.post('/hr/probation-reviews', data); return r.data; },
  finalizeProbation: async (id: string, data: any): Promise<any> => { const r = await api.patch(`/hr/probation-reviews/${id}/finalize`, data); return r.data; },

  // ── Pre-Employment Documents ──
  getPreEmploymentDocuments: async (params?: any): Promise<any> => { const r = await api.get('/hr/pre-employment-documents', { params }); return r.data; },
  uploadPreEmploymentDocument: async (data: any): Promise<any> => { const r = await api.post('/hr/pre-employment-documents', data); return r.data; },
  verifyPreEmploymentDocument: async (id: string): Promise<any> => { const r = await api.patch(`/hr/pre-employment-documents/${id}/verify`); return r.data; },

  // ── Leave ──
  // ── Leave Types ──
  getLeaveTypes: async (): Promise<any> => { const r = await api.get('/hr/leave-types'); return r.data; },
  getLeaveType: async (id: string): Promise<any> => { const r = await api.get(`/hr/leave-types/${id}`); return r.data; },
  createLeaveType: async (data: any): Promise<any> => { const r = await api.post('/hr/leave-types', data); return r.data; },
  updateLeaveType: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/leave-types/${id}`, data); return r.data; },
  deleteLeaveType: async (id: string): Promise<any> => { const r = await api.delete(`/hr/leave-types/${id}`); return r.data; },

  // ── Leave Policies ──
  getLeavePolicies: async (): Promise<any> => { const r = await api.get('/hr/leave-policies'); return r.data; },
  getLeavePolicy: async (id: string): Promise<any> => { const r = await api.get(`/hr/leave-policies/${id}`); return r.data; },
  createLeavePolicy: async (data: any): Promise<any> => { const r = await api.post('/hr/leave-policies', data); return r.data; },
  updateLeavePolicy: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/leave-policies/${id}`, data); return r.data; },
  deleteLeavePolicy: async (id: string): Promise<any> => { const r = await api.delete(`/hr/leave-policies/${id}`); return r.data; },

  // ── Holidays ──
  getHolidays: async (params?: any): Promise<any> => { const r = await api.get('/hr/holidays', { params }); return r.data; },
  getHoliday: async (id: string): Promise<any> => { const r = await api.get(`/hr/holidays/${id}`); return r.data; },
  createHoliday: async (data: any): Promise<any> => { const r = await api.post('/hr/holidays', data); return r.data; },
  updateHoliday: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/holidays/${id}`, data); return r.data; },
  deleteHoliday: async (id: string): Promise<any> => { const r = await api.delete(`/hr/holidays/${id}`); return r.data; },
  getHolidayCalendar: async (year: number): Promise<any> => { const r = await api.get(`/hr/holidays/calendar/${year}`); return r.data; },

  // ── Compensatory Leave ──
  getCompensatoryLeaves: async (params?: any): Promise<any> => { const r = await api.get('/hr/compensatory-leaves', { params }); return r.data; },
  getCompensatoryLeave: async (id: string): Promise<any> => { const r = await api.get(`/hr/compensatory-leaves/${id}`); return r.data; },
  createCompensatoryLeave: async (data: any): Promise<any> => { const r = await api.post('/hr/compensatory-leaves', data); return r.data; },
  approveCompensatoryLeave: async (id: string): Promise<any> => { const r = await api.patch(`/hr/compensatory-leaves/${id}/approve`); return r.data; },
  deleteCompensatoryLeave: async (id: string): Promise<any> => { const r = await api.delete(`/hr/compensatory-leaves/${id}`); return r.data; },

  // ── Leave Requests ──
  getLeaveRequests: async (params?: any): Promise<any> => { const r = await api.get('/hr/leave-requests', { params }); return r.data; },
  getLeaveRequest: async (id: string): Promise<any> => { const r = await api.get(`/hr/leave-requests/${id}`); return r.data; },
  createLeaveRequest: async (data: any): Promise<any> => { const r = await api.post('/hr/leave-requests', data); return r.data; },
  approveLeaveRequest: async (id: string, data?: any): Promise<any> => { const r = await api.patch(`/hr/leave-requests/${id}/approve`, data); return r.data; },
  rejectLeaveRequest: async (id: string, data: any): Promise<any> => { const r = await api.patch(`/hr/leave-requests/${id}/reject`, data); return r.data; },
  cancelLeaveRequest: async (id: string): Promise<any> => { const r = await api.patch(`/hr/leave-requests/${id}/cancel`); return r.data; },
  recallLeaveRequest: async (id: string): Promise<any> => { const r = await api.patch(`/hr/leave-requests/${id}/recall`); return r.data; },

  // ── Leave Balances ──
  getLeaveBalances: async (params?: any): Promise<any> => { const r = await api.get('/hr/leave-balances', { params }); return r.data; },
  allocateLeaveBalance: async (data: any): Promise<any> => { const r = await api.post('/hr/leave-balances/allocate', data); return r.data; },
  recalculateLeaveBalance: async (data: any): Promise<any> => { const r = await api.post('/hr/leave-balances/recalculate', data); return r.data; },

  // ── Leave Accrual ──
  runLeaveAccrual: async (data: any): Promise<any> => { const r = await api.post('/hr/leave-accrual/run', data); return r.data; },
  getAccrualLogs: async (): Promise<any> => { const r = await api.get('/hr/leave-accrual/logs'); return r.data; },

  // ── Leave Calendar ──
  getLeaveCalendar: async (params?: any): Promise<any> => { const r = await api.get('/hr/leave-calendar', { params }); return r.data; },

  // ── Leave Report ──
  getLeaveReport: async (params?: any): Promise<any> => { const r = await api.get('/hr/leave-report', { params }); return r.data; },

  // ── Attendance ──
  getAttendance: async (params?: any): Promise<any> => { const r = await api.get('/hr/attendance', { params }); return r.data; },
  getAttendanceRecord: async (id: string): Promise<any> => { const r = await api.get(`/hr/attendance/${id}`); return r.data; },
  getTodayAttendance: async (params?: any): Promise<any> => { const r = await api.get('/hr/attendance/today', { params }); return r.data; },
  clockIn: async (data?: any): Promise<any> => { const r = await api.post('/hr/attendance/clock-in', data); return r.data; },
  clockOut: async (data?: any): Promise<any> => { const r = await api.post('/hr/attendance/clock-out', data); return r.data; },
  breakIn: async (data?: any): Promise<any> => { const r = await api.post('/hr/attendance/break-in', data); return r.data; },
  breakOut: async (data?: any): Promise<any> => { const r = await api.post('/hr/attendance/break-out', data); return r.data; },
  updateAttendance: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/attendance/${id}`, data); return r.data; },
  approveAttendance: async (id: string): Promise<any> => { const r = await api.patch(`/hr/attendance/${id}/approve`); return r.data; },
  recalculateAllAttendance: async (data?: any): Promise<any> => { const r = await api.post('/hr/attendance/calculate', data); return r.data; },
  getAttendanceSummary: async (params?: any): Promise<any> => { const r = await api.get('/hr/attendance/summary', { params }); return r.data; },
  getAttendanceReport: async (params?: any): Promise<any> => { const r = await api.get('/hr/attendance/report', { params }); return r.data; },
  generateTimesheetsFromAttendance: async (data?: any): Promise<any> => { const r = await api.post('/hr/attendance/generate-timesheets', data); return r.data; },

  // ── Shift Assignments ──
  getShiftAssignments: async (params?: any): Promise<any> => { const r = await api.get('/hr/shift-assignments', { params }); return r.data; },
  assignShift: async (data: any): Promise<any> => { const r = await api.post('/hr/shift-assignments', data); return r.data; },
  updateShiftAssignment: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/shift-assignments/${id}`, data); return r.data; },
  deleteShiftAssignment: async (id: string): Promise<any> => { const r = await api.delete(`/hr/shift-assignments/${id}`); return r.data; },

  // ── Shift Rotations ──
  getShiftRotations: async (params?: any): Promise<any> => { const r = await api.get('/hr/shift-rotations', { params }); return r.data; },
  getShiftRotation: async (id: string): Promise<any> => { const r = await api.get(`/hr/shift-rotations/${id}`); return r.data; },
  createShiftRotation: async (data: any): Promise<any> => { const r = await api.post('/hr/shift-rotations', data); return r.data; },
  updateShiftRotation: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/shift-rotations/${id}`, data); return r.data; },
  deleteShiftRotation: async (id: string): Promise<any> => { const r = await api.delete(`/hr/shift-rotations/${id}`); return r.data; },
  addRotationAssignee: async (id: string, data: any): Promise<any> => { const r = await api.post(`/hr/shift-rotations/${id}/assignees`, data); return r.data; },
  removeRotationAssignee: async (rotationId: string, assigneeId: string): Promise<any> => { const r = await api.delete(`/hr/shift-rotations/${rotationId}/assignees/${assigneeId}`); return r.data; },

  // ── Attendance Exceptions ──
  getAttendanceExceptions: async (params?: any): Promise<any> => { const r = await api.get('/hr/attendance-exceptions', { params }); return r.data; },
  createAttendanceException: async (data: any): Promise<any> => { const r = await api.post('/hr/attendance-exceptions', data); return r.data; },
  approveAttendanceException: async (id: string): Promise<any> => { const r = await api.patch(`/hr/attendance-exceptions/${id}/approve`); return r.data; },
  rejectAttendanceException: async (id: string): Promise<any> => { const r = await api.patch(`/hr/attendance-exceptions/${id}/reject`); return r.data; },
  deleteAttendanceException: async (id: string): Promise<any> => { const r = await api.delete(`/hr/attendance-exceptions/${id}`); return r.data; },

  // ── Overtime Policies ──
  getOvertimePolicies: async (params?: any): Promise<any> => { const r = await api.get('/hr/overtime-policies', { params }); return r.data; },
  createOvertimePolicy: async (data: any): Promise<any> => { const r = await api.post('/hr/overtime-policies', data); return r.data; },
  updateOvertimePolicy: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/overtime-policies/${id}`, data); return r.data; },
  deleteOvertimePolicy: async (id: string): Promise<any> => { const r = await api.delete(`/hr/overtime-policies/${id}`); return r.data; },

  // ── Shifts ──
  getShifts: async (): Promise<any> => { const r = await api.get('/hr/shifts'); return r.data; },
  getShift: async (id: string): Promise<any> => { const r = await api.get(`/hr/shifts/${id}`); return r.data; },
  createShift: async (data: any): Promise<any> => { const r = await api.post('/hr/shifts', data); return r.data; },
  updateShift: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/shifts/${id}`, data); return r.data; },
  deleteShift: async (id: string): Promise<any> => { const r = await api.delete(`/hr/shifts/${id}`); return r.data; },

  // ── Timesheets ──
  getTimesheets: async (params?: any): Promise<any> => { const r = await api.get('/hr/timesheets', { params }); return r.data; },
  getTimesheet: async (id: string): Promise<any> => { const r = await api.get(`/hr/timesheets/${id}`); return r.data; },
  createTimesheet: async (data: any): Promise<any> => { const r = await api.post('/hr/timesheets', data); return r.data; },
  updateTimesheet: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/timesheets/${id}`, data); return r.data; },
  submitTimesheet: async (id: string): Promise<any> => { const r = await api.patch(`/hr/timesheets/${id}/submit`); return r.data; },
  approveTimesheet: async (id: string): Promise<any> => { const r = await api.patch(`/hr/timesheets/${id}/approve`); return r.data; },

  // ── Performance Reviews ──
  getPerformanceReviews: async (params?: any): Promise<any> => { const r = await api.get('/hr/performance-reviews', { params }); return r.data; },
  getPerformanceReview: async (id: string): Promise<any> => { const r = await api.get(`/hr/performance-reviews/${id}`); return r.data; },
  createPerformanceReview: async (data: any): Promise<any> => { const r = await api.post('/hr/performance-reviews', data); return r.data; },
  updatePerformanceReview: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/performance-reviews/${id}`, data); return r.data; },
  submitPerformanceReview: async (id: string): Promise<any> => { const r = await api.patch(`/hr/performance-reviews/${id}/submit`); return r.data; },
  completePerformanceReview: async (id: string, data: any): Promise<any> => { const r = await api.patch(`/hr/performance-reviews/${id}/complete`, data); return r.data; },
  deletePerformanceReview: async (id: string): Promise<any> => { const r = await api.delete(`/hr/performance-reviews/${id}`); return r.data; },
  getReviewSections: async (reviewId: string): Promise<any> => { const r = await api.get(`/hr/performance-reviews/${reviewId}/sections`); return r.data; },
  createReviewSection: async (reviewId: string, data: any): Promise<any> => { const r = await api.post(`/hr/performance-reviews/${reviewId}/sections`, data); return r.data; },
  updateReviewSection: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/review-sections/${id}`, data); return r.data; },
  deleteReviewSection: async (id: string): Promise<any> => { const r = await api.delete(`/hr/review-sections/${id}`); return r.data; },

  // ── KPIs ──
  getKpis: async (params?: any): Promise<any> => { const r = await api.get('/hr/kpis', { params }); return r.data; },
  getKpi: async (id: string): Promise<any> => { const r = await api.get(`/hr/kpis/${id}`); return r.data; },
  createKpi: async (data: any): Promise<any> => { const r = await api.post('/hr/kpis', data); return r.data; },
  updateKpi: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/kpis/${id}`, data); return r.data; },
  deleteKpi: async (id: string): Promise<any> => { const r = await api.delete(`/hr/kpis/${id}`); return r.data; },

  // ── Performance Cycles ──
  getPerformanceCycles: async (params?: any): Promise<any> => { const r = await api.get('/hr/performance-cycles', { params }); return r.data; },
  getPerformanceCycle: async (id: string): Promise<any> => { const r = await api.get(`/hr/performance-cycles/${id}`); return r.data; },
  createPerformanceCycle: async (data: any): Promise<any> => { const r = await api.post('/hr/performance-cycles', data); return r.data; },
  updatePerformanceCycle: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/performance-cycles/${id}`, data); return r.data; },
  deletePerformanceCycle: async (id: string): Promise<any> => { const r = await api.delete(`/hr/performance-cycles/${id}`); return r.data; },

  // ── Development Plans ──
  getDevelopmentPlans: async (params?: any): Promise<any> => { const r = await api.get('/hr/development-plans', { params }); return r.data; },
  getDevelopmentPlan: async (id: string): Promise<any> => { const r = await api.get(`/hr/development-plans/${id}`); return r.data; },
  createDevelopmentPlan: async (data: any): Promise<any> => { const r = await api.post('/hr/development-plans', data); return r.data; },
  updateDevelopmentPlan: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/development-plans/${id}`, data); return r.data; },
  deleteDevelopmentPlan: async (id: string): Promise<any> => { const r = await api.delete(`/hr/development-plans/${id}`); return r.data; },

  // ── Promotion Recommendations ──
  getPromotions: async (params?: any): Promise<any> => { const r = await api.get('/hr/promotions', { params }); return r.data; },
  getPromotion: async (id: string): Promise<any> => { const r = await api.get(`/hr/promotions/${id}`); return r.data; },
  createPromotion: async (data: any): Promise<any> => { const r = await api.post('/hr/promotions', data); return r.data; },
  updatePromotion: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/promotions/${id}`, data); return r.data; },
  approvePromotion: async (id: string): Promise<any> => { const r = await api.patch(`/hr/promotions/${id}/approve`); return r.data; },
  rejectPromotion: async (id: string): Promise<any> => { const r = await api.patch(`/hr/promotions/${id}/reject`); return r.data; },
  deletePromotion: async (id: string): Promise<any> => { const r = await api.delete(`/hr/promotions/${id}`); return r.data; },

  // ── Performance Analytics ──
  getPerformanceAnalytics: async (params?: any): Promise<any> => { const r = await api.get('/hr/performance/analytics', { params }); return r.data; },

  // ── LMS Courses ──
  getCourses: async (params?: any): Promise<any> => { const r = await api.get('/hr/courses', { params }); return r.data; },
  getCourse: async (id: string): Promise<any> => { const r = await api.get(`/hr/courses/${id}`); return r.data; },
  createCourse: async (data: any): Promise<any> => { const r = await api.post('/hr/courses', data); return r.data; },
  updateCourse: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/courses/${id}`, data); return r.data; },
  deleteCourse: async (id: string): Promise<any> => { const r = await api.delete(`/hr/courses/${id}`); return r.data; },
  publishCourse: async (id: string): Promise<any> => { const r = await api.patch(`/hr/courses/${id}/publish`); return r.data; },

  // ── Enrollments ──
  getEnrollments: async (params?: any): Promise<any> => { const r = await api.get('/hr/enrollments', { params }); return r.data; },
  createEnrollment: async (data: any): Promise<any> => { const r = await api.post('/hr/enrollments', data); return r.data; },
  updateEnrollmentProgress: async (id: string, data: any): Promise<any> => { const r = await api.patch(`/hr/enrollments/${id}/progress`, data); return r.data; },
  completeEnrollment: async (id: string, data?: any): Promise<any> => { const r = await api.patch(`/hr/enrollments/${id}/complete`, data); return r.data; },
  deleteEnrollment: async (id: string): Promise<any> => { const r = await api.delete(`/hr/enrollments/${id}`); return r.data; },

  // ── Pulse Surveys ──
  getSurveys: async (params?: any): Promise<any> => { const r = await api.get('/hr/surveys', { params }); return r.data; },
  getSurvey: async (id: string): Promise<any> => { const r = await api.get(`/hr/surveys/${id}`); return r.data; },
  createSurvey: async (data: any): Promise<any> => { const r = await api.post('/hr/surveys', data); return r.data; },
  updateSurvey: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/surveys/${id}`, data); return r.data; },
  launchSurvey: async (id: string): Promise<any> => { const r = await api.patch(`/hr/surveys/${id}/launch`); return r.data; },
  closeSurvey: async (id: string): Promise<any> => { const r = await api.patch(`/hr/surveys/${id}/close`); return r.data; },
  deleteSurvey: async (id: string): Promise<any> => { const r = await api.delete(`/hr/surveys/${id}`); return r.data; },
  getSurveyResults: async (id: string): Promise<any> => { const r = await api.get(`/hr/surveys/${id}/results`); return r.data; },
  submitSurveyResponse: async (id: string, data: any): Promise<any> => { const r = await api.post(`/hr/surveys/${id}/respond`, data); return r.data; },

  // ── Announcements ──
  getAnnouncements: async (): Promise<any> => { const r = await api.get('/hr/announcements'); return r.data; },
  createAnnouncement: async (data: any): Promise<any> => { const r = await api.post('/hr/announcements', data); return r.data; },
  updateAnnouncement: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/announcements/${id}`, data); return r.data; },
  deleteAnnouncement: async (id: string): Promise<any> => { const r = await api.delete(`/hr/announcements/${id}`); return r.data; },

  // ── Recognition ──
  getRecognition: async (params?: any): Promise<any> => { const r = await api.get('/hr/recognition', { params }); return r.data; },
  createRecognition: async (data: any): Promise<any> => { const r = await api.post('/hr/recognition', data); return r.data; },
  deleteRecognition: async (id: string): Promise<any> => { const r = await api.delete(`/hr/recognition/${id}`); return r.data; },

  // ── Letters ──
  getLetterTemplates: async (): Promise<any> => { const r = await api.get('/hr/letter-templates'); return r.data; },
  createLetterTemplate: async (data: any): Promise<any> => { const r = await api.post('/hr/letter-templates', data); return r.data; },
  updateLetterTemplate: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/letter-templates/${id}`, data); return r.data; },
  deleteLetterTemplate: async (id: string): Promise<any> => { const r = await api.delete(`/hr/letter-templates/${id}`); return r.data; },
  getLetters: async (params?: any): Promise<any> => { const r = await api.get('/hr/letters', { params }); return r.data; },
  getLetter: async (id: string): Promise<any> => { const r = await api.get(`/hr/letters/${id}`); return r.data; },
  generateLetter: async (data: any): Promise<any> => { const r = await api.post('/hr/letters/generate', data); return r.data; },
  deleteLetter: async (id: string): Promise<any> => { const r = await api.delete(`/hr/letters/${id}`); return r.data; },

  // ── Expense Reports ──
  getExpenseReports: async (params?: any): Promise<any> => { const r = await api.get('/hr/expense-reports', { params }); return r.data; },
  getExpenseReport: async (id: string): Promise<any> => { const r = await api.get(`/hr/expense-reports/${id}`); return r.data; },
  createExpenseReport: async (data: any): Promise<any> => { const r = await api.post('/hr/expense-reports', data); return r.data; },
  updateExpenseReport: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/expense-reports/${id}`, data); return r.data; },
  deleteExpenseReport: async (id: string): Promise<any> => { const r = await api.delete(`/hr/expense-reports/${id}`); return r.data; },
  submitExpenseReport: async (id: string): Promise<any> => { const r = await api.patch(`/hr/expense-reports/${id}/submit`); return r.data; },
  approveExpenseReport: async (id: string): Promise<any> => { const r = await api.patch(`/hr/expense-reports/${id}/approve`); return r.data; },
  reimburseExpenseReport: async (id: string): Promise<any> => { const r = await api.patch(`/hr/expense-reports/${id}/reimburse`); return r.data; },

  // ── Compensation & Benefits ──
  getCompensationBands: async (): Promise<any> => { const r = await api.get('/hr/compensation-bands'); return r.data; },
  createCompensationBand: async (data: any): Promise<any> => { const r = await api.post('/hr/compensation-bands', data); return r.data; },
  updateCompensationBand: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/compensation-bands/${id}`, data); return r.data; },
  deleteCompensationBand: async (id: string): Promise<any> => { const r = await api.delete(`/hr/compensation-bands/${id}`); return r.data; },
  getEmployeeCompensation: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employee-compensation/${empId}`); return r.data; },
  createEmployeeCompensation: async (data: any): Promise<any> => { const r = await api.post('/hr/employee-compensation', data); return r.data; },
  updateEmployeeCompensation: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/employee-compensation/${id}`, data); return r.data; },
  getBenefits: async (): Promise<any> => { const r = await api.get('/hr/benefits'); return r.data; },
  createBenefit: async (data: any): Promise<any> => { const r = await api.post('/hr/benefits', data); return r.data; },
  updateBenefit: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/benefits/${id}`, data); return r.data; },
  deleteBenefit: async (id: string): Promise<any> => { const r = await api.delete(`/hr/benefits/${id}`); return r.data; },
  getEmployeeBenefits: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employee-benefits/${empId}`); return r.data; },
  enrollBenefit: async (data: any): Promise<any> => { const r = await api.post('/hr/employee-benefits/enroll', data); return r.data; },
  disenrollBenefit: async (id: string): Promise<any> => { const r = await api.delete(`/hr/employee-benefits/${id}`); return r.data; },

  // ── Allowances ──
  getAllowances: async (): Promise<any> => { const r = await api.get('/hr/allowances'); return r.data; },
  getAllowance: async (id: string): Promise<any> => { const r = await api.get(`/hr/allowances/${id}`); return r.data; },
  createAllowance: async (data: any): Promise<any> => { const r = await api.post('/hr/allowances', data); return r.data; },
  updateAllowance: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/allowances/${id}`, data); return r.data; },
  deleteAllowance: async (id: string): Promise<any> => { const r = await api.delete(`/hr/allowances/${id}`); return r.data; },
  getEmployeeAllowances: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employee-allowances/${empId}`); return r.data; },
  assignEmployeeAllowance: async (data: any): Promise<any> => { const r = await api.post('/hr/employee-allowances', data); return r.data; },
  removeEmployeeAllowance: async (id: string): Promise<any> => { const r = await api.delete(`/hr/employee-allowances/${id}`); return r.data; },

  // ── Bonuses ──
  getBonuses: async (params?: any): Promise<any> => { const r = await api.get('/hr/bonuses', { params }); return r.data; },
  getBonus: async (id: string): Promise<any> => { const r = await api.get(`/hr/bonuses/${id}`); return r.data; },
  createBonus: async (data: any): Promise<any> => { const r = await api.post('/hr/bonuses', data); return r.data; },
  updateBonus: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/bonuses/${id}`, data); return r.data; },
  approveBonus: async (id: string): Promise<any> => { const r = await api.patch(`/hr/bonuses/${id}/approve`); return r.data; },
  deleteBonus: async (id: string): Promise<any> => { const r = await api.delete(`/hr/bonuses/${id}`); return r.data; },

  // ── Deductions ──
  getDeductions: async (): Promise<any> => { const r = await api.get('/hr/deductions'); return r.data; },
  getDeduction: async (id: string): Promise<any> => { const r = await api.get(`/hr/deductions/${id}`); return r.data; },
  createDeduction: async (data: any): Promise<any> => { const r = await api.post('/hr/deductions', data); return r.data; },
  updateDeduction: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/deductions/${id}`, data); return r.data; },
  deleteDeduction: async (id: string): Promise<any> => { const r = await api.delete(`/hr/deductions/${id}`); return r.data; },
  getEmployeeDeductions: async (empId: string): Promise<any> => { const r = await api.get(`/hr/employee-deductions/${empId}`); return r.data; },
  assignEmployeeDeduction: async (data: any): Promise<any> => { const r = await api.post('/hr/employee-deductions', data); return r.data; },
  removeEmployeeDeduction: async (id: string): Promise<any> => { const r = await api.delete(`/hr/employee-deductions/${id}`); return r.data; },

  // ── Salary Reviews ──
  getSalaryReviews: async (params?: any): Promise<any> => { const r = await api.get('/hr/salary-reviews', { params }); return r.data; },
  getSalaryReview: async (id: string): Promise<any> => { const r = await api.get(`/hr/salary-reviews/${id}`); return r.data; },
  createSalaryReview: async (data: any): Promise<any> => { const r = await api.post('/hr/salary-reviews', data); return r.data; },
  approveSalaryReview: async (id: string): Promise<any> => { const r = await api.patch(`/hr/salary-reviews/${id}/approve`); return r.data; },
  rejectSalaryReview: async (id: string): Promise<any> => { const r = await api.patch(`/hr/salary-reviews/${id}/reject`); return r.data; },
  deleteSalaryReview: async (id: string): Promise<any> => { const r = await api.delete(`/hr/salary-reviews/${id}`); return r.data; },

  // ── Compensation History & Reports ──
  getCompensationHistory: async (params?: any): Promise<any> => { const r = await api.get('/hr/compensation-history', { params }); return r.data; },
  getCompensationReport: async (): Promise<any> => { const r = await api.get('/hr/compensation-report'); return r.data; },

  // ── Travel Management ──
  getTravelDashboard: async (): Promise<any> => { const r = await api.get('/hr/travel/dashboard'); return r.data; },
  getTravelRequests: async (params?: any): Promise<any> => { const r = await api.get('/hr/travel-requests', { params }); return r.data; },
  getTravelRequest: async (id: string): Promise<any> => { const r = await api.get(`/hr/travel-requests/${id}`); return r.data; },
  createTravelRequest: async (data: any): Promise<any> => { const r = await api.post('/hr/travel-requests', data); return r.data; },
  updateTravelRequest: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/travel-requests/${id}`, data); return r.data; },
  submitTravelRequest: async (id: string): Promise<any> => { const r = await api.patch(`/hr/travel-requests/${id}/submit`); return r.data; },
  approveTravelRequest: async (id: string): Promise<any> => { const r = await api.patch(`/hr/travel-requests/${id}/approve`); return r.data; },
  declineTravelRequest: async (id: string, reason?: string): Promise<any> => { const r = await api.patch(`/hr/travel-requests/${id}/decline`, { reason }); return r.data; },
  deleteTravelRequest: async (id: string): Promise<any> => { const r = await api.delete(`/hr/travel-requests/${id}`); return r.data; },
  getTravelAdvances: async (params?: any): Promise<any> => { const r = await api.get('/hr/travel-advances', { params }); return r.data; },
  getTravelAdvance: async (id: string): Promise<any> => { const r = await api.get(`/hr/travel-advances/${id}`); return r.data; },
  createTravelAdvance: async (data: any): Promise<any> => { const r = await api.post('/hr/travel-advances', data); return r.data; },
  updateTravelAdvance: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/travel-advances/${id}`, data); return r.data; },
  approveTravelAdvance: async (id: string): Promise<any> => { const r = await api.patch(`/hr/travel-advances/${id}/approve`); return r.data; },
  disburseTravelAdvance: async (id: string): Promise<any> => { const r = await api.patch(`/hr/travel-advances/${id}/disburse`); return r.data; },
  deleteTravelAdvance: async (id: string): Promise<any> => { const r = await api.delete(`/hr/travel-advances/${id}`); return r.data; },
  getTravelExpenses: async (params?: any): Promise<any> => { const r = await api.get('/hr/travel-expenses', { params }); return r.data; },
  linkExpenseToTravel: async (id: string, travelRequestId: string): Promise<any> => { const r = await api.patch(`/hr/travel-expenses/${id}/link`, { travelRequestId }); return r.data; },
  getTravelSettlements: async (params?: any): Promise<any> => { const r = await api.get('/hr/travel-settlements', { params }); return r.data; },
  getTravelSettlement: async (id: string): Promise<any> => { const r = await api.get(`/hr/travel-settlements/${id}`); return r.data; },
  createTravelSettlement: async (data: any): Promise<any> => { const r = await api.post('/hr/travel-settlements', data); return r.data; },
  autoSettleTravel: async (travelRequestId: string): Promise<any> => { const r = await api.post(`/hr/travel-settlements/auto-settle/${travelRequestId}`); return r.data; },
  getTravelHistory: async (params?: any): Promise<any> => { const r = await api.get('/hr/travel-history', { params }); return r.data; },
  getTravelReport: async (params?: any): Promise<any> => { const r = await api.get('/hr/travel-report', { params }); return r.data; },

  // ── Document Management ──
  getDocDashboard: async (): Promise<any> => { const r = await api.get('/hr/documents/dashboard'); return r.data; },
  getDocCategories: async (): Promise<any> => { const r = await api.get('/hr/documents/categories'); return r.data; },
  getDocCategory: async (id: string): Promise<any> => { const r = await api.get(`/hr/documents/categories/${id}`); return r.data; },
  createDocCategory: async (data: any): Promise<any> => { const r = await api.post('/hr/documents/categories', data); return r.data; },
  updateDocCategory: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/documents/categories/${id}`, data); return r.data; },
  deleteDocCategory: async (id: string): Promise<any> => { const r = await api.delete(`/hr/documents/categories/${id}`); return r.data; },
  getDocFiles: async (params?: any): Promise<any> => { const r = await api.get('/hr/documents/files', { params }); return r.data; },
  getDocFile: async (id: string): Promise<any> => { const r = await api.get(`/hr/documents/files/${id}`); return r.data; },
  createDocFile: async (data: any): Promise<any> => { const r = await api.post('/hr/documents/files', data); return r.data; },
  updateDocFile: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/documents/files/${id}`, data); return r.data; },
  uploadDocVersion: async (id: string, data: any): Promise<any> => { const r = await api.post(`/hr/documents/files/${id}/version`, data); return r.data; },
  deleteDocFile: async (id: string): Promise<any> => { const r = await api.delete(`/hr/documents/files/${id}`); return r.data; },
  getDocVersions: async (id: string): Promise<any> => { const r = await api.get(`/hr/documents/files/${id}/versions`); return r.data; },
  getDocPermissions: async (id: string): Promise<any> => { const r = await api.get(`/hr/documents/files/${id}/permissions`); return r.data; },
  setDocPermission: async (data: any): Promise<any> => { const r = await api.post('/hr/documents/permissions', data); return r.data; },
  removeDocPermission: async (id: string): Promise<any> => { const r = await api.delete(`/hr/documents/permissions/${id}`); return r.data; },
  getDocEmployeeLinks: async (id: string): Promise<any> => { const r = await api.get(`/hr/documents/files/${id}/employees`); return r.data; },
  linkDocToEmployee: async (data: any): Promise<any> => { const r = await api.post('/hr/documents/employee-links', data); return r.data; },
  unlinkDocFromEmployee: async (id: string): Promise<any> => { const r = await api.delete(`/hr/documents/employee-links/${id}`); return r.data; },
  getEmployeeDocs: async (employeeId: string): Promise<any> => { const r = await api.get(`/hr/documents/employee/${employeeId}`); return r.data; },

  // ── Tasks ──
  getHrTasks: async (params?: any): Promise<any> => { const r = await api.get('/hr/tasks', { params }); return r.data; },
  createHrTask: async (data: any): Promise<any> => { const r = await api.post('/hr/tasks', data); return r.data; },
  updateHrTask: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/tasks/${id}`, data); return r.data; },
  completeHrTask: async (id: string): Promise<any> => { const r = await api.patch(`/hr/tasks/${id}/complete`); return r.data; },
  deleteHrTask: async (id: string): Promise<any> => { const r = await api.delete(`/hr/tasks/${id}`); return r.data; },

  // ── OKR & Goals ──
  getGoalCycles: async (): Promise<any> => { const r = await api.get('/hr/goal-cycles'); return r.data; },
  createGoalCycle: async (data: any): Promise<any> => { const r = await api.post('/hr/goal-cycles', data); return r.data; },
  updateGoalCycle: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/goal-cycles/${id}`, data); return r.data; },
  getOkrs: async (params?: any): Promise<any> => { const r = await api.get('/hr/okrs', { params }); return r.data; },
  getOkr: async (id: string): Promise<any> => { const r = await api.get(`/hr/okrs/${id}`); return r.data; },
  createOkr: async (data: any): Promise<any> => { const r = await api.post('/hr/okrs', data); return r.data; },
  updateOkr: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/okrs/${id}`, data); return r.data; },
  deleteOkr: async (id: string): Promise<any> => { const r = await api.delete(`/hr/okrs/${id}`); return r.data; },
  getKeyResults: async (okrId: string): Promise<any> => { const r = await api.get(`/hr/key-results/${okrId}`); return r.data; },
  createKeyResult: async (data: any): Promise<any> => { const r = await api.post('/hr/key-results', data); return r.data; },
  updateKeyResult: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/key-results/${id}`, data); return r.data; },
  deleteKeyResult: async (id: string): Promise<any> => { const r = await api.delete(`/hr/key-results/${id}`); return r.data; },
  updateKeyResultProgress: async (id: string, data: any): Promise<any> => { const r = await api.patch(`/hr/key-results/${id}/progress`, data); return r.data; },

  // ── Help Desk ──
  getHelpTickets: async (params?: any): Promise<any> => { const r = await api.get('/hr/help-tickets', { params }); return r.data; },
  getHelpTicket: async (id: string): Promise<any> => { const r = await api.get(`/hr/help-tickets/${id}`); return r.data; },
  createHelpTicket: async (data: any): Promise<any> => { const r = await api.post('/hr/help-tickets', data); return r.data; },
  updateHelpTicket: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/help-tickets/${id}`, data); return r.data; },
  assignHelpTicket: async (id: string, data: any): Promise<any> => { const r = await api.patch(`/hr/help-tickets/${id}/assign`, data); return r.data; },
  resolveHelpTicket: async (id: string): Promise<any> => { const r = await api.patch(`/hr/help-tickets/${id}/resolve`); return r.data; },
  reopenHelpTicket: async (id: string): Promise<any> => { const r = await api.patch(`/hr/help-tickets/${id}/reopen`); return r.data; },
  closeHelpTicket: async (id: string): Promise<any> => { const r = await api.patch(`/hr/help-tickets/${id}/close`); return r.data; },
  getTicketResponses: async (ticketId: string): Promise<any> => { const r = await api.get(`/hr/ticket-responses/${ticketId}`); return r.data; },
  createTicketResponse: async (data: any): Promise<any> => { const r = await api.post('/hr/ticket-responses', data); return r.data; },

  // ── Settings & Policies ──
  getHrSettings: async (): Promise<any> => { const r = await api.get('/hr/settings'); return r.data; },
  getHrSetting: async (key: string): Promise<any> => { const r = await api.get(`/hr/settings/${key}`); return r.data; },
  upsertHrSetting: async (key: string, data: any): Promise<any> => { const r = await api.put(`/hr/settings/${key}`, data); return r.data; },
  getPolicies: async (): Promise<any> => { const r = await api.get('/hr/policies'); return r.data; },
  getPolicy: async (id: string): Promise<any> => { const r = await api.get(`/hr/policies/${id}`); return r.data; },
  createPolicy: async (data: any): Promise<any> => { const r = await api.post('/hr/policies', data); return r.data; },
  updatePolicy: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/policies/${id}`, data); return r.data; },
  deletePolicy: async (id: string): Promise<any> => { const r = await api.delete(`/hr/policies/${id}`); return r.data; },
  // ── Approval Engine ──
  getApprovalConfigs: async (): Promise<any> => { const r = await api.get('/hr/approval/configs'); return r.data; },
  getApprovalConfig: async (id: string): Promise<any> => { const r = await api.get(`/hr/approval/configs/${id}`); return r.data; },
  createApprovalConfig: async (data: any): Promise<any> => { const r = await api.post('/hr/approval/configs', data); return r.data; },
  updateApprovalConfig: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/approval/configs/${id}`, data); return r.data; },
  deleteApprovalConfig: async (id: string): Promise<any> => { const r = await api.delete(`/hr/approval/configs/${id}`); return r.data; },
  getApprovalRequests: async (params?: any): Promise<any> => { const r = await api.get('/hr/approval/requests', { params }); return r.data; },
  getApprovalRequest: async (id: string): Promise<any> => { const r = await api.get(`/hr/approval/requests/${id}`); return r.data; },
  createApprovalRequest: async (data: any): Promise<any> => { const r = await api.post('/hr/approval/requests', data); return r.data; },
  cancelApprovalRequest: async (id: string): Promise<any> => { const r = await api.patch(`/hr/approval/requests/${id}/cancel`); return r.data; },
  getApprovalSteps: async (requestId: string): Promise<any> => { const r = await api.get(`/hr/approval/requests/${requestId}/steps`); return r.data; },
  approveApprovalStep: async (requestId: string, comment?: string): Promise<any> => { const r = await api.post(`/hr/approval/requests/${requestId}/approve`, { comment }); return r.data; },
  rejectApprovalStep: async (requestId: string, comment?: string): Promise<any> => { const r = await api.post(`/hr/approval/requests/${requestId}/reject`, { comment }); return r.data; },
  sendBackApprovalStep: async (requestId: string, comment?: string): Promise<any> => { const r = await api.post(`/hr/approval/requests/${requestId}/send-back`, { comment }); return r.data; },
  escalateApprovalRequest: async (requestId: string, escalateToUserId: string, comment?: string): Promise<any> => { const r = await api.post(`/hr/approval/requests/${requestId}/escalate`, { escalateToUserId, comment }); return r.data; },
  delegateApprovalStep: async (requestId: string, delegateToUserId: string): Promise<any> => { const r = await api.post(`/hr/approval/requests/${requestId}/delegate`, { delegateToUserId }); return r.data; },
  getApprovalComments: async (requestId: string): Promise<any> => { const r = await api.get(`/hr/approval/requests/${requestId}/comments`); return r.data; },
  addApprovalComment: async (requestId: string, comment: string, stepInstanceId?: string): Promise<any> => { const r = await api.post(`/hr/approval/requests/${requestId}/comments`, { comment, stepInstanceId }); return r.data; },
  getMyApprovalQueue: async (params?: any): Promise<any> => { const r = await api.get('/hr/approval/my-queue', { params }); return r.data; },
  getDelegations: async (employeeId?: string): Promise<any> => { const r = await api.get('/hr/approval/delegations', { params: { employeeId } }); return r.data; },
  createDelegation: async (data: any): Promise<any> => { const r = await api.post('/hr/approval/delegations', data); return r.data; },
  deleteDelegation: async (id: string): Promise<any> => { const r = await api.delete(`/hr/approval/delegations/${id}`); return r.data; },
  getEscalationRules: async (module?: string): Promise<any> => { const r = await api.get('/hr/approval/escalation-rules', { params: { module } }); return r.data; },
  createEscalationRule: async (data: any): Promise<any> => { const r = await api.post('/hr/approval/escalation-rules', data); return r.data; },
  deleteEscalationRule: async (id: string): Promise<any> => { const r = await api.delete(`/hr/approval/escalation-rules/${id}`); return r.data; },
  checkEscalations: async (): Promise<any> => { const r = await api.post('/hr/approval/check-escalations'); return r.data; },
  getApprovalHistory: async (params?: any): Promise<any> => { const r = await api.get('/hr/approval/history', { params }); return r.data; },
  getApprovalDashboard: async (): Promise<any> => { const r = await api.get('/hr/approval/dashboard'); return r.data; },
  // ── HR Reports Engine ──
  getReportEmployees: async (params?: any): Promise<any> => { const r = await api.get('/hr/reports/employees', { params }); return r.data; },
  getReportEmployeeDetail: async (id: string): Promise<any> => { const r = await api.get(`/hr/reports/employees/${id}`); return r.data; },
  getReportLeave: async (params?: any): Promise<any> => { const r = await api.get('/hr/reports/leave', { params }); return r.data; },
  getReportLeaveBalances: async (employeeId?: string): Promise<any> => { const r = await api.get('/hr/reports/leave/balances', { params: { employeeId } }); return r.data; },
  getReportAttendance: async (params?: any): Promise<any> => { const r = await api.get('/hr/reports/attendance', { params }); return r.data; },
  getReportPerformance: async (params?: any): Promise<any> => { const r = await api.get('/hr/reports/performance', { params }); return r.data; },
  getReportTravel: async (params?: any): Promise<any> => { const r = await api.get('/hr/reports/travel', { params }); return r.data; },
  getReportCompensation: async (params?: any): Promise<any> => { const r = await api.get('/hr/reports/compensation', { params }); return r.data; },
  getReportTurnover: async (params?: any): Promise<any> => { const r = await api.get('/hr/reports/turnover', { params }); return r.data; },
  getReportRecruitment: async (params?: any): Promise<any> => { const r = await api.get('/hr/reports/recruitment', { params }); return r.data; },
  getReportKpiDashboard: async (): Promise<any> => { const r = await api.get('/hr/reports/kpi-dashboard'); return r.data; },
  getReportExport: async (reportType: string, params?: any): Promise<any> => { const r = await api.get(`/hr/reports/export/${reportType}`, { params }); return r.data; },
  getReportDrillDown: async (reportType: string, groupKey: string, groupValue: string, params?: any): Promise<any> => { const r = await api.get(`/hr/reports/drill-down/${reportType}/${groupKey}/${groupValue}`, { params }); return r.data; },
  getScheduledReports: async (): Promise<any> => { const r = await api.get('/hr/reports/scheduled'); return r.data; },
  createScheduledReport: async (data: any): Promise<any> => { const r = await api.post('/hr/reports/scheduled', data); return r.data; },
  deleteScheduledReport: async (id: string): Promise<any> => { const r = await api.delete(`/hr/reports/scheduled/${id}`); return r.data; },
  // ── HR Workflow Engine ──
  getWorkflowTemplates: async (): Promise<any> => { const r = await api.get('/hr/workflow/templates'); return r.data; },
  getWorkflowTemplate: async (id: string): Promise<any> => { const r = await api.get(`/hr/workflow/templates/${id}`); return r.data; },
  createWorkflowTemplate: async (data: any): Promise<any> => { const r = await api.post('/hr/workflow/templates', data); return r.data; },
  updateWorkflowTemplate: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/workflow/templates/${id}`, data); return r.data; },
  deleteWorkflowTemplate: async (id: string): Promise<any> => { const r = await api.delete(`/hr/workflow/templates/${id}`); return r.data; },
  executeWorkflow: async (data: any): Promise<any> => { const r = await api.post('/hr/workflow/execute', data); return r.data; },
  dispatchWorkflowEvent: async (data: any): Promise<any> => { const r = await api.post('/hr/workflow/dispatch', data); return r.data; },
  getAutomationRules: async (event?: string): Promise<any> => { const r = await api.get('/hr/automation-rules', { params: { event } }); return r.data; },
  createAutomationRule: async (data: any): Promise<any> => { const r = await api.post('/hr/automation-rules', data); return r.data; },
  updateAutomationRule: async (id: string, data: any): Promise<any> => { const r = await api.put(`/hr/automation-rules/${id}`, data); return r.data; },
  deleteAutomationRule: async (id: string): Promise<any> => { const r = await api.delete(`/hr/automation-rules/${id}`); return r.data; },
  getNotifications: async (employeeId?: string, unreadOnly?: boolean): Promise<any> => { const r = await api.get('/hr/notifications', { params: { employeeId, unreadOnly } }); return r.data; },
  getUnreadNotificationCount: async (employeeId?: string): Promise<any> => { const r = await api.get('/hr/notifications/unread-count', { params: { employeeId } }); return r.data; },
  markNotificationRead: async (id: string): Promise<any> => { const r = await api.patch(`/hr/notifications/${id}/read`); return r.data; },
  markAllNotificationsRead: async (employeeId?: string): Promise<any> => { const r = await api.post('/hr/notifications/mark-all-read', { employeeId }); return r.data; },
  createNotification: async (data: any): Promise<any> => { const r = await api.post('/hr/notifications', data); return r.data; },
  getReminderConfigs: async (type?: string): Promise<any> => { const r = await api.get('/hr/reminder-configs', { params: { type } }); return r.data; },
  createReminderConfig: async (data: any): Promise<any> => { const r = await api.post('/hr/reminder-configs', data); return r.data; },
  deleteReminderConfig: async (id: string): Promise<any> => { const r = await api.delete(`/hr/reminder-configs/${id}`); return r.data; },
  runScheduledAlerts: async (): Promise<any> => { const r = await api.post('/hr/run-alerts'); return r.data; },
  getWorkflowDashboard: async (employeeId?: string): Promise<any> => { const r = await api.get('/hr/workflow/dashboard', { params: { employeeId } }); return r.data; },
  // ── Calendar Events ──
  getCalendarEvents: async (params?: any): Promise<any> => { const r = await api.get('/hr/calendar-events', { params }); return r.data; },
  createCalendarEvent: async (data: any): Promise<any> => { const r = await api.post('/hr/calendar-events', data); return r.data; },
  markCalendarEventRead: async (id: string): Promise<any> => { const r = await api.patch(`/hr/calendar-events/${id}/read`); return r.data; },
  // ── Document Requests ──
  getDocumentRequests: async (params?: any): Promise<any> => { const r = await api.get('/hr/document-requests', { params }); return r.data; },
  createDocumentRequest: async (data: any): Promise<any> => { const r = await api.post('/hr/document-requests', data); return r.data; },
  completeDocumentRequest: async (id: string): Promise<any> => { const r = await api.patch(`/hr/document-requests/${id}/complete`); return r.data; },
  // ── Renewal Tracking ──
  getRenewals: async (params?: any): Promise<any> => { const r = await api.get('/hr/renewals', { params }); return r.data; },
  getUpcomingRenewals: async (days?: number): Promise<any> => { const r = await api.get('/hr/renewals/upcoming', { params: { days } }); return r.data; },
  createRenewalRecord: async (data: any): Promise<any> => { const r = await api.post('/hr/renewals', data); return r.data; },
  processRenewal: async (id: string, data: any): Promise<any> => { const r = await api.patch(`/hr/renewals/${id}/renew`, data); return r.data; },
  checkUpcomingRenewals: async (): Promise<any> => { const r = await api.post('/hr/renewals/check'); return r.data; },
  // ── Policy Acknowledgements ──
  getPolicyAcknowledgements: async (params?: any): Promise<any> => { const r = await api.get('/hr/policy-acknowledgements', { params }); return r.data; },
  requestPolicyAcknowledgement: async (data: any): Promise<any> => { const r = await api.post('/hr/policy-acknowledgements', data); return r.data; },
  acknowledgePolicy: async (id: string): Promise<any> => { const r = await api.patch(`/hr/policy-acknowledgements/${id}/acknowledge`); return r.data; },
  // ── HR Integration Bridges ──
  syncHrEmployeeToPayroll: async (hrEmployeeId: string): Promise<any> => { const r = await api.post(`/hr/integrate/payroll/sync-employee/${hrEmployeeId}`); return r.data; },
  syncTerminationToPayroll: async (hrEmployeeId: string, data: any): Promise<any> => { const r = await api.post(`/hr/integrate/payroll/sync-termination/${hrEmployeeId}`, data); return r.data; },
  bulkSyncAllHrToPayroll: async (): Promise<any> => { const r = await api.post('/hr/integrate/payroll/bulk-sync'); return r.data; },
  getHrDataForPayroll: async (): Promise<any> => { const r = await api.get('/hr/integrate/payroll/hr-data'); return r.data; },
  enrichPayrollRunWithHr: async (runId: string): Promise<any> => { const r = await api.get(`/hr/integrate/payroll/enrich-run/${runId}`); return r.data; },
  postHrCostEntry: async (data: any): Promise<any> => { const r = await api.post('/hr/integrate/accounting/post-cost', data); return r.data; },
  postTimesheetToProject: async (data: any): Promise<any> => { const r = await api.post('/hr/integrate/projects/post-timesheet', data); return r.data; },
  getCrossModuleTasks: async (params?: any): Promise<any> => { const r = await api.get('/hr/integrate/tasks', { params }); return r.data; },
  createCrossModuleTask: async (data: any): Promise<any> => { const r = await api.post('/hr/integrate/tasks', data); return r.data; },
  createCrossModuleEvent: async (data: any): Promise<any> => { const r = await api.post('/hr/integrate/calendar/events', data); return r.data; },
  getHrSystemNotifications: async (): Promise<any> => { const r = await api.get('/hr/integrate/notifications'); return r.data; },
  getHrAiInsights: async (): Promise<any> => { const r = await api.get('/hr/integrate/ai/insights'); return r.data; },
  syncHrDocToSystem: async (hrDocFileId: string): Promise<any> => { const r = await api.post(`/hr/integrate/documents/sync/${hrDocFileId}`); return r.data; },
  createOnboardingTasks: async (employeeId: string, data?: any): Promise<any> => { const r = await api.post(`/hr/integrate/onboarding/${employeeId}`, data || {}); return r.data; },
  createOffboardingTasks: async (employeeId: string, data: any): Promise<any> => { const r = await api.post(`/hr/integrate/offboarding/${employeeId}`, data); return r.data; },
};
