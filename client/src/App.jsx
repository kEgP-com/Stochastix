import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Dices, 
  Sun, 
  Moon, 
  LogOut, 
  ArrowRight, 
  Users, 
  Bot, 
  Coins, 
  Menu, 
  X, 
  LayoutDashboard,
  Gamepad2,
  WifiOff
} from 'lucide-react';
import Lobby from './components/Lobby';
import Setup from './components/Setup';
import GameBoard from './components/GameBoard';
import Dashboard from './components/Dashboard';

// Connect to the local server or deployed server
const socketUrl = import.meta.env.MODE === 'production' ? undefined : 'http://localhost:3001';
const socket = io(socketUrl, { transports: ['websocket'] });

function App() {
  const [currentView, setCurrentView] = useState('PLAY'); // 'PLAY' | 'DASHBOARD'
  const [roomState, setRoomState] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lastRoll, setLastRoll] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isTiebreakerAction, setIsTiebreakerAction] = useState(false);
  const [tiebreakerResults, setTiebreakerResults] = useState(null);
  const [pendingState, setPendingState] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  
  // Dark mode - default to dark for optimal eye comfort
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved !== 'light';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed === 'string') return { username: parsed, points: 1000 };
        return parsed;
      } catch {
        return { username: saved, points: 1000 };
      }
    }
    return null;
  });

  useEffect(() => {
    socket.on('roomCreated', (id) => {
      setRoomId(id);
    });

    socket.on('roomState', (state) => {
      if (state.state === 'PLAYING' || state.state === 'GAMEOVER' || state.state === 'TIEBREAKER') {
        setPendingState(state);
      } else {
        setRoomState(state);
        setError('');
      }
    });

    socket.on('diceRolled', (result) => {
      setIsRolling(true);
      setTimeout(() => {
        setLastRoll(result);
        setIsRolling(false);
      }, 1500); 
    });

    socket.on('tiebreakerResolved', (results) => {
      setIsTiebreakerAction(true);
      setTiebreakerResults(results);
      setTimeout(() => {
        setIsTiebreakerAction(false);
      }, 2500); 
    });

    socket.on('authSuccess', (userData) => {
      const data = typeof userData === 'string' ? { username: userData, points: 1000 } : userData;
      setCurrentUser(data);
      localStorage.setItem('currentUser', JSON.stringify(data));
      setError('');
    });

    socket.on('pointsUpdated', ({ username, points }) => {
      setCurrentUser(prev => {
        if (prev && prev.username === username) {
          const updated = { ...prev, points };
          localStorage.setItem('currentUser', JSON.stringify(updated));
          return updated;
        }
        return prev;
      });
    });

    socket.on('authError', (msg) => {
      setError(msg);
      setSuccessMsg('');
    });

    socket.on('profileUpdated', (data) => {
      setCurrentUser(data);
      localStorage.setItem('currentUser', JSON.stringify(data));
    });

    socket.on('registerSuccess', () => {
      setSuccessMsg('Registration successful! Please log in.');
      setError('');
      setIsLoginMode(true);
      setPassword('');
      setConfirmPassword('');
    });

    socket.on('error', (msg) => {
      setError(msg);
      setSuccessMsg('');
    });

    socket.on('disconnect', () => {
      setRoomState(null);
      setPendingState(null);
      setRoomId('');
    });

    socket.on('kicked', () => {
      setRoomState(null);
      setRoomId('');
      alert('You have been kicked from the lobby by the Game Master.');
    });

    return () => {
      socket.off('roomCreated');
      socket.off('roomState');
      socket.off('diceRolled');
      socket.off('tiebreakerResolved');
      socket.off('authSuccess');
      socket.off('pointsUpdated');
      socket.off('authError');
      socket.off('profileUpdated');
      socket.off('registerSuccess');
      socket.off('error');
      socket.off('disconnect');
      socket.off('kicked');
    };
  }, []);

  useEffect(() => {
    if (pendingState && !isRolling && !isTiebreakerAction) {
      setRoomState(pendingState);
      setPendingState(null);
      setError('');
    }
  }, [pendingState, isRolling, isTiebreakerAction]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    socket.on('passwordResetRequested', () => {
      setIsAuthLoading(false);
      setResetCodeSent(true);
      setSuccessMsg('A reset code has been sent! Check server console / logs.');
    });

    socket.on('passwordResetSuccess', () => {
      setIsAuthLoading(false);
      setSuccessMsg('Password updated successfully! Please log in.');
      setIsForgotPasswordMode(false);
      setResetCodeSent(false);
      setPassword('');
      setConfirmPassword('');
      setResetCode('');
    });

    const stopLoading = () => setIsAuthLoading(false);
    socket.on('authSuccess', stopLoading);
    socket.on('authError', stopLoading);
    socket.on('error', stopLoading);
    socket.on('registerSuccess', stopLoading);

    return () => {
      socket.off('passwordResetRequested');
      socket.off('passwordResetSuccess');
      socket.off('authSuccess', stopLoading);
      socket.off('authError', stopLoading);
      socket.off('error', stopLoading);
      socket.off('registerSuccess', stopLoading);
    };
  }, []);

  const handleAuth = () => {
    setError('');
    setSuccessMsg('');
    if (isLoginMode) {
      if (!username || !password) return setError('Please fill all fields');
      setIsAuthLoading(true);
      socket.emit('login', { username, password });
    } else {
      if (!email || !username || !password || !confirmPassword) return setError('Please fill all fields');
      if (password !== confirmPassword) return setError('Passwords do not match');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return setError('Invalid email address format');
      setIsAuthLoading(true);
      socket.emit('register', { email, username, password });
    }
  };

  const handlePasswordReset = () => {
    setError('');
    setSuccessMsg('');
    if (!resetCodeSent) {
      if (!email) return setError('Please enter your email address');
      setIsAuthLoading(true);
      socket.emit('requestPasswordReset', { email });
    } else {
      if (!resetCode || !password || !confirmPassword) return setError('Please fill all fields');
      if (password !== confirmPassword) return setError('Passwords do not match');
      setIsAuthLoading(true);
      socket.emit('resetPassword', { email, code: resetCode, newPassword: password });
    }
  };

  const logout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setRoomState(null);
    setRoomId('');
  };

  const createRoom = (isSinglePlayer = false) => {
    socket.emit('createRoom', { name: currentUser.username, isSinglePlayer: !!isSinglePlayer });
  };

  const joinRoom = (id) => {
    if (!id) return setError('Please enter a room code');
    socket.emit('joinRoom', { roomId: id.trim().toUpperCase(), name: currentUser.username });
    setRoomId(id.trim().toUpperCase());
  };

  const leaveRoom = () => {
    if (roomState) {
      socket.emit('leaveRoom', { roomId: roomState.id });
    }
    setRoomState(null);
    setRoomId('');
    setCurrentView('PLAY');
  };

  // Nav Bar
  const Header = () => (
    <header className="sticky top-0 glass-panel border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-3.5 shadow-md dark:shadow-xl transition-all z-50">
      <div className="relative flex justify-between items-center w-full max-w-7xl mx-auto">
        {/* Brand */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer select-none group" 
          onClick={() => { if(roomState) leaveRoom(); }}
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            <Dices className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-black tracking-tight font-display text-slate-900 dark:text-white">
            Stochastix
          </span>
        </div>

        {/* Center Nav tabs (Desktop) - True Mathematical 50% Dead Center */}
        <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm">
          <button 
            onClick={() => setCurrentView('PLAY')} 
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              currentView === 'PLAY' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            Play
          </button>
          <button 
            onClick={() => setCurrentView('DASHBOARD')} 
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              currentView === 'DASHBOARD' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Analytics
          </button>
        </nav>

        {/* Desktop Profile & Actions */}
        <div className="hidden md:flex items-center gap-3">
          {currentUser && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  {currentUser.username[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {currentUser.username}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-600/50">
                  <Coins className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  {(currentUser.points || 1000).toLocaleString()}
                </span>
              </div>

              <button 
                onClick={logout} 
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-red-500/15 border border-slate-200 dark:border-slate-700 hover:border-red-500/40 text-slate-600 dark:text-slate-300 hover:text-red-500 transition-all active:scale-95"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}

          {roomState && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40">
                Room: {roomState.id}
              </span>
              <button 
                onClick={leaveRoom}
                className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all active:scale-95 shadow-sm shadow-red-900/30"
              >
                Leave
              </button>
            </div>
          )}

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-colors active:scale-95"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
          </button>
        </div>

        {/* Mobile Action Controls */}
        <div className="flex md:hidden items-center gap-2">
          {currentUser && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
              <Coins className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              {(currentUser.points || 1000).toLocaleString()}
            </span>
          )}

          {/* Direct 1-tap Theme switch for mobile */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 active:scale-95"
            title="Toggle Dark/Light"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
          </button>

          <button 
            className="p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-800"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col space-y-3 animate-fade-in max-w-7xl mx-auto">
          <nav className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => { setCurrentView('PLAY'); setIsMobileMenuOpen(false); }} 
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition ${
                currentView === 'PLAY' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              Play
            </button>
            <button 
              onClick={() => { setCurrentView('DASHBOARD'); setIsMobileMenuOpen(false); }} 
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition ${
                currentView === 'DASHBOARD' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Analytics
            </button>
          </nav>

          {currentUser && (
            <div className="p-3 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                  {currentUser.username[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{currentUser.username}</div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-mono font-bold">🪙 {(currentUser.points || 1000).toLocaleString()} pts</div>
                </div>
              </div>
              <button 
                onClick={logout}
                className="text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 bg-red-100 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-1.5 rounded-lg"
              >
                Log Out
              </button>
            </div>
          )}

          {roomState && (
            <div className="flex items-center gap-2 p-2 bg-indigo-100/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 rounded-xl">
              <span className="flex-1 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 text-center">
                Room: {roomState.id}
              </span>
              <button 
                onClick={leaveRoom}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm"
              >
                Leave
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );

  // AUTH SCREEN
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 bg-ambient-glow flex flex-col justify-center items-center p-4 transition-colors">
        <div className="max-w-md w-full glass-panel rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 relative">
          
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-3">
              <Dices className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-slate-900 dark:text-white">
              Stochastix
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
              {isForgotPasswordMode 
                ? 'Account Password Recovery' 
                : isLoginMode 
                  ? 'Sign in to jump into the arena' 
                  : 'Create your probability gaming profile'}
            </p>
          </div>
          
          {/* Error & Success Alerts */}
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 text-red-300 p-3 rounded-xl mb-4 text-xs font-semibold animate-fade-in">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-3 rounded-xl mb-4 text-xs font-semibold animate-fade-in">
              {successMsg}
            </div>
          )}

          {/* Server status alert if offline */}
          {!isConnected && (
            <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 p-3 rounded-xl mb-4 text-xs font-semibold flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Connecting to game server... make sure backend is running.</span>
            </div>
          )}
          
          <div className="space-y-4">
            {isForgotPasswordMode ? (
              <>
                {!resetCodeSent ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors text-slate-100 text-sm"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your-email@domain.com"
                      />
                    </div>
                    <button
                      onClick={handlePasswordReset}
                      disabled={isAuthLoading}
                      className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-indigo-900/30 flex justify-center items-center h-11 text-sm disabled:opacity-60"
                    >
                      {isAuthLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Send Reset Code'
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 p-3 rounded-xl text-xs font-medium">
                      A 6-digit code was generated. (Check server logs if testing locally).
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        6-Digit Code
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl focus:border-indigo-500 outline-none text-center tracking-widest text-lg font-mono text-white"
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        placeholder="000000"
                        maxLength={6}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl focus:border-indigo-500 outline-none text-slate-100 text-sm"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl focus:border-indigo-500 outline-none text-slate-100 text-sm"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={handlePasswordReset}
                      disabled={isAuthLoading}
                      className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-indigo-900/30 flex justify-center items-center h-11 text-sm disabled:opacity-60"
                    >
                      {isAuthLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Reset Password'
                      )}
                    </button>
                  </>
                )}
                <div className="text-center pt-2">
                  <button
                    onClick={() => { setIsForgotPasswordMode(false); setError(''); setResetCodeSent(false); }}
                    className="text-xs font-semibold text-slate-400 hover:text-indigo-300 transition-colors"
                  >
                    ← Back to Login
                  </button>
                </div>
              </>
            ) : (
              <>
                {!isLoginMode && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Email (for verification)
                    </label>
                    <input
                      type="email"
                      className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors text-slate-100 text-sm"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. player@example.com"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors text-slate-100 text-sm"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a callsign"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors text-slate-100 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && isLoginMode && handleAuth()}
                  />
                </div>
                {!isLoginMode && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700/80 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-colors text-slate-100 text-sm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                    />
                  </div>
                )}
                
                <button
                  onClick={handleAuth}
                  disabled={isAuthLoading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg shadow-indigo-900/30 flex justify-center items-center h-11 text-sm mt-2 disabled:opacity-60 active:scale-98"
                >
                  {isAuthLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    isLoginMode ? 'Sign In' : 'Create Account'
                  )}
                </button>
                
                <div className="flex flex-col items-center gap-2 pt-2">
                  {isLoginMode && (
                    <button
                      onClick={() => { setIsForgotPasswordMode(true); setError(''); }}
                      className="text-xs text-slate-400 hover:text-indigo-300 transition-colors"
                    >
                      Forgot your password?
                    </button>
                  )}
                  <button
                    onClick={() => { setIsLoginMode(!isLoginMode); setError(''); }}
                    className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {isLoginMode ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD VIEW
  if (currentView === 'DASHBOARD') {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 bg-ambient-glow flex flex-col transition-colors">
        <Header />
        <main className="flex-1 max-w-7xl mx-auto p-4 sm:p-6 w-full">
          <Dashboard socket={socket} currentUser={currentUser} />
        </main>
      </div>
    );
  }

  // WELCOME / PLAY SELECTION SCREEN (When no active room)
  if (!roomState) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 bg-ambient-glow flex flex-col transition-colors">
        <Header />
        
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full glass-panel rounded-3xl shadow-xl dark:shadow-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 relative overflow-hidden animate-fade-in">
            
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

            {/* Emblem & Headline */}
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-indigo-100 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/40 text-indigo-600 dark:text-indigo-300 mb-3 shadow-sm">
                <Dices className="w-8 h-8" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-slate-900 dark:text-white">
                Play Stochastix
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 font-medium">
                Strategic block placement & probability dice warfare
              </p>
            </div>
            
            {error && (
              <div className="bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/40 text-red-800 dark:text-red-200 p-3 rounded-xl mb-5 text-xs font-bold animate-fade-in">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              {/* Primary: Create Multiplayer Game */}
              <button
                onClick={() => createRoom(false)}
                className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black transition-all shadow-lg shadow-indigo-600/30 active:scale-98 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/20">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-extrabold text-white">Create Game</div>
                    <div className="text-xs text-indigo-100 font-medium">Host lobby with friends or AI</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-indigo-100 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Secondary: Single Player vs AI */}
              <button
                onClick={() => createRoom(true)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold transition-all active:scale-98 group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-600/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/40">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">Solo Practice vs AI</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Quick instant 1v1 match</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </button>
              
              {/* Divider */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider text-[11px]">
                    Or enter a room code
                  </span>
                </div>
              </div>
              
              {/* Room Code input group */}
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-3 bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 outline-none uppercase font-mono tracking-widest text-center text-base font-extrabold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors rounded-xl"
                  placeholder="ROOM CODE"
                  maxLength={10}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom(roomId)}
                />
                <button
                  onClick={() => joinRoom(roomId)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-3 px-6 rounded-xl transition-all shadow-md shadow-indigo-600/30 active:scale-95 text-sm"
                >
                  Join
                </button>
              </div>

              {/* Tips Footer */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>⚡ Instant multiplayer sync</span>
                <span>🎲 2 to 8 players</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE GAME STATE (LOBBY / SETUP / PLAYING / TIEBREAKER / GAMEOVER)
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 bg-ambient-glow font-sans flex flex-col transition-colors">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto p-4 sm:p-6 w-full animate-fade-in">
        {roomState.state === 'LOBBY' && (
          <Lobby roomState={roomState} socket={socket} onLeave={leaveRoom} />
        )}
        {roomState.state === 'SETUP' && (
          <Setup roomState={roomState} socket={socket} />
        )}
        {(roomState.state === 'PLAYING' || roomState.state === 'TIEBREAKER' || roomState.state === 'GAMEOVER') && (
          <GameBoard 
            roomState={roomState} 
            socket={socket} 
            lastRoll={lastRoll} 
            isRollingGlobal={isRolling} 
            isTiebreakerAction={isTiebreakerAction} 
            tiebreakerResults={tiebreakerResults} 
          />
        )}
      </main>
    </div>
  );
}

export default App;
