import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import Lobby from './components/Lobby';
import Setup from './components/Setup';
import GameBoard from './components/GameBoard';
import Dashboard from './components/Dashboard';

// Connect to the local server or deployed server
const socketUrl = import.meta.env.MODE === 'production' ? undefined : 'http://localhost:3001';
const socket = io(socketUrl);
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

    socket.on('authSuccess', (username) => {
      setCurrentUser(username);
      localStorage.setItem('currentUser', username);
      setError('');
    });

    socket.on('authError', (msg) => {
      setError(msg);
    });

    socket.on('error', (msg) => {
      setError(msg);
    });

    return () => {
      socket.off('roomCreated');
      socket.off('roomState');
      socket.off('diceRolled');
      socket.off('tiebreakerResolved');
      socket.off('authSuccess');
      socket.off('authError');
      socket.off('error');
    };
  }, []);

  useEffect(() => {
    if (!isRolling && !isTiebreakerAction && pendingState) {
      setRoomState(pendingState);
      setPendingState(null);
    }
  }, [isRolling, isTiebreakerAction, pendingState]);

  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('currentUser') || '');
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
    setCurrentUser('');
    localStorage.removeItem('currentUser');
    if (roomState) leaveRoom();
  };

  const createRoom = () => {
    socket.emit('createRoom', { name: currentUser, isSinglePlayer: false });
  };

  const joinRoom = (id) => {
    if (!id) return setError('Please enter a room code');
    socket.emit('joinRoom', { roomId: id, name: currentUser });
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
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex justify-between items-center shadow-sm transition-colors">
      <div className="flex items-center space-x-8">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => { if(roomState) leaveRoom(); }}>
          {/* Simple Logo */}
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9c-.83 0-1.5-.67-1.5-1.5S6.67 6 7.5 6s1.5.67 1.5 1.5S8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/>
            </svg>
          </div>
          <h1 className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">Stochastix</h1>
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
      <div className="flex items-center space-x-4">
        {currentUser && (
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mr-2 flex items-center gap-4">
            <span>Hello, <span className="font-bold text-slate-800 dark:text-slate-100">{currentUser}</span></span>
            <button 
              onClick={logout} 
              className="bg-slate-100 dark:bg-slate-700 hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-transparent hover:border-red-200 dark:hover:border-red-800 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-sm active:scale-95"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        )}
        <button 
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          title="Toggle Dark Mode"
        >
          {isDark ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
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
