import React, { useEffect } from 'react';

const ChesscomCallback: React.FC = () => {
  useEffect(() => {
    console.log('Chess.com callback component mounted');
    console.log('Current URL:', window.location.href);
    
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const state = urlParams.get('state');
    
    console.log('URL parameters:', { code, error, state });
    
    if (error) {
      console.error('Chess.com OAuth error:', error);
      // Якщо є помилка, повідомляємо батьківське вікно
      if (window.opener) {
        window.opener.postMessage({
          type: 'CHESSCOM_AUTH_ERROR',
          error: error,
          state: state || null
        }, '*');
      }
      window.close();
      return;
    }

    if (code) {
      console.log('Chess.com OAuth code received:', code);
      // Якщо є код авторизації, повідомляємо батьківське вікно про успіх
      if (window.opener) {
        console.log('Sending success message to parent window');
        window.opener.postMessage({
          type: 'CHESSCOM_AUTH_SUCCESS',
          code: code,
          state: state || null
        }, '*');
      } else {
        console.log('No parent window found');
      }

      // Показуємо повідомлення про успіх
      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      console.log('No code or error found in URL parameters');
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <h2>Chess.com Верифікація</h2>
      <p>Обробка авторизації...</p>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #e74c3c',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '20px 0'
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

export default ChesscomCallback;
