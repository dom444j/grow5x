import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const AuthDebug = () => {
  const { user, isAuthenticated, isLoading, ready, error } = useAuth();

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <h4>Auth Debug Info</h4>
      <div>isLoading: {isLoading ? 'true' : 'false'}</div>
      <div>ready: {ready ? 'true' : 'false'}</div>
      <div>isAuthenticated: {isAuthenticated ? 'true' : 'false'}</div>
      <div>user: {user ? JSON.stringify(user, null, 2) : 'null'}</div>
      <div>error: {error ? JSON.stringify(error, null, 2) : 'null'}</div>
      <div>localStorage session: {localStorage.getItem('g5.session') || 'null'}</div>
    </div>
  );
};

export default AuthDebug;