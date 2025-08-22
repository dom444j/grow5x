/**
 * Tipos TypeScript para la API de Grow5X
 * Generados automáticamente basados en OpenAPI 3.0.3
 * 
 * @version 1.0.0
 * @description Interfaces y tipos para todos los endpoints de la API
 */

// ============================================================================
// TIPOS BASE Y UTILIDADES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    [key: string]: T[];
    pagination: Pagination;
  };
}

// ============================================================================
// MODELOS DE DATOS PRINCIPALES
// ============================================================================

export interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  role: 'user' | 'admin' | 'support' | 'padre';
  referralCode: string;
  isActive: boolean;
  isVerified: boolean;
  balances: {
    available: number;
    pending: number;
    total: number;
  };
  referralStats: {
    directReferrals: number;
    totalReferrals: number;
    totalCommissions: number;
  };
  lastLoginAt: string;
  createdAt: string;
}

export interface UserProfile extends User {
  referredBy?: {
    userId: string;
    email: string;
    fullName: string;
  } | null;
  statistics: {
    totalPurchases: number;
    totalInvested: number;
    totalEarned: number;
    activePackages: number;
  };
}

export interface AdminUserView extends User {
  referredBy?: {
    userId: string;
    email: string;
    fullName: string;
  } | null;
}

export interface Package {
  packageId: string;
  name: string;
  price: number;
  currency: string;
  dailyBenefitRate: number;
  dailyBenefitPercentage: string;
  benefitDays: number;
  totalCycles: number;
  totalDurationDays: number;
  totalBenefitAmount: number;
  totalROI: number;
  commissionRates: {
    directReferralRate: number;
    parentBonusRate: number;
  };
  description: string;
  features: string[];
  minPurchase: number;
  maxPurchase: number;
  isActive: boolean;
  isVisible: boolean;
  createdAt: string;
}

export interface Purchase {
  purchaseId: string;
  user: {
    userId: string;
    email: string;
  };
  package: {
    packageId: string;
    name: string;
  };
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  status: 'pending' | 'hash_submitted' | 'confirmed' | 'rejected';
  assignedWallet: {
    address: string;
    network: string;
  };
  transactionHash?: string | null;
  paymentDeadline: string;
  createdAt: string;
  confirmedAt?: string | null;
}

export interface PendingPurchase extends Purchase {
  waitingTime: number; // Tiempo de espera en minutos
}

export interface Withdrawal {
  withdrawalId: string;
  user: {
    userId: string;
    email: string;
  };
  amount: number;
  currency: string;
  destinationAddress: string;
  network: string;
  status: 'pending' | 'approved' | 'completed' | 'rejected';
  txHash?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  completedAt?: string | null;
  rejectedAt?: string | null;
  adminNotes?: string | null;
}

export interface Commission {
  commissionId: string;
  earner: {
    userId: string;
    email: string;
  };
  source: {
    userId: string;
    email: string;
  };
  purchase: {
    purchaseId: string;
    packageName: string;
  };
  commissionAmount: number;
  commissionRate: number;
  type: 'direct_referral' | 'parent_bonus';
  status: 'pending' | 'unlocked' | 'paid';
  unlockDate: string;
  createdAt: string;
  paidAt?: string | null;
}

export interface Transaction {
  transactionId: string;
  user: {
    userId: string;
  };
  type: 'purchase' | 'commission' | 'withdrawal' | 'daily_benefit';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  reference: {
    type: string;
    id: string;
  };
  createdAt: string;
  processedAt?: string | null;
}

// ============================================================================
// REQUEST PAYLOADS
// ============================================================================

export interface RegisterRequest {
  email: string;
  password: string;
  referralCode: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  telegramUsername?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  country?: string;
  telegramUsername?: string;
}

export interface SubmitPaymentRequest {
  packageId: string;
  quantity: number; // 1-10
}

export interface ConfirmHashRequest {
  purchaseId: string;
  transactionHash: string;
}

export interface RequestOTPRequest {
  purpose?: 'withdrawal';
}

export interface WithdrawalRequest {
  amount: number; // 50-10000
  currency: 'USDT';
  destinationAddress: string; // 26-50 chars
  network: 'BEP20';
  otp: string; // 6 digits OTP from Telegram
}

export interface AdminPaymentActionRequest {
  purchaseId: string;
  action: 'confirm' | 'reject';
  notes?: string;
}

export interface AdminWithdrawalApproveRequest {
  notes?: string;
}

export interface AdminWithdrawalRejectRequest {
  reason?: string;
  notes?: string;
}

export interface AdminWithdrawalCompleteRequest {
  txHash: string;
  notes?: string;
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
    expiresIn: string;
  };
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  environment: string;
  database: {
    status: string;
  };
  version: string;
}

export interface PackagesResponse {
  success: boolean;
  data: {
    packages: Package[];
    count: number;
  };
}

export interface CommissionCalculation {
  package: Package;
  calculation: {
    quantity: number;
    totalInvestment: number;
    commissionBreakdown: {
      level: number;
      rate: number;
      amount: number;
    }[];
  };
}

export interface OTPResponse {
  success: boolean;
  message: string;
  data: {
    otpId: string;
    expiresAt: string;
    remainingAttempts: number;
  };
}

export interface OTPStatusResponse {
  success: boolean;
  data: {
    hasActiveOtp: boolean;
    expiresAt?: string;
    remainingAttempts?: number;
  };
}

export interface DashboardStats {
  success: boolean;
  data: {
    stats: {
      purchases: {
        total: number;
        byStatus: Record<string, {
          count: number;
          totalAmount: number;
        }>;
        totalRevenue: number;
      };
      users: {
        totalUsers: number;
        activeUsers: number;
        verifiedUsers: number;
      };
      commissions: {
        total: number;
        totalAmount: number;
      };
      wallets: {
        total: number;
        byStatus: Record<string, number>;
      };
    };
  };
}

export interface CommissionsResponse {
  success: boolean;
  data: {
    commissions: Commission[];
    pagination: Pagination;
    summary: {
      totalEarned: number;
      totalPending: number;
      totalUnlocked: number;
    };
  };
}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

export interface PackagesQueryParams {
  active?: 'true' | 'false';
  visible?: 'true' | 'false';
  sort?: 'sortOrder' | 'price_asc' | 'price_desc' | 'name';
}

export interface PaginationQueryParams {
  page?: number;
  limit?: number;
}

export interface TransactionsQueryParams extends PaginationQueryParams {
  type?: 'purchase' | 'commission' | 'withdrawal' | 'daily_benefit';
}

export interface WithdrawalsQueryParams extends PaginationQueryParams {
  status?: 'pending' | 'approved' | 'completed' | 'rejected';
}

export interface CommissionsQueryParams extends PaginationQueryParams {
  status?: 'pending' | 'unlocked' | 'paid';
  type?: 'direct_referral' | 'parent_bonus';
}

export interface AdminPendingPaymentsQueryParams extends PaginationQueryParams {
  search?: string;
}

export interface AdminUsersQueryParams extends PaginationQueryParams {
  search?: string;
  status?: 'active' | 'inactive' | 'verified' | 'unverified';
}

export interface AdminWithdrawalsQueryParams extends PaginationQueryParams {
  status?: 'pending' | 'approved' | 'completed' | 'rejected';
  search?: string;
}

// ============================================================================
// API CLIENT TYPES
// ============================================================================

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  errors?: ValidationError[];
  response?: any;
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      first_name: string;
      username?: string;
      type: string;
    };
    date: number;
    text?: string;
  };
}

export interface WebhookStatusResponse {
  success: boolean;
  data?: {
    status: string;
    lastUpdate?: string;
  };
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type UserRole = 'user' | 'admin' | 'support';
export type PurchaseStatus = 'pending' | 'hash_submitted' | 'confirmed' | 'rejected';
export type WithdrawalStatus = 'pending' | 'approved' | 'completed' | 'rejected';
export type CommissionStatus = 'pending' | 'unlocked' | 'paid';
export type TransactionType = 'purchase' | 'commission' | 'withdrawal' | 'daily_benefit';
export type TransactionStatus = 'pending' | 'completed' | 'failed';
export type CommissionType = 'direct_referral' | 'parent_bonus';
export type CryptoCurrency = 'USDT';
export type CryptoNetwork = 'BEP20';
export type SortOrder = 'sortOrder' | 'price_asc' | 'price_desc' | 'name';
export type AdminAction = 'confirm' | 'reject';
export type OTPPurpose = 'withdrawal';

// ============================================================================
// CONSTANTS
// ============================================================================

export const API_ENDPOINTS = {
  // Health
  HEALTH: '/api/health',
  
  // Authentication
  AUTH: {
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
    ME: '/api/me', // Canonical endpoint
    ME_ALIAS: '/api/auth/me', // Legacy alias
    LOGOUT: '/api/auth/logout',
  },
  
  // Packages
  PACKAGES: {
    LIST: '/api/packages',
    BY_ID: (id: string) => `/api/packages/${id}`,
    COMMISSION_CALCULATOR: (id: string) => `/api/packages/${id}/commission-calculator`,
  },
  
  // Payments
  PAYMENTS: {
    SUBMIT: '/api/me/purchases', // New canonical endpoint
    SUBMIT_ALIAS: '/api/payments/submit', // Legacy alias
    CONFIRM_HASH: (id: string) => `/api/me/purchases/${id}/confirm`, // New canonical endpoint
    CONFIRM_HASH_ALIAS: '/api/payments/confirm-hash', // Legacy alias
    MY_PURCHASES: '/api/me/purchases', // Canonical endpoint
    MY_PURCHASES_ALIAS: '/api/payments/my-purchases', // Legacy alias
  },
  
  // User Profile
  USER: {
    PROFILE: '/api/me/profile',
    TRANSACTIONS: '/api/me/transactions',
    WITHDRAWALS: '/api/me/withdrawals',
    COMMISSIONS: '/api/me/commissions',
  },
  
  // OTP
  OTP: {
    REQUEST: '/api/me/otp/request',
    STATUS: '/api/me/otp/status',
  },
  
  // Admin
  ADMIN: {
    PAYMENTS: {
      PENDING: '/api/admin/payments/pending',
      CONFIRM: '/api/admin/payments/confirm',
    },
    DASHBOARD: {
      STATS: '/api/admin/dashboard/stats',
    },
    USERS: {
      LIST: '/api/admin/users',
    },
    WITHDRAWALS: {
      LIST: '/api/admin/withdrawals',
      BY_ID: (id: string) => `/api/admin/withdrawals/${id}`,
      APPROVE: '/api/admin/withdrawals/approve',
      REJECT: '/api/admin/withdrawals/reject',
      COMPLETE: '/api/admin/withdrawals/complete',
    },
  },
  
  // Webhooks
  WEBHOOKS: {
    TELEGRAM: '/api/webhooks/telegram',
    TELEGRAM_STATUS: '/api/webhooks/telegram/status',
  },
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PACKAGE_NOT_FOUND: 'PACKAGE_NOT_FOUND',
  PURCHASE_NOT_FOUND: 'PURCHASE_NOT_FOUND',
  WITHDRAWAL_NOT_FOUND: 'WITHDRAWAL_NOT_FOUND',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  INVALID_REFERRAL_CODE: 'INVALID_REFERRAL_CODE',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  PAYMENT_DEADLINE_EXPIRED: 'PAYMENT_DEADLINE_EXPIRED',
  INVALID_TRANSACTION_HASH: 'INVALID_TRANSACTION_HASH',
  OTP_REQUIRED: 'OTP_REQUIRED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
} as const;

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isApiError(error: any): error is ApiError {
  return error && typeof error === 'object' && 'status' in error;
}

export function isValidationError(error: any): error is { errors: ValidationError[] } {
  return error && typeof error === 'object' && Array.isArray(error.errors);
}

export function isSuccessResponse<T>(response: any): response is ApiResponse<T> {
  return response && typeof response === 'object' && response.success === true;
}

export function isErrorResponse(response: any): response is ApiResponse {
  return response && typeof response === 'object' && response.success === false;
}

// ============================================================================
// EXPORT ALL TYPES
// ============================================================================

export default {
  API_ENDPOINTS,
  HTTP_STATUS,
  ERROR_CODES,
};