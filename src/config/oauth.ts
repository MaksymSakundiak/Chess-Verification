// OAuth конфігурація для Lichess та Chess.com
export const OAUTH_CONFIG = {
  lichess: {
    clientId: process.env.REACT_APP_LICHESS_CLIENT_ID || '',
    authUrl: 'https://lichess.org/oauth/authorize',
    tokenUrl: 'https://lichess.org/api/token',
    redirectUri: '', // Will be set dynamically
    responseType: 'code'
  },
  chesscom: {
    // Chess.com uses public API, not OAuth
    apiBaseUrl: 'https://api.chess.com/pub',
    // No client ID needed for public API
  }
} as const;

// Type for Lichess config (with OAuth properties)
type LichessConfig = typeof OAUTH_CONFIG.lichess;

// Helper function to check if Lichess OAuth is properly configured
export const isLichessOAuthConfigured = (): boolean => {
  const clientId = OAUTH_CONFIG.lichess.clientId;
  return Boolean(clientId && clientId !== '' && clientId !== 'your_lichess_client_id_here');
};

// Типи для OAuth відповідей
export interface OAuthResponse {
  code?: string;
  error?: string;
  state?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
}

// Функції для роботи з OAuth
export const buildAuthUrl = async (platform: 'lichess' | 'chesscom', state?: string): Promise<string> => {
  console.log('🔍 buildAuthUrl called with platform:', platform);
  
  if (platform === 'chesscom') {
    console.log('🔍 Chess.com platform - returning empty string');
    return '';
  }
  
  console.log('🔍 Building Lichess OAuth URL...');
  const config = OAUTH_CONFIG.lichess as LichessConfig;
  console.log('🔍 Config object:', config);
  
  // Check if OAuth is properly configured
  if (!isLichessOAuthConfigured()) {
    console.log('❌ Lichess OAuth not configured');
    throw new Error('Lichess OAuth is not configured. Please set REACT_APP_LICHESS_CLIENT_ID in your .env.local file.');
  }
  
  console.log('🔍 OAuth is configured, proceeding...');
  
  // Set redirect URI dynamically
  const redirectUri = `${window.location.origin}/lichess-callback`;
  console.log('🔍 Setting redirect URI to:', redirectUri);
  console.log('🔍 window.location.origin:', window.location.origin);
  console.log('🔍 window.location:', window.location);
  
  // Generate PKCE challenge and a state value for CSRF protection
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Persist code verifier and state in localStorage so callback and parent can validate even if a reload occurs
  localStorage.setItem('lichess_code_verifier', codeVerifier);
  const oauthState = state || String(Math.random()).slice(2);
  localStorage.setItem('lichess_oauth_state', oauthState);
  
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: config.responseType,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  
  console.log('🔍 URL parameters built:', {
    client_id: config.clientId,
    response_type: config.responseType,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  
  params.append('state', oauthState);
  
  const authUrl = `${config.authUrl}?${params.toString()}`;
  console.log('🔍 Final auth URL:', authUrl);
  
  // Validate the URL
  try {
    const testUrl = new URL(authUrl);
    console.log('🔍 URL validation successful:', {
      protocol: testUrl.protocol,
      hostname: testUrl.hostname,
      pathname: testUrl.pathname,
      searchParams: testUrl.searchParams.toString()
    });
  } catch (urlError) {
    console.error('❌ URL validation failed:', urlError);
    throw new Error(`Invalid OAuth URL generated: ${urlError}`);
  }
  
  return authUrl;
};

// Generate random code verifier for PKCE
const generateCodeVerifier = (): string => {
  console.log('🔍 generateCodeVerifier called');
  console.log('🔍 crypto available:', typeof crypto !== 'undefined');
  console.log('🔍 crypto.getRandomValues available:', typeof crypto.getRandomValues === 'function');
  
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    console.error('❌ Crypto API not available');
    throw new Error('Crypto API not available. This app requires a secure context (HTTPS or localhost).');
  }
  
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const result = base64URLEncode(array);
  console.log('🔍 Code verifier generated successfully');
  return result;
};

// Generate code challenge from verifier
const generateCodeChallenge = async (verifier: string): Promise<string> => {
  console.log('🔍 generateCodeChallenge called with verifier length:', verifier.length);
  console.log('🔍 crypto.subtle available:', typeof crypto.subtle !== 'undefined');
  console.log('🔍 crypto.subtle.digest available:', typeof crypto.subtle?.digest === 'function');
  
  if (typeof crypto.subtle === 'undefined' || typeof crypto.subtle.digest !== 'function') {
    console.error('❌ Crypto Subtle API not available');
    throw new Error('Crypto Subtle API not available. This app requires a secure context (HTTPS or localhost).');
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  console.log('🔍 Verifier encoded to Uint8Array, length:', data.length);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  console.log('🔍 SHA-256 hash generated, buffer length:', hashBuffer.byteLength);
  
  const result = base64URLEncode(new Uint8Array(hashBuffer));
  console.log('🔍 Code challenge generated successfully');
  return result;
};

// Base64URL encoding
const base64URLEncode = (buffer: Uint8Array): string => {
  console.log('🔍 base64URLEncode called with buffer length:', buffer.length);
  
  try {
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(buffer)));
    console.log('🔍 Base64 encoded, length:', base64.length);
    
    const result = base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    console.log('🔍 Base64URL encoded successfully, length:', result.length);
    return result;
  } catch (error) {
    console.error('❌ Base64URL encoding failed:', error);
    throw new Error(`Base64URL encoding failed: ${error}`);
  }
};

export const exchangeCodeForToken = async (
  platform: 'lichess' | 'chesscom', 
  code: string
): Promise<TokenResponse> => {
  if (platform === 'chesscom') {
    throw new Error('Chess.com does not use OAuth token exchange');
  }
  
  const config = OAUTH_CONFIG.lichess as LichessConfig;
  
  // Get the stored code verifier for PKCE
  const codeVerifier = localStorage.getItem('lichess_code_verifier');
  if (!codeVerifier) {
    throw new Error('Code verifier not found. Please try the authorization flow again.');
  }
  
  // Set redirect URI dynamically
  const redirectUri = `${window.location.origin}/lichess-callback`;
  console.log('🔗 Using redirect URI for token exchange:', redirectUri);
  
  let response: Response;
  try {
    response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      })
    });
  } catch (err) {
    // Network or CORS error
    console.error('❌ Token exchange network error:', err);
    throw new Error(`Network error during token exchange: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Check if response is ok
  if (!response.ok) {
    const text = await response.text().catch(() => 'Unable to read response body');
    console.error('❌ Token exchange failed:', response.status, response.statusText, text);
    throw new Error(`Failed to exchange code for token: ${response.status} ${response.statusText} — ${text}`);
  }

  // Parse JSON response
  let tokenResponse: TokenResponse;
  try {
    tokenResponse = await response.json();
  } catch (err) {
    console.error('❌ Failed to parse token response as JSON:', err);
    throw new Error(`Invalid JSON response from token endpoint: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Only clean up on success
  localStorage.removeItem('lichess_code_verifier');
  localStorage.removeItem('lichess_oauth_state');
  
  return tokenResponse;
};

// Function to verify Chess.com username using their public API
export const verifyChesscomUsername = async (username: string): Promise<boolean> => {
  console.log('🔄 verifyChesscomUsername called for:', username);
  try {
    const apiUrl = `${OAUTH_CONFIG.chesscom.apiBaseUrl}/player/${username}`;
    console.log('🔄 Verifying username at URL:', apiUrl);
    
    const response = await fetch(apiUrl);
    console.log('🔄 Verification response status:', response.status);
    console.log('🔄 Verification response ok:', response.ok);
    
    if (response.ok) {
      const data = await response.json();
      console.log('🔄 Verification API response:', data);
      
      // Check if the player exists and has basic info
      const isValid = data && data.username && data.username.toLowerCase() === username.toLowerCase();
      console.log('🔄 Username validation result:', isValid);
      console.log('🔄 Data exists:', !!data);
      console.log('🔄 Username exists:', !!data.username);
      console.log('🔄 Username match:', data.username?.toLowerCase() === username.toLowerCase());
      
      return isValid;
    }
    
    console.log('❌ Verification failed - response not ok');
    return false;
  } catch (error) {
    console.error('❌ Error verifying Chess.com username:', error);
    return false;
  }
};
