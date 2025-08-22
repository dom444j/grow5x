// src/lib/types.ts
export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; message: string; code?: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
export const isOk = <T,>(r: ApiResponse<T>): r is ApiSuccess<T> => r.success === true;

// Catálogo / packages
export type Package = { id: string; name: string; priceUSDT: number; };
export type PackagesResponse = { packages: Package[] };

// Settings de usuario
export type UserSettings = { 
  firstName: string; 
  lastName: string; 
  phone?: string;
  defaultWithdrawalAddress?: string;
  network?: string;
};

// Reportes – beneficios (lo que la UI usa en Reports.tsx)
export type ReportsBenefitsResponse = {
  todayGenerated: number;   // requerido por Reports.tsx
  rangeGenerated: number;   // idem
  count: number;
  averagePerUser: number;
};

// Utilidad de fecha
export type DateRange = { start: string; end: string }; // usado por DateRangeInputs

// Tipo para manejo de errores en UI
export type UIError = { message: string } | Error | null;