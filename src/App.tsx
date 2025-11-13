import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import ChessVerification from './components/ChessVerification';
import LichessCallback from './components/LichessCallback';
import ChesscomCallback from './components/ChesscomCallback';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<ChessVerification />} />
          <Route path="/lichess-callback" element={<LichessCallback />} />
          <Route path="/chesscom-callback" element={<ChesscomCallback />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
