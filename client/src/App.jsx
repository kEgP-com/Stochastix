import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
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
  const [lastRoll, setLastRoll] = useState(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isTiebreakerAction, setIsTiebreakerAction] = useState(false);
  const [tiebreakerResults, setTiebreakerResults] = useState(null);
  const [pendingState, setPendingState] = useState(null);
  
  // Dark mode
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
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

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // If it's an old string fallback to object
        if (typeof parsed === 'string') return { username: parsed, points: 1000 };
        return parsed;
      } catch (e) {
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
    });

    socket.on('error', (msg) => {
      setError(msg);
    });

    socket.on('disconnect', () => {
      // If the server restarts, clear the ghost room
      setRoomState(null);
      setPendingState(null);
      setRoomId('');
    });

    return () => {
      socket.off('roomCreated');
      socket.off('roomState');
      socket.off('diceRolled');
      socket.off('tiebreakerResolved');
      socket.off('authSuccess');
      socket.off('pointsUpdated');
      socket.off('authError');
      socket.off('error');
      socket.off('disconnect');
    };
  }, []);

  useEffect(() => {
    if (!isRolling && !isTiebreakerAction && pendingState) {
      setRoomState(pendingState);
      setPendingState(null);
    }
  }, [isRolling, isTiebreakerAction, pendingState]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const handleAuth = () => {
    if (isLoginMode) {
      if (!username || !password) return setError('Please fill all fields');
      socket.emit('login', { username, password });
    } else {
      if (!email || !username || !password || !confirmPassword) return setError('Please fill all fields');
      if (password !== confirmPassword) return setError('Passwords do not match');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return setError('Invalid email address format');
      socket.emit('register', { email, username, password });
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    if (roomState) leaveRoom();
  };

  const createRoom = () => {
    socket.emit('createRoom', { name: currentUser.username, isSinglePlayer: false });
  };

  const joinRoom = (id) => {
    if (!id) return setError('Please enter a room code');
    socket.emit('joinRoom', { roomId: id, name: currentUser.username });
    setRoomId(id);
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
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm transition-colors">
      <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto justify-between md:justify-start">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => { if(roomState) leaveRoom(); }}>
          {/* Simple Logo */}
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9c-.83 0-1.5-.67-1.5-1.5S6.67 6 7.5 6s1.5.67 1.5 1.5S8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/>
            </svg>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">Stochastix</h1>
        </div>
        <nav className="flex space-x-4">
          <button 
            onClick={() => setCurrentView('PLAY')} 
            className={`font-semibold transition ${currentView === 'PLAY' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Play
          </button>
          <button 
            onClick={() => setCurrentView('DASHBOARD')} 
            className={`font-semibold transition ${currentView === 'DASHBOARD' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            Dashboard
          </button>
        </nav>
      </div>
      <div className="flex flex-wrap items-center gap-3 md:gap-4 w-full md:w-auto justify-center md:justify-end">
        {currentUser && (
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span className="hidden md:inline">Hello,</span> <span className="font-bold text-slate-800 dark:text-slate-100">{currentUser.username}</span>
              <span className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 px-2 py-0.5 rounded-full text-xs border border-yellow-200 dark:border-yellow-700 whitespace-nowrap">
                💰 {currentUser.points || 1000}
              </span>
            </span>
            <button 
              onClick={logout} 
              className="bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-transparent hover:border-red-200 dark:hover:border-red-800 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95 text-xs md:text-sm"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        )}
        {roomState && (
          <div className="flex items-center space-x-2 md:space-x-3 ml-0 md:ml-4 border-l-0 md:border-l border-slate-200 dark:border-slate-700 pl-0 md:pl-4">
            <div className="bg-blue-50 dark:bg-slate-900/60 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg font-mono font-bold text-xs md:text-sm border border-blue-200 dark:border-blue-800 shadow-inner tracking-wider">
              <span className="hidden md:inline text-blue-400 dark:text-blue-500 mr-1 text-xs uppercase tracking-widest font-sans">Room Code:</span>
              {roomState.id}
            </div>
            <button 
              onClick={leaveRoom}
              className="bg-red-600 hover:bg-red-700 text-white px-3 md:px-4 py-1.5 rounded-lg font-bold text-xs md:text-sm shadow-md shadow-red-600/20 active:scale-95 transition-all whitespace-nowrap"
            >
              Leave Game
            </button>
          </div>
        )}
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
          title="Toggle Theme"
        >
          {isDark ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>
        {roomState && currentView === 'PLAY' && !roomState.isSinglePlayer && (
          <div className="text-sm font-mono bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-1.5 rounded-full border border-blue-200 dark:border-blue-800 shadow-inner">
            Room Code: <span className="font-bold">{roomState.id}</span>
          </div>
        )}
        {roomState && (
          <button 
            onClick={leaveRoom}
            className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-bold px-4 py-1.5 rounded-full hover:bg-red-200 dark:hover:bg-red-800/60 transition shadow-sm border border-red-200 dark:border-red-800 text-sm"
          >
            Leave Game
          </button>
        )}
      </div>
    </header>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans flex flex-col items-center justify-center transition-colors p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-700 transition-colors">
          <div className="flex justify-center items-center space-x-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9c-.83 0-1.5-.67-1.5-1.5S6.67 6 7.5 6s1.5.67 1.5 1.5S8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">Stochastix</h1>
          </div>
          
          {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg mb-6 text-sm font-medium">{error}</div>}
          
          <div className="space-y-4">
            {!isLoginMode && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Email (for verification)</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors dark:text-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Username</label>
              <input
                type="text"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors dark:text-white"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input
                type="password"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors dark:text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && isLoginMode && handleAuth()}
              />
            </div>
            {!isLoginMode && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors dark:text-white"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                />
              </div>
            )}
            <button
              onClick={handleAuth}
              className="w-full bg-blue-600 dark:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-95 transition shadow-md shadow-blue-500/20 mt-2"
            >
              {isLoginMode ? 'Log In' : 'Sign Up'}
            </button>
            
            <div className="text-center mt-4">
              <button
                onClick={() => { setIsLoginMode(!isLoginMode); setError(''); }}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {isLoginMode ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'DASHBOARD') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors">
        <Header />
        <Dashboard socket={socket} currentUser={currentUser} />
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans flex flex-col transition-colors">
        <Header />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-100 dark:border-slate-700 transition-colors">
            <h2 className="text-2xl font-bold text-center text-slate-800 dark:text-white mb-8">Play Stochastix</h2>
            
            {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg mb-6 text-sm font-medium">{error}</div>}
            
            <div className="space-y-5">
              <button
                onClick={createRoom}
                className="w-full bg-blue-600 dark:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 active:scale-95 transition shadow-md shadow-blue-500/20"
              >
                Create New Game
              </button>
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-medium tracking-wide uppercase text-xs">Or join existing</span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-slate-500 focus:border-transparent outline-none uppercase font-mono tracking-wider transition-colors dark:text-white"
                  placeholder="ROOM CODE"
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                />
                <button
                  onClick={() => joinRoom(roomId)}
                  className="bg-slate-800 dark:bg-slate-700 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 active:scale-95 transition shadow-md"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans flex flex-col transition-colors">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto p-6 w-full animate-fade-in">
        {roomState.state === 'LOBBY' && (
          <Lobby roomState={roomState} socket={socket} />
        )}
        {roomState.state === 'SETUP' && (
          <Setup roomState={roomState} socket={socket} />
        )}
        {(roomState.state === 'PLAYING' || roomState.state === 'TIEBREAKER' || roomState.state === 'GAMEOVER') && (
          <GameBoard roomState={roomState} socket={socket} lastRoll={lastRoll} isRollingGlobal={isRolling} isTiebreakerAction={isTiebreakerAction} tiebreakerResults={tiebreakerResults} />
        )}
      </main>
    </div>
  );
}

export default App;
