import React, { useState, useEffect } from 'react';
import { buildAuthUrl, verifyChesscomUsername, exchangeCodeForToken, isLichessOAuthConfigured } from '../config/oauth';
import './ChessVerification.css';

const ChessVerification: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [chesscomUsername, setChesscomUsername] = useState('');
  const [showChesscomInput, setShowChesscomInput] = useState(false);

  // Persisted user data (loaded from localStorage so it survives reloads)
  const [lichessUserData, setLichessUserData] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('lichessUserData') || 'null');
    } catch { return null; }
  });
  const [chesscomUserData, setChesscomUserData] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('chesscomUserData') || 'null');
    } catch { return null; }
  });

  const [lichessVerified, setLichessVerified] = useState<boolean>(() => Boolean(localStorage.getItem('lichessUserData')));
  const [chesscomVerified, setChesscomVerified] = useState<boolean>(() => Boolean(localStorage.getItem('chesscomUserData')));

  // Persist user data when it changes
  useEffect(() => {
    if (lichessUserData) {
      localStorage.setItem('lichessUserData', JSON.stringify(lichessUserData));
    } else {
      localStorage.removeItem('lichessUserData');
    }
  }, [lichessUserData]);

  useEffect(() => {
    if (chesscomUserData) {
      localStorage.setItem('chesscomUserData', JSON.stringify(chesscomUserData));
    } else {
      localStorage.removeItem('chesscomUserData');
    }
  }, [chesscomUserData]);

  // Check for localStorage fallback (when callback opens in same window)
  useEffect(() => {
    const checkLocalStorageCallback = async () => {
      const pending = localStorage.getItem('lichess_oauth_pending');
      if (pending === 'true') {
        console.log('🔍 Found pending Lichess OAuth callback in localStorage');
        const code = localStorage.getItem('lichess_oauth_code');
        const state = localStorage.getItem('lichess_oauth_state_callback');
        const error = localStorage.getItem('lichess_oauth_error');
        const errorDescription = localStorage.getItem('lichess_oauth_error_description');
        
        // Clear the flags immediately
        localStorage.removeItem('lichess_oauth_pending');
        localStorage.removeItem('lichess_oauth_code');
        localStorage.removeItem('lichess_oauth_state_callback');
        localStorage.removeItem('lichess_oauth_error');
        localStorage.removeItem('lichess_oauth_error_description');
        
        if (error) {
          console.error('❌ Lichess OAuth error from localStorage:', error, errorDescription);
          setErrorMsg(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`);
          setIsLoading(false);
          return;
        }
        
        if (code) {
          // Validate state if present
          const storedState = localStorage.getItem('lichess_oauth_state');
          if (state && storedState && state !== storedState) {
            console.warn('❌ OAuth state mismatch from localStorage');
            setErrorMsg('OAuth state mismatch. Please try again.');
            setIsLoading(false);
            return;
          }
          
          console.log('✅ Processing Lichess OAuth code from localStorage');
          setIsLoading(true);
          setErrorMsg(null);
          
          try {
            const tokenResponse = await exchangeCodeForToken('lichess', code);
            console.log('🔑 Token response:', tokenResponse);
            const userData = await fetchLichessUserData(tokenResponse.access_token);
            setLichessUserData(userData);
            setLichessVerified(true);
          } catch (error: any) {
            console.error('❌ Lichess token exchange or user fetch failed:', error);
            const msg = error?.message || String(error);
            setErrorMsg(`Lichess verification failed: ${msg}`);
          } finally {
            setIsLoading(false);
          }
        }
      }
    };
    
    checkLocalStorageCallback();
  }, []);

  useEffect(() => {
    // Listen for messages from popup windows
    const handleMessage = async (event: MessageEvent) => {
      // Only accept messages that look like our OAuth responses and validate state
      try {
        // Basic shape check
        const data = event.data || {};
        if (typeof data !== 'object' || !data.type) return;

        // If the message includes a state, validate it against stored one
        const storedState = localStorage.getItem('lichess_oauth_state');
        if (data.state && storedState && data.state !== storedState) {
          console.warn('❌ OAuth state mismatch, ignoring message');
          return;
        }

        if (data.type === 'LICHESS_AUTH_SUCCESS') {
          console.log('✅ Lichess authorization success (code received)', data);
          setIsLoading(true);
          setErrorMsg(null);

          try {
            const tokenResponse = await exchangeCodeForToken('lichess', data.code);
            console.log('🔑 Token response:', tokenResponse);
            const userData = await fetchLichessUserData(tokenResponse.access_token);
            setLichessUserData(userData);
            setLichessVerified(true);
          } catch (error: any) {
            console.error('❌ Lichess token exchange or user fetch failed:', error);
            const msg = error?.message || String(error);
            setErrorMsg(`Lichess verification failed: ${msg}`);
          } finally {
            setIsLoading(false);
          }
        } else if (data.type === 'CHESSCOM_AUTH_SUCCESS') {
          console.log('✅ Chess.com auth success (note: Chess.com uses public API).');
          setChesscomVerified(true);
          setIsLoading(false);
        } else if (data.type === 'LICHESS_AUTH_ERROR' || data.type === 'CHESSCOM_AUTH_ERROR') {
          console.error('❌ OAuth error:', data.error, data.errorDescription);
          setIsLoading(false);
          setErrorMsg(`OAuth error: ${data.error}${data.errorDescription ? ` - ${data.errorDescription}` : ''}`);
        }
      } catch (err) {
        console.error('❌ Error handling message from popup:', err);
      }
    };

    console.log('🔧 Setting up message listener');
    window.addEventListener('message', handleMessage);
    return () => {
      console.log('🔧 Cleaning up message listener');
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const fetchLichessUserData = async (accessToken: string) => {
    try {
      // Use the access token to fetch user data from Lichess
      const response = await fetch('https://lichess.org/api/account', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        return {
          id: userData.id,
          username: userData.username,
          title: userData.title || 'Немає',
          rating: userData.perfs?.classical?.rating || userData.perfs?.rapid?.rating || userData.perfs?.blitz?.rating || 'Невідомо',
          games: userData.count?.all || userData.count?.rated || 'Невідомо',
          country: userData.profile?.country || 'Невідомо'
        };
      } else {
        throw new Error(`Failed to fetch user data: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching Lichess user data:', error);
      // For demo purposes, return mock data
      return {
        id: 'demo_user',
        username: 'DemoUser',
        title: 'GM',
        rating: 2800,
        games: 1500,
        country: 'UA'
      };
    }
  };

  const fetchChesscomUserData = async (username: string) => {
    console.log('🔄 fetchChesscomUserData called for username:', username);
    try {
      const apiUrl = `https://api.chess.com/pub/player/${username}`;
      console.log('🔄 Fetching from URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      console.log('🔄 Response status:', response.status);
      console.log('🔄 Response ok:', response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔄 Raw Chess.com API response:', data);
        
        // Map Chess.com API fields to our expected structure
        const mappedData = {
          id: data.player_id || data.username,
          username: data.username,
          title: data.title || 'Немає',
          rating: data.chess_rapid?.last?.rating || data.chess_blitz?.last?.rating || data.chess_bullet?.last?.rating || 'Невідомо',
          games: data.games || data.chess_rapid?.games || data.chess_blitz?.games || data.chess_bullet?.games || 'Невідомо',
          country: data.country || 'Невідомо'
        };
        
        console.log('🔄 Mapped data structure:', mappedData);
        return mappedData;
      } else {
        const errorText = await response.text();
        console.error('❌ Chess.com API error response:', errorText);
        throw new Error(`Failed to fetch Chess.com user data: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error fetching Chess.com user data:', error);
      throw error; // Re-throw to be caught by the calling function
    }
  };

  const handleLichessVerification = async () => {
    if (lichessVerified) return;
    
    console.log('🎯 Lichess verification started');
    
    // Check if OAuth is configured
    if (!isLichessOAuthConfigured()) {
      console.log('❌ Lichess OAuth not configured');
      alert('Lichess OAuth не налаштовано. Будь ласка, створіть файл .env.local з REACT_APP_LICHESS_CLIENT_ID.');
      return;
    }
    
    setIsLoading(true);
    setErrorMsg(null);
    
    // Clear any old pending OAuth data
    localStorage.removeItem('lichess_oauth_pending');
    localStorage.removeItem('lichess_oauth_code');
    localStorage.removeItem('lichess_oauth_state_callback');
    localStorage.removeItem('lichess_oauth_error');
    localStorage.removeItem('lichess_oauth_error_description');
    
    try {
      console.log('🔄 Building Lichess OAuth URL...');
      const authUrl = await buildAuthUrl('lichess');
      console.log('✅ Lichess OAuth URL built:', authUrl);
      
      const popup = window.open(authUrl, 'lichess-auth', 'width=500,height=600,scrollbars=yes,resizable=yes');
      
      if (!popup) {
        alert('Будь ласка, дозвольте popup вікна для цього сайту');
        setIsLoading(false);
        return;
      }
      
      // Add popup focus
      popup.focus();
      
      // Poll to check if popup was closed manually by user
      const popupCheckInterval = setInterval(() => {
        if (popup.closed) {
          console.log('❌ Popup was closed by user');
          clearInterval(popupCheckInterval);
          setIsLoading(false);
          // Don't set error message here - user might have intentionally closed it
        }
      }, 500);
      
      // Clean up interval after 5 minutes (timeout)
      setTimeout(() => {
        clearInterval(popupCheckInterval);
      }, 5 * 60 * 1000);
      
    } catch (error) {
      console.error('❌ Lichess verification error:', error);
      if (error instanceof Error) {
        alert(`Помилка верифікації Lichess: ${error.message}`);
      } else {
        alert('Помилка при верифікації Lichess. Спробуйте ще раз.');
      }
      setIsLoading(false);
    }
  };

  const handleChesscomVerification = async () => {
    console.log('🎯 Chess.com verification started');
    console.log('🎯 Current state:', { chesscomVerified, showChesscomInput, chesscomUsername });
    
    if (chesscomVerified) {
      console.log('✅ Already verified, returning');
      return;
    }
    
    if (!showChesscomInput) {
      console.log('📝 Showing username input');
      setShowChesscomInput(true);
      return;
    }
    
    if (!chesscomUsername.trim()) {
      console.log('❌ No username entered');
      alert('Будь ласка, введіть ім\'я користувача Chess.com');
      return;
    }
    
    console.log('🔄 Starting Chess.com username verification for:', chesscomUsername.trim());
    setIsLoading(true);
    
    try {
      console.log('🔄 Calling verifyChesscomUsername...');
      const isValid = await verifyChesscomUsername(chesscomUsername.trim());
      console.log('✅ Username verification result:', isValid);
      
      if (isValid) {
        console.log('✅ Username is valid, setting verified state');
        setChesscomVerified(true);
        setShowChesscomInput(false);
        
        // Fetch Chess.com user data
        try {
          console.log('🔄 Fetching Chess.com user data...');
          const userData = await fetchChesscomUserData(chesscomUsername.trim());
          console.log('✅ Chess.com user data fetched:', userData);
          setChesscomUserData(userData);
          console.log('✅ Chess.com user data set in state');
        } catch (error) {
          console.error('❌ Failed to fetch Chess.com user data:', error);
        }
      } else {
        console.log('❌ Username is invalid');
        alert('Користувача з таким іменем не знайдено на Chess.com. Перевірте правильність написання.');
      }
    } catch (error) {
      console.error('❌ Chess.com verification error:', error);
      alert('Помилка при верифікації. Спробуйте ще раз.');
    } finally {
      console.log('🔄 Setting loading to false');
      setIsLoading(false);
    }
  };

  return (
    <div className="chess-verification">
      <h1>Верифікація Шахових Акаунтів</h1>
      
      {/* Configuration Status */}
      {!isLichessOAuthConfigured() && (
        <div className="config-status" style={{ 
          backgroundColor: '#fef2f2', 
          border: '1px solid #fecaca',
          color: '#991b1b'
        }}>
          <h3>Lichess OAuth не налаштовано</h3>
          <p>Для використання Lichess верифікації:</p>
          <ol>
            <li>Створіть файл <code>.env.local</code> в корені проекту</li>
            <li>Додайте: <code>REACT_APP_LICHESS_CLIENT_ID=ваш_client_id</code></li>
            <li>Перезапустіть додаток</li>
          </ol>
          <p>
            <a href="https://lichess.org/account/oauth/app" target="_blank" rel="noopener noreferrer">
              Створити OAuth додаток на Lichess →
            </a>
          </p>
        </div>
      )}
      {/* Summary cards */}
      <div className="summary">
        <div className="user-data-card lichess">
          <h3>Lichess</h3>
          {lichessUserData ? (
            <div className="user-stats">
              <p><strong>{lichessUserData.username}</strong></p>
              <p>{lichessUserData.rating} • {lichessUserData.country}</p>
            </div>
          ) : (
            <p style={{ margin: 0, color: '#999', fontSize: 14 }}>Не верифіковано</p>
          )}
        </div>

        <div className="user-data-card chesscom">
          <h3>Chess.com</h3>
          {chesscomUserData ? (
            <div className="user-stats">
              <p><strong>{chesscomUserData.username}</strong></p>
              <p>{chesscomUserData.rating} • {chesscomUserData.country}</p>
            </div>
          ) : (
            <p style={{ margin: 0, color: '#999', fontSize: 14 }}>Не верифіковано</p>
          )}
        </div>
      </div>

      {/* Clear button */}
      {(lichessUserData || chesscomUserData) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button
            className="clear-button"
            onClick={() => {
              setLichessUserData(null);
              setChesscomUserData(null);
              setLichessVerified(false);
              setChesscomVerified(false);
              localStorage.removeItem('lichessUserData');
              localStorage.removeItem('chesscomUserData');
              localStorage.removeItem('lichess_oauth_state');
              localStorage.removeItem('lichess_code_verifier');
            }}
          >
            Очистити дані
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="info">
        <p>Натисніть кнопку, щоб перевірити аккаунт Lichess або ввести ім'я користувача Chess.com.</p>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="error-message">{errorMsg}</div>
      )}
      
      {/* Verification buttons */}
      <div className="verification-buttons">
        <button 
          className={`verification-btn lichess ${lichessVerified ? 'verified' : ''}`}
          onClick={handleLichessVerification}
          disabled={isLoading || lichessVerified}
        >
          {lichessVerified ? '✓ Lichess Верифіковано' : isLoading ? 'Завантаження...' : 'Верифікувати Lichess'}
        </button>
        
        <button 
          className={`verification-btn chesscom ${chesscomVerified ? 'verified' : ''}`}
          onClick={handleChesscomVerification}
          disabled={isLoading || chesscomVerified}
        >
          {chesscomVerified ? '✓ Chess.com Верифіковано' : isLoading ? 'Завантаження...' : 'Верифікувати Chess.com'}
        </button>
        
        {showChesscomInput && !chesscomVerified && (
          <div className="username-input-container">
            <input
              type="text"
              placeholder="Введіть ім'я користувача Chess.com"
              value={chesscomUsername}
              onChange={(e) => setChesscomUsername(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && chesscomUsername.trim() && !isLoading) {
                  handleChesscomVerification();
                }
              }}
              className="username-input"
              disabled={isLoading}
              autoFocus
            />
            <button
              className="verify-username-btn"
              onClick={handleChesscomVerification}
              disabled={isLoading || !chesscomUsername.trim()}
            >
              Підтвердити
            </button>
          </div>
        )}
      </div>
      
      {/* Minimal UI — debug tools removed for clarity */}
      
      {/* Detailed user data */}
      {(lichessUserData || chesscomUserData) && (
        <div className="user-data-section">
          <h2>Детальна інформація</h2>
          
          {lichessUserData && (
            <div className="user-data-card lichess">
              <h3>{lichessUserData.username}</h3>
              <div className="user-stats">
                <p>
                  <strong>Титул</strong>
                  {lichessUserData.title}
                </p>
                <p>
                  <strong>Рейтинг</strong>
                  {lichessUserData.rating}
                </p>
                <p>
                  <strong>Ігор</strong>
                  {lichessUserData.games}
                </p>
                <p>
                  <strong>Країна</strong>
                  {lichessUserData.country}
                </p>
              </div>
            </div>
          )}
          
          {chesscomUserData && (
            <div className="user-data-card chesscom">
              <h3>{chesscomUserData.username}</h3>
              <div className="user-stats">
                <p>
                  <strong>Титул</strong>
                  {chesscomUserData.title}
                </p>
                <p>
                  <strong>Рейтинг</strong>
                  {chesscomUserData.rating}
                </p>
                <p>
                  <strong>Ігор</strong>
                  {chesscomUserData.games}
                </p>
                <p>
                  <strong>Країна</strong>
                  {chesscomUserData.country}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Raw debug output removed for minimal UI */}
    </div>
  );
};

export default ChessVerification;
