import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import AdminRoute from './components/routing/AdminRoute';
import UserRoute from './components/routing/UserRoute';

// Public pages
import LandingPage from './pages/public/LandingPage.jsx';
import ReferralLinkHandler from './pages/public/ReferralLinkHandler.tsx';
import Status from './pages/public/Status.jsx';
import Terms from './pages/Terms.jsx';
import Privacy from './pages/Privacy.jsx';

// Auth pages
import UserLogin from './pages/auth/UserLogin';
import AdminLogin from './pages/admin/AdminLogin';
import Register from './pages/auth/Register.tsx';
import ForgotPassword from './pages/auth/ForgotPassword.tsx';

// Error pages
import Forbidden from './pages/errors/403';

// User pages with hooks
import DashboardWithHooks from './components/DashboardWithHooks.tsx';
import PackagesWithHooks from './components/PackagesWithHooks.tsx';
import WithdrawalsWithHooks from './components/WithdrawalsWithHooks.tsx';
import Benefits from './pages/user/Benefits.tsx';
import Settings from './pages/user/Settings.tsx';

// User pages with UserLayout
import Packages from './pages/user/Packages.tsx';
import Purchases from './pages/user/Purchases.tsx';
import UserLicenses from './pages/user/UserLicenses.tsx';
import Withdrawals from './pages/user/Withdrawals.tsx';
import MyWallet from './pages/user/MyWallet.tsx';

// Admin pages
import AdminOverview from './pages/admin/Overview.tsx';
import AdminPurchases from './pages/admin/Purchases.tsx';
import AdminWithdrawals from './pages/admin/Withdrawals.tsx';
import AdminHealth from './pages/admin/Health.tsx';
import AdminImportJobs from './pages/admin/ImportJobs.tsx';
import AdminCohorts from './pages/admin/Cohorts.tsx';
import AdminUsers from './pages/admin/Users.tsx';
import AdminReports from './pages/admin/Reports.tsx';
import AdminReferrals from './pages/admin/Referrals.tsx';
import AdminPackages from './pages/admin/Packages.tsx';
import AdminLicenses from './pages/admin/Licenses.tsx';

// User referrals page
import UserReferrals from './pages/user/UserReferrals.tsx';

// Support pages
import SupportDashboard from './pages/admin/support/SupportDashboard.tsx';
import SupportUsers from './pages/admin/support/Users.tsx';
import SupportPurchases from './pages/admin/support/Purchases.tsx';
import SupportWithdrawals from './pages/admin/support/Withdrawals.tsx';



export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
          <div className="min-h-screen bg-gray-50">
            <Routes>
              {/* PÚBLICO */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/r/:code" element={<ReferralLinkHandler />} />
              <Route path="/status" element={<Status />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              
              {/* AUTH PÚBLICAS */}
              <Route path="/login" element={<UserLogin />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              
              {/* ERROR PAGES */}
              <Route path="/403" element={<Forbidden />} />

              {/* ÁREA USUARIO */}
              <Route element={<UserRoute />}>
                <Route path="/user/dashboard" element={<DashboardWithHooks />} />
                <Route path="/user/packages" element={<Packages />} />
                <Route path="/user/purchases" element={<Purchases />} />
                <Route path="/user/licenses" element={<UserLicenses />} />
                <Route path="/user/withdrawals" element={<Withdrawals />} />
                <Route path="/user/wallet" element={<MyWallet />} />
                <Route path="/user/referrals" element={<UserReferrals />} />
                <Route path="/user/settings" element={<Settings />} />
              </Route>
              
              {/* LEGACY REDIRECTS - Redirigir rutas antiguas a las nuevas */}
              <Route path="/dashboard" element={<Navigate to="/user/dashboard" replace />} />
              <Route path="/packages" element={<Navigate to="/user/packages" replace />} />
              <Route path="/withdrawals" element={<Navigate to="/user/withdrawals" replace />} />
              <Route path="/settings" element={<Navigate to="/user/settings" replace />} />
              <Route path="/benefits" element={<Navigate to="/user/dashboard" replace />} />

              {/* ÁREA ADMIN */}
              <Route element={<AdminRoute />}>
                <Route path="/admin" element={<Navigate to="/admin/overview" replace />} />
                <Route path="/admin/overview" element={<AdminOverview />} />
                <Route path="/admin/packages" element={<AdminPackages />} />
                <Route path="/admin/purchases" element={<AdminPurchases />} />
                <Route path="/admin/withdrawals" element={<AdminWithdrawals />} />
                <Route path="/admin/import-jobs" element={<AdminImportJobs />} />
                <Route path="/admin/cohorts" element={<AdminCohorts />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/health" element={<AdminHealth />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/referrals" element={<AdminReferrals />} />
                <Route path="/admin/licenses" element={<AdminLicenses />} />
                
                {/* SUPPORT ROUTES */}
                <Route path="/admin/support" element={<SupportDashboard />} />
                <Route path="/admin/support/users" element={<SupportUsers />} />
                <Route path="/admin/support/purchases" element={<SupportPurchases />} />
                <Route path="/admin/support/withdrawals" element={<SupportWithdrawals />} />
              </Route>

              {/* Fallback: cualquier cosa desconocida vuelve a la landing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          
          {/* Toast notifications */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}