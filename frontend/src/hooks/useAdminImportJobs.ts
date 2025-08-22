import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { getJSON, postJSON } from '../services/api';
import { UIError } from '../lib/types';

interface ImportJob {
  id: string;
  filename: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  type: 'users' | 'purchases' | 'withdrawals';
  totalRows: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  errors?: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface ImportJobFilters {
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

interface UseAdminImportJobs {
  jobs: ImportJob[];
  loading: boolean;
  error: UIError;
  totalPages: number;
  currentPage: number;
  refetch: () => Promise<void>;
  uploadFile: (file: File, type: string) => Promise<boolean>;
  runJob: (jobId: string) => Promise<boolean>;
  deleteJob: (jobId: string) => Promise<boolean>;
  downloadReport: (jobId: string) => Promise<void>;
  setFilters: (filters: ImportJobFilters) => void;
  filters: ImportJobFilters;
}

export const useAdminImportJobs = (initialFilters: ImportJobFilters = {}): UseAdminImportJobs => {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UIError>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<ImportJobFilters>({
    page: 1,
    limit: 10,
    ...initialFilters
  });

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
      
      const queryString = params.toString();
      const url = `/admin/import-jobs${queryString ? `?${queryString}` : ''}`;
      const response = await getJSON(url);
      
      setJobs(response?.jobs || []);
      setTotalPages(response?.totalPages || 1);
      setCurrentPage(response?.currentPage || 1);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar trabajos de importación';
      setError({ message: errorMessage });
      console.error('Error fetching import jobs:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const uploadFile = async (file: File, type: string): Promise<boolean> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      
      await postJSON('/admin/import-jobs/upload', formData);
      
      toast.success('Archivo subido correctamente');
      await fetchJobs();
      return true;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Error al subir archivo';
      toast.error(errorMessage);
      console.error('Error uploading file:', err);
      return false;
    }
  };

  const runJob = async (jobId: string): Promise<boolean> => {
    try {
      await postJSON(`/admin/import-jobs/${jobId}/run`);
      toast.success('Trabajo iniciado correctamente');
      await fetchJobs();
      return true;
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al iniciar trabajo';
      toast.error(errorMessage);
      console.error('Error running job:', err);
      return false;
    }
  };

  const deleteJob = async (jobId: string): Promise<boolean> => {
    try {
      await postJSON(`/admin/import-jobs/${jobId}`, null, 'DELETE');
      toast.success('Trabajo eliminado correctamente');
      await fetchJobs();
      return true;
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar trabajo';
      toast.error(errorMessage);
      console.error('Error deleting job:', err);
      return false;
    }
  };

  const downloadReport = async (jobId: string): Promise<void> => {
    try {
      const BASE = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${BASE}/admin/import-jobs/${jobId}/report`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `import-job-${jobId}-report.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Reporte descargado correctamente');
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al descargar reporte';
      toast.error(errorMessage);
      console.error('Error downloading report:', err);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return {
    jobs,
    loading,
    error,
    totalPages,
    currentPage,
    refetch: fetchJobs,
    uploadFile,
    runJob,
    deleteJob,
    downloadReport,
    setFilters,
    filters
  };
};