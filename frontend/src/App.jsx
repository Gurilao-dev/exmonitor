import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import GlobalPasswordGate from './components/auth/GlobalPasswordGate';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ModeSelection from './components/ModeSelection';
import TransmitterDashboard from './components/transmitter/TransmitterDashboard';
import MonitorDashboard from './components/monitor/MonitorDashboard';
import StreamPage from './components/stream/StreamPage';
import { StreamProvider } from './components/stream/StreamContext';
import api from './services/api';

function App() {
  const [isGlobalAuthenticated, setIsGlobalAuthenticated] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const preLoginToken = localStorage.getItem('preLoginToken');
      const sessionToken = localStorage.getItem('sessionToken');

      try {
        if (preLoginToken) {
          await api.verifyGlobalPassword();
          setIsGlobalAuthenticated(true);
        }
        if (sessionToken) {
          setIsUserAuthenticated(true);
        }
      } catch (err) {
        setIsGlobalAuthenticated(false);
        localStorage.removeItem('preLoginToken');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleGlobalAccess = () => setIsGlobalAuthenticated(true);
  const handleLogin = () => setIsUserAuthenticated(true);

  const handleLogout = () => {
    localStorage.clear();
    setIsUserAuthenticated(false);
    setIsGlobalAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-accent-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!isGlobalAuthenticated) {
    return <GlobalPasswordGate onSuccess={handleGlobalAccess} />;
  }

  return (
    <StreamProvider>
      <Router>
        <Routes>
          {/* Auth routes */}
          <Route path="/login" element={
            isUserAuthenticated ? <Navigate to="/mode" /> : <Login onSuccess={handleLogin} />
          } />
          <Route path="/register" element={
            isUserAuthenticated ? <Navigate to="/mode" /> : <Register onSuccess={handleLogin} />
          } />

          {/* Protected routes */}
          <Route path="/mode" element={
            isUserAuthenticated ? <ModeSelection /> : <Navigate to="/login" />
          } />
          <Route path="/transmitter" element={
            isUserAuthenticated ? <TransmitterDashboard onLogout={handleLogout} /> : <Navigate to="/login" />
          } />
          <Route path="/monitor" element={
            isUserAuthenticated ? <MonitorDashboard onLogout={handleLogout} /> : <Navigate to="/login" />
          } />

          {/* Full-screen stream view */}
          <Route path="/stream" element={
            isUserAuthenticated ? <StreamPage /> : <Navigate to="/login" />
          } />

          {/* Default redirect */}
          <Route path="/" element={
            isUserAuthenticated ? <Navigate to="/mode" /> : <Navigate to="/login" />
          } />
        </Routes>
      </Router>
    </StreamProvider>
  );
}

export default App;
