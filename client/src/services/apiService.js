// src/services/apiService.js
import API_URL from '../config/api';

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('token') || '';
};

// Generic API call function
const apiCall = async (endpoint, options = {}) => {
  const token = getAuthToken();
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_URL}${endpoint}`, config);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API request failed');
  }
  
  return response.json();
};

// Auth Services
export const authService = {
  register: (userData) => apiCall('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),
  
  login: (credentials) => apiCall('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  
  logout: () => apiCall('/auth/logout', { method: 'POST' }),
};

// Transaction Services
export const transactionService = {
  getAll: () => apiCall('/transactions'),
  
  create: (data) => apiCall('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  update: (id, data) => apiCall(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  delete: (id) => apiCall(`/transactions/${id}`, { method: 'DELETE' }),
};

// Expense Services
export const expenseService = {
  getAll: () => apiCall('/expenses'),
  create: (data) => apiCall('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Budget Services
export const budgetService = {
  getAll: () => apiCall('/budgets'),
  create: (data) => apiCall('/budgets', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Category Services
export const categoryService = {
  getAll: () => apiCall('/categories'),
};

// Export all services
export default {
  auth: authService,
  transactions: transactionService,
  expenses: expenseService,
  budgets: budgetService,
  categories: categoryService,
};