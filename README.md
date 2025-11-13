# Chess Verification App

A React application for verifying chess accounts on Lichess and Chess.com platforms using OAuth 2.0.

## Features

- **Lichess Verification**: OAuth integration with Lichess platform
- **Chess.com Verification**: Public API integration with Chess.com platform (no OAuth required)
- **Modern UI**: Clean, responsive design with smooth animations
- **Popup Authentication**: Secure OAuth flow using popup windows (Lichess only)
- **Status Tracking**: Visual feedback for verification status

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure OAuth Credentials

1. Copy `env.example` to `.env.local`:

   ```bash
   cp env.example .env.local
   ```

2. Get your OAuth client ID for Lichess:

   - **Lichess**: [Create OAuth App](https://lichess.org/account/oauth/app)
   - **Chess.com**: No credentials needed - uses public API

3. Update `.env.local` with your Lichess client ID:
   ```env
   REACT_APP_LICHESS_CLIENT_ID=your_actual_lichess_client_id
   # Chess.com doesn't need OAuth credentials
   ```

### 3. Configure Redirect URIs

Set this redirect URI in your Lichess OAuth app:

- Lichess: `http://localhost:3003/lichess-callback`
- Chess.com: No redirect URI needed (uses public API)

### 4. Start Development Server

```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## How It Works

1. **Lichess Verification**:

   - User clicks verification button
   - OAuth popup opens for authentication
   - User authorizes the application
   - Platform redirects to callback URL with authorization code
   - Callback component processes the response and closes popup
   - Main component receives success message and updates verification status

2. **Chess.com Verification**:
   - User clicks verification button
   - Username input field appears
   - User enters their Chess.com username
   - Application verifies username using Chess.com's public API
   - Verification status is updated based on API response

## Project Structure

```
src/
├── components/
│   ├── ChessVerification.tsx    # Main verification component
│   ├── LichessCallback.tsx      # Lichess OAuth callback
│   ├── ChesscomCallback.tsx     # Chess.com OAuth callback
│   └── ChessVerification.css    # Component styles
├── config/
│   └── oauth.ts                 # OAuth configuration
├── App.tsx                      # Main app with routing
└── index.tsx                    # App entry point
```

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## Security Notes

- Client IDs are public but should not be shared unnecessarily
- Use HTTPS in production
- Restrict redirect URIs to your domains only
- Consider adding state parameter for CSRF protection

## Next Steps

- [ ] Add token storage and refresh logic
- [ ] Implement user profile fetching
- [ ] Add verification history
- [ ] Create admin dashboard
- [ ] Add server-side token validation
