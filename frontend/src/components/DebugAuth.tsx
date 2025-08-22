import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const DebugAuth: React.FC = () => {
  const authContext = useAuth();
  
  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'white', 
      border: '2px solid #ccc', 
      padding: '15px', 
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      zIndex: 9999,
      maxWidth: '400px',
      fontSize: '12px'
    }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#333' }}>Debug Auth State</h3>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Is Authenticated:</strong> {authContext.isAuthenticated ? 'Yes' : 'No'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Is Loading:</strong> {authContext.isLoading ? 'Yes' : 'No'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Token:</strong> {authContext.token ? authContext.token.substring(0, 20) + '...' : 'No token'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>User:</strong>
        <pre style={{ 
          background: '#f5f5f5', 
          padding: '8px', 
          borderRadius: '4px', 
          margin: '5px 0',
          fontSize: '10px',
          overflow: 'auto',
          maxHeight: '150px'
        }}>
          {authContext.user ? JSON.stringify(authContext.user, null, 2) : 'No user data'}
        </pre>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Is Admin:</strong> {authContext.isAdmin ? authContext.isAdmin() : 'Function not available'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Is Support:</strong> {authContext.isSupport ? authContext.isSupport() : 'Function not available'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Error:</strong> {authContext.error || 'None'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>Current URL:</strong> {window.location.pathname}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>LocalStorage Token:</strong> {localStorage.getItem('token') ? 'Present' : 'Not found'}
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <strong>LocalStorage User:</strong> {localStorage.getItem('user') ? 'Present' : 'Not found'}
      </div>
    </div>
  );
};

export default DebugAuth;