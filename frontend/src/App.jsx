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

function App() {
  const [isGlobalAuthenticated, setIsGlobalAuthenticated] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);

  useEffect(() => {
    const preLoginToken = localStorage.getItem('preLoginToken');
    const sessionToken = localStorage.getItem('sessionToken');

    if (preLoginToken) setIsGlobalAuthenticated(true);
    if (sessionToken) setIsUserAuthenticated(true);
  }, []);

  const handleGlobalAccess = () => setIsGlobalAuthenticated(true);
  const handleLogin = () => setIsUserAuthenticated(true);

  const handleLogout = () => {
    localStorage.clear();
    setIsUserAuthenticated(false);
    setIsGlobalAuthenticated(false);
  };

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
