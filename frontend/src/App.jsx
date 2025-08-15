import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Terms from './pages/Terms'
import Privacy from './pages/Privacy'
import Dashboard from './pages/Dashboard'
import Simulator from './pages/Simulator'
import Packages from './pages/Packages'
import Withdrawals from './pages/Withdrawals'
import Admin from './pages/Admin'

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
             <Route path="/" element={<Landing />} />
             <Route path="/terms" element={<Terms />} />
             <Route path="/privacy" element={<Privacy />} />
             <Route path="/login" element={<Login />} />
             <Route path="/register" element={<Register />} />
             <Route path="/simulator" element={<Simulator />} />
             <Route path="/packages" element={<Packages />} />
             <Route 
               path="/dashboard" 
               element={
                 <ProtectedRoute>
                   <Dashboard />
                 </ProtectedRoute>
               } 
             />
             <Route 
               path="/withdrawals" 
               element={
                 <ProtectedRoute>
                   <Withdrawals />
                 </ProtectedRoute>
               } 
             />
             <Route 
               path="/admin" 
               element={
                 <ProtectedRoute>
                   <Admin />
                 </ProtectedRoute>
               } 
             />
           </Routes>
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
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App