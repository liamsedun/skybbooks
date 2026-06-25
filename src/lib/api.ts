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
      config.url.includes('/auth/refresh')
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
        window.location.href = '#/login'; // Client-side router path
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
};

// 2. Organisation Management
export const orgApi = {
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
    const res = await api.get('/organisations/users');
    return res.data;
  },
  inviteUser: async (data: any) => {
    const res = await api.post('/organisations/users/invite', data);
    return res.data;
  },
  updateUser: async (userId: string, data: any) => {
    const res = await api.patch(`/organisations/users/${userId}`, data);
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
  reconcileTransaction: async (transactionId: string, journalLineId: string) => {
    const res = await api.patch(`/banking/transactions/${transactionId}/reconcile`, { journalLineId });
    return res.data;
  },
  createRecordFromFeed: async (transactionId: string, data: any) => {
    const res = await api.post(`/banking/transactions/${transactionId}/create-record`, data);
    return res.data;
  },
  autoMatchTransactions: async (accountId: string) => {
    const res = await api.post(`/banking/accounts/${accountId}/auto-match`);
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
  getPaymentsMade: async () => {
    const res = await api.get('/purchases/payments');
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
  getExpenses: async () => {
    const res = await api.get('/purchases/expenses');
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
};

// 7. Reports Endpoints
export const reportsApi = {
  getTrialBalance: async (params: { startDate: string; endDate: string; format?: 'json' | 'pdf' | 'excel' }) => {
    const res = await api.get('/reports/trial-balance', { params });
    return res.data;
  },
  getIncomeStatement: async (params: { startDate: string; endDate: string; format?: 'json' | 'pdf' | 'excel' }) => {
    const res = await api.get('/reports/income-statement', { params });
    return res.data;
  },
  getBalanceSheet: async (params: { asOfDate?: string; format?: 'json' | 'pdf' | 'excel' }) => {
    const res = await api.get('/reports/balance-sheet', { params });
    return res.data;
  },
  getCashFlow: async (params: { startDate: string; endDate: string; format?: 'json' | 'pdf' | 'excel' }) => {
    const res = await api.get('/reports/cash-flow', { params });
    return res.data;
  },
  getGeneralLedger: async (params: { accountId: string; startDate: string; endDate: string; format?: 'pdf' | 'excel' }) => {
    const res = await api.get('/reports/general-ledger', { params });
    return res.data;
  },
  getAgedReceivables: async (params?: { format?: 'json' | 'pdf' | 'excel' }) => {
    const res = await api.get('/reports/aged-receivables', { params });
    return res.data;
  },
  getAgedPayables: async (params?: { format?: 'json' | 'pdf' | 'excel' }) => {
    const res = await api.get('/reports/aged-payables', { params });
    return res.data;
  },
  getPayrollSchedule: async (params: { runId: string; format?: 'pdf' | 'excel' }) => {
    const res = await api.get('/reports/payroll-schedule', { params });
    return res.data;
  },
};


