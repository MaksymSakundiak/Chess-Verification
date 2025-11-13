import React, { useEffect } from 'react';

const LichessCallback: React.FC = () => {
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const state = urlParams.get('state');
    
    console.log('🔗 LichessCallback: Received OAuth response', { code: code ? 'present' : 'missing', error, errorDescription, state });
    
    if (error) {
      // Якщо є помилка, повідомляємо батьківське вікно
      console.error('❌ LichessCallback: OAuth error received', error, errorDescription);
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'LICHESS_AUTH_ERROR',
          error: error,
          errorDescription: errorDescription || null,
          // include state so parent can validate origin-independent messages
          state: state || null
        }, '*');
        // Give the parent window time to process the message
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        // Same-window mode: store error and redirect
        console.error('No parent window found for error message, using localStorage fallback');
        localStorage.setItem('lichess_oauth_error', error);
        localStorage.setItem('lichess_oauth_error_description', errorDescription || '');
        window.location.href = '/';
      }
      return;
    }
    
    if (code) {
      // Якщо є код авторизації, повідомляємо батьківське вікно про успіх
      console.log('✅ LichessCallback: Authorization code received');
      if (window.opener && !window.opener.closed) {
        // Popup mode: send message to parent window
        window.opener.postMessage({
          type: 'LICHESS_AUTH_SUCCESS',
          code: code,
          // include state so parent can validate origin-independent messages
          state: state || null
        }, '*');
        console.log('✅ LichessCallback: Success message sent to parent window');
        // Give the parent window time to process the message before closing
        setTimeout(() => {
          if (!window.opener || window.opener.closed) {
            console.log('Parent window already closed');
          }
          window.close();
        }, 1000);
      } else {
        // Same-window mode: store code in localStorage and redirect to main page
        console.log('⚠️ LichessCallback: No parent window found, using localStorage fallback');
        localStorage.setItem('lichess_oauth_code', code);
        localStorage.setItem('lichess_oauth_state_callback', state || '');
        localStorage.setItem('lichess_oauth_pending', 'true');
        // Redirect to main page
        window.location.href = '/';
      }
    } else {
      // No code and no error - this shouldn't happen, but handle it gracefully
      console.warn('⚠️ LichessCallback: No code or error in URL parameters');
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'LICHESS_AUTH_ERROR',
          error: 'missing_code',
          errorDescription: 'No authorization code received from Lichess',
          state: state || null
        }, '*');
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        // Same-window mode: store error and redirect
        localStorage.setItem('lichess_oauth_error', 'missing_code');
        localStorage.setItem('lichess_oauth_error_description', 'No authorization code received from Lichess');
        window.location.href = '/';
      }
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      textAlign: 'center',
      padding: '20px',
      background: '#fafafa',
      color: '#1a1a1a'
    }}>
      <h2 style={{ 
        fontSize: '20px', 
        fontWeight: 600, 
        margin: '0 0 16px 0',
        color: '#1a1a1a'
      }}>Lichess Верифікація</h2>
      <p style={{ 
        fontSize: '14px', 
        color: '#666', 
        margin: '0 0 24px 0' 
      }}>Обробка авторизації...</p>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid #e5e5e5',
        borderTop: '3px solid #2c3e50',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        margin: '0'
      }}></div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LichessCallback;
