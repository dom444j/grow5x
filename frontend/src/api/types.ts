// Facade de tipos para reportes - evita dependencia dura del generador OpenAPI
// Solo incluye los tipos que realmente usa el frontend

// Rango estándar de reportes
export type ReportsRange = { from: string; to: string };

// Tipos individuales de reportes
export type SalesReportItem = {
  packageId: string;
  packageName: string;
  count: number;
  amountUSDT: number;
  totalPurchases: number;
  totalAmountUSDT: number;
};

export type ReferralsReportItem = {
  type: 'DIRECT' | 'PARENT_GLOBAL';
  status: 'pending' | 'released';
  count: number;
  amountUSDT: number;
};

export type BenefitsReportItem = {
  generatedTodayUSDT: number;
  generatedRangeUSDT: number;
  pendingCount: number;
  paidCount: number;
};

export type WithdrawalsReportItem = {
  status: string;
  count: number;
  amountUSDT: number;
  avgProcessingMinutes7d: number;
  slaHitRate7d: number;
};

// Respuestas de reportes con estructura de datos
export type ReportsSalesResponse = {
  data: SalesReportItem[];
  range: ReportsRange;
  totalPurchases: number;
  totalAmountUSDT: number;
};

export type ReportsReferralsResponse = {
  success: boolean;
  data: {
    direct: {
      pending: number;
      released: number;
      total: number;
    };
    parentGlobal: {
      pending: number;
      released: number;
      total: number;
    };
    grandTotal: number;
  };
  message: string;
};

export type ReportsBenefitsResponse = {
  success: boolean;
  data: {
    todayGenerated: number;
    rangeGenerated: number;
    totalBeneficiaries: number;
    activeBenefitSchedules: number;
  };
  message: string;
};

export type ReportsWithdrawalsResponse = {
  success: boolean;
  data: {
    statusBreakdown: {
      pending: { count: number; amount: number; };
      approved: { count: number; amount: number; };
      rejected: { count: number; amount: number; };
      completed: { count: number; amount: number; };
    };
    slaMetrics: {
      avgProcessingMinutes: number | null;
      slaHitRate: number;
    };
  };
  message: string;
};

// Tipos para compatibilidad con el código existente
export type ReferralsReportItemCompat = {
  type: 'DIRECT' | 'PARENT_GLOBAL';
  status: 'pending' | 'released';
  count: number;
  amountUSDT: number;
};

export type BenefitsReportItemCompat = {
  generatedTodayUSDT: number;
  generatedRangeUSDT: number;
  pendingCount: number;
  paidCount: number;
};

export type WithdrawalsReportItemCompat = {
  status: string;
  count: number;
  amountUSDT: number;
  avgProcessingMinutes7d: number;
  slaHitRate7d: number;
};

// Tipos adicionales para el frontend
export type DateRange = {
  from: string;
  to: string;
};

export type Package = {
  _id: string;
  name: string;
  priceUSDT: number;
  dailyReturnRate: number;
  durationDays: number;
  isActive: boolean;
};

// Import User type from main API types
export type { User } from '../types/api';

export type Purchase = {
  _id: string;
  userId: string;
  packageId: string;
  amountUSDT: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
};

export type Withdrawal = {
  _id: string;
  userId: string;
  amountUSDT: number;
  walletAddress: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requestedAt: string;
  processedAt?: string;
};

// Tipos específicos para el sistema de retiros de usuario
export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export type WithdrawalItem = {
  id: string;
  amountUSDT: number;
  address: string;        // mostrado abreviado en UI
  network: 'BEP20';
  status: WithdrawalStatus;
  requestedAt: string;    // ISO
  approvedAt?: string;
  completedAt?: string;
  processingTargetMinutes?: number;
  processingETA?: string; // ISO; calculado al aprobar
};

export type WithdrawalsListResponse = {
  items: WithdrawalItem[];
  total: number;
};

export type CreateWithdrawalRequest = {
  amountUSDT: number;
  address: string;
  otpCode: string; // 6 dígitos
};

export type CreateWithdrawalResponse = {
  id: string;
  status: WithdrawalStatus;      // normalmente 'pending'
  requestedAt: string;           // ISO
};