import React, { useState, useEffect } from 'react';
import { calculatePMF, getOptimalPlacement } from '../lib/probability';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameBoard({ roomState, socket, lastRoll, isRollingGlobal, isTiebreakerAction, tiebreakerResults }) {
  const settings = roomState.settings;
  const minSum = settings.diceCount;
  const maxSum = settings.diceCount * settings.diceSides;

  const [autoRoll, setAutoRoll] = useState(false);


  const [rollingFaces, setRollingFaces] = useState([]);
  const [tiebreakerSpinResult, setTiebreakerSpinResult] = useState({});
  const [myTiebreakerPick, setMyTiebreakerPick] = useState(null);

  // Clear my pick when round changes
  useEffect(() => {
    if (roomState?.tiebreaker?.round) {
      setMyTiebreakerPick(null);
    }
  }, [roomState?.tiebreaker?.round]);

  useEffect(() => {
    let interval;
    if (isRollingGlobal) {
      interval = setInterval(() => {
        setRollingFaces(Array.from({ length: settings.diceCount }, () => Math.floor(Math.random() * settings.diceSides) + 1));
      }, 50);
    } else {
      if (lastRoll) setRollingFaces(lastRoll.details);
    }
    return () => clearInterval(interval);
  }, [isRollingGlobal, lastRoll, settings.diceCount, settings.diceSides]);

  useEffect(() => {
    let interval;
    if (isTiebreakerAction) {
      interval = setInterval(() => {
        if (roomState.tiebreaker) {
          const fakeResult = {};
          const mode = settings.tiebreakerMode || 'coin';
          roomState.tiebreaker.tiedPlayers.forEach(id => {
            fakeResult[id] = mode === 'coin' ? (Math.random() < 0.5 ? 'H' : 'T') : ['✊', '✋', '✌️'][Math.floor(Math.random() * 3)];
          });
          setTiebreakerSpinResult(fakeResult);
        }
      }, 50);
      setTimeout(() => {
        clearInterval(interval);
        setTiebreakerSpinResult(tiebreakerResults || {});
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isTiebreakerAction, tiebreakerResults, roomState.tiebreaker, settings.tiebreakerMode]);

  // Auto-Roll Logic
  useEffect(() => {
    const isHost = roomState.host === socket.id;
    if (isHost && autoRoll && !isRollingGlobal && roomState.state === 'PLAYING') {
      const timer = setTimeout(() => {
        socket.emit('hostForceRoll', { roomId: roomState.id });
      }, 1000); // 1 second delay between automatic rolls
      return () => clearTimeout(timer);
    }
  }, [autoRoll, isRollingGlobal, roomState.state, roomState.host, socket, roomState.id]);

  // Generate Data for Analytics
  const pmf = calculatePMF(settings.diceCount, settings.diceSides);
  
  // Count frequencies of rolls
  const frequencies = {};
  for (let i = minSum; i <= maxSum; i++) {
    frequencies[i] = 0;
  }
  roomState.history.forEach(roll => {
    frequencies[roll]++;
  });

  const actualRollsCount = roomState.history.length;
  const displayBase = Math.max(actualRollsCount, 10);

  const chartData = pmf.map(p => ({
    sum: p.sum,
    expected: parseFloat((p.probability * displayBase).toFixed(1)),
    actual: frequencies[p.sum]
  }));

  const gameOver = roomState.state === 'GAMEOVER';
  const isTiebreaker = roomState.state === 'TIEBREAKER';
  const tiebreaker = roomState.tiebreaker;

  const me = roomState.players[socket.id];
  const opponents = Object.entries(roomState.players).filter(([id]) => id !== socket.id);

  const allHumans = Object.values(roomState.players).filter(p => !p.isAI && !p.disconnected);
  const humanReadyCount = allHumans.filter(p => p.readyToRoll).length;
  const allHumansReady = allHumans.length === 0 || humanReadyCount === allHumans.length;


  const postGameAnalysis = React.useMemo(() => {
    if (!gameOver) return null;
    
    const optimal = getOptimalPlacement(settings.diceCount, settings.diceSides, settings.piecesPerPlayer);
    const errors = {};
    
    Object.values(roomState.players).forEach(p => {
      if (!p.initialPieces) return;
      let err = 0;
      Object.keys(optimal).forEach(sum => {
        const expected = optimal[sum] || 0;
        const actual = p.initialPieces[sum] || 0;
        err += Math.abs(expected - actual);
      });
      errors[p.id] = err;
    });

    if (Object.keys(errors).length === 0) return null; // Legacy game

    let mastermind = null;
    let minErr = Infinity;
    let highestErr = -1;
    let worstPlayer = null;

    Object.keys(errors).forEach(id => {
      if (errors[id] < minErr) {
        minErr = errors[id];
        mastermind = id;
      }
      if (errors[id] > highestErr) {
        highestErr = errors[id];
        worstPlayer = id;
      }
    });

    const winnerId = roomState.finalWinner;
    const isWinnerLucky = winnerId === worstPlayer && highestErr > 0;

    return { mastermind, minErr, isWinnerLucky, luckiestPlayer: isWinnerLucky ? winnerId : null };
  }, [gameOver, roomState.players, roomState.finalWinner, settings]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
      
      {/* Left Column: Board and Rolls */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-4 sm:p-6 lg:p-7 transition-colors flex flex-col overflow-hidden">
          {/* Header Row: Title & Badges */}
          <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700/80 flex-wrap">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 whitespace-nowrap font-display">
                Game Board
              </h2>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {roomState.history.length} Rolls
              </span>
            </div>

            {roomState.history.length === 0 && !isRollingGlobal && (
              <button
                onClick={() => socket.emit('unreadyPlacement', { roomId: roomState.id })}
                className="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                title="Return to setup phase to change your piece placement"
              >
                Edit Board
              </button>
            )}
          </div>

          {/* Dedicated Action Command Bar */}
          {!gameOver && !isTiebreaker && (
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 sm:p-3.5 border border-slate-200 dark:border-slate-700/80 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-inner">
              {/* Status / Readiness Info */}
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                {roomState.history.length === 0 ? (
                  allHumansReady ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-extrabold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      All players ready!
                    </span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                      Waiting ({humanReadyCount}/{allHumans.length} ready)
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    {isRollingGlobal ? 'Rolling dice...' : 'Match in progress'}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                {roomState.history.length === 0 && (
                  <button
                    onClick={() => socket.emit('toggleReadyToRoll', { roomId: roomState.id })}
                    disabled={isRollingGlobal}
                    className={`font-black text-xs sm:text-sm py-2 sm:py-2.5 px-4 sm:px-5 rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isRollingGlobal 
                        ? 'opacity-50 cursor-not-allowed bg-slate-500 text-white' 
                        : me?.readyToRoll 
                          ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/30 ring-2 ring-amber-400/50' 
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/40 ring-2 ring-emerald-400/50 animate-pulse'
                    }`}
                  >
                    <span>{me?.readyToRoll ? '✓' : '⚡'}</span>
                    <span>{isRollingGlobal ? 'Rolling...' : (me?.readyToRoll ? 'Cancel Ready' : 'Click to Ready')}</span>
                  </button>
                )}

                {roomState.host === socket.id && (
                  <>
                    <button
                      onClick={() => setAutoRoll(!autoRoll)}
                      className={`flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all active:scale-95 border cursor-pointer ${
                        autoRoll 
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30' 
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-sm'
                      }`}
                    >
                      <div className={`w-6 h-3.5 rounded-full flex items-center p-[2px] transition-colors ${autoRoll ? 'bg-indigo-300' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <div className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform ${autoRoll ? 'translate-x-2.5' : 'translate-x-0'}`} />
                      </div>
                      <span>Auto-Roll</span>
                    </button>

                    <button
                      onClick={() => socket.emit('hostForceRoll', { roomId: roomState.id })}
                      disabled={isRollingGlobal}
                      className={`text-white font-black text-xs sm:text-sm py-2 sm:py-2.5 px-4 sm:px-5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                        isRollingGlobal 
                          ? 'opacity-50 cursor-not-allowed bg-slate-500' 
                          : roomState.history.length === 0 && !allHumansReady
                            ? 'bg-slate-500 dark:bg-slate-600 hover:bg-slate-600 shadow-slate-900/30'
                            : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/40 ring-2 ring-indigo-400/40'
                      }`}
                    >
                      <span>🎲</span>
                      <span>{isRollingGlobal ? 'Rolling...' : (roomState.history.length === 0 && !allHumansReady ? `Force Roll (${humanReadyCount}/${allHumans.length})` : 'Roll Dice')}</span>
                    </button>
                  </>
                )}

                {roomState.host !== socket.id && roomState.history.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    <span>{isRollingGlobal ? 'Rolling dice...' : 'Waiting for host to roll...'}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile Current Roll Banner (lg:hidden) */}
          <div className="lg:hidden bg-slate-100 dark:bg-slate-900/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/80 mb-6 text-center shadow-inner">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Current Roll
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center justify-center gap-2">
                {rollingFaces.length > 0 ? (
                  rollingFaces.map((face, idx) => (
                    <motion.div 
                      key={idx}
                      animate={{ scale: isRollingGlobal ? [1, 1.1, 1] : 1 }}
                      transition={{ duration: 0.2 }}
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black shadow-md border-2 ${
                        isRollingGlobal 
                          ? 'bg-indigo-100 border-indigo-400 text-indigo-600 dark:bg-indigo-900/60 dark:border-indigo-500 dark:text-indigo-300' 
                          : 'bg-white border-slate-300 text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-white'
                      }`}
                    >
                      {face}
                    </motion.div>
                  ))
                ) : (
                  Array.from({ length: settings.diceCount }).map((_, idx) => (
                    <div key={idx} className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl font-bold text-slate-400 dark:text-slate-600 border border-slate-300 dark:border-slate-700">
                      ?
                    </div>
                  ))
                )}
              </div>
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                = {rollingFaces.length > 0 ? rollingFaces.reduce((a, b) => a + b, 0) : '-'}
              </div>
            </div>
          </div>

          {/* Opponents Mini-Bar */}
          {opponents.length > 0 && (
            <div className="mb-8">
              <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Opponents</h4>
              <div className="flex flex-wrap gap-4">
                {opponents.map(([id, player]) => (
                  <div key={id} className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700 flex items-center gap-4 min-w-[200px]">
                    <div className="flex-1">
                      <div className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                        {player.name}
                        {player.isAI && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">AI</span>}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{player.totalPieces} blocks left</div>
                    </div>
                    {roomState.state === 'PLAYING' && (
                      <div>
                        {roomState.history.length === 0 ? (
                          player.readyToRoll ? (
                            <span className="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold">Ready</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold">Thinking</span>
                          )
                        ) : player.disconnected ? (
                          <span className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold">Disconnected</span>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold">Connected</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My Board */}
          {me && (
            <div className="relative mt-auto pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  My Board
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Pieces left</span>
                  <span className="text-3xl font-black text-blue-600 dark:text-blue-400">{me.totalPieces}</span>
                </div>
              </div>
              
              <div className="flex bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto custom-scrollbar-x gap-4 min-h-[220px] shadow-inner relative transition-all border-blue-200 dark:border-blue-800">
                {Array.from({ length: maxSum - minSum + 1 }, (_, i) => i + minSum).map(num => (
                  <div key={num} className="flex-1 min-w-[50px] flex flex-col items-center justify-end relative group">
                    <div className="absolute top-0 w-full py-1 text-center opacity-50 transition-opacity group-hover:opacity-100">
                      <span className="text-sm font-black text-slate-400 dark:text-slate-500">{num}</span>
                    </div>
                    <div className="flex flex-col gap-1 pb-1 pt-8 items-center w-full">
                      <AnimatePresence>
                        {Array.from({ length: me.pieces[num] || 0 }).map((_, i) => (
                          <motion.div 
                            key={`me-${num}-${i}`}
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.5, y: 20 }}
                            whileHover={{ scale: 1.1 }}
                            className="w-12 h-4 rounded-sm shadow-sm border cursor-pointer bg-blue-500 border-blue-600 dark:bg-blue-600 dark:border-blue-700"
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                    <div className="w-full border-b-2 border-slate-200 dark:border-slate-700 mt-2 transition-colors group-hover:border-blue-400 dark:group-hover:border-blue-500"></div>
                  </div>
                ))}
              </div>
              
              {me.totalPieces === 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 bg-white/70 dark:bg-slate-800/80 backdrop-blur-[2px] flex items-center justify-center rounded-xl border-2 border-green-400 z-10 shadow-lg"
                  >
                    <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-green-500 to-emerald-700 dark:from-green-400 dark:to-emerald-500 tracking-widest uppercase transform -rotate-6 filter drop-shadow-sm">BlockO!</span>
                  </motion.div>
                )}
            </div>
          )}

          {/* Sticky Mobile Host Bar for Quick Rolls */}
          {roomState.host === socket.id && !gameOver && !isTiebreaker && (
            <div className="lg:hidden sticky bottom-3 z-30 p-3 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl flex items-center justify-between gap-2 mt-4 animate-fade-in">
              <button
                onClick={() => setAutoRoll(!autoRoll)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs border active:scale-95 ${
                  autoRoll 
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm' 
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                <div className={`w-5 h-3 rounded-full flex items-center p-[1px] ${autoRoll ? 'bg-indigo-300' : 'bg-slate-600'}`}>
                  <div className={`w-2 h-2 bg-white rounded-full ${autoRoll ? 'translate-x-2' : 'translate-x-0'}`} />
                </div>
                <span>Auto</span>
              </button>

              <button
                onClick={() => socket.emit('hostForceRoll', { roomId: roomState.id })}
                disabled={isRollingGlobal}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm py-2.5 px-4 rounded-xl shadow-lg active:scale-95 flex items-center justify-center gap-2 border border-indigo-400/40 disabled:opacity-50"
              >
                <span>🎲</span>
                <span>{isRollingGlobal ? 'Rolling...' : (roomState.history.length === 0 && !allHumansReady ? `Force (${humanReadyCount}/${allHumans.length})` : 'Roll Dice')}</span>
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Right Column: Analytics & Info */}
      <div className="space-y-8">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-8 text-center transition-colors">
          <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Current Roll</h3>
          <div className="flex justify-center gap-4 mb-8">
            {rollingFaces.length > 0 ? (
              rollingFaces.map((face, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ scale: 0.8, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black shadow-lg border-2 cursor-pointer transition-colors ${isRollingGlobal ? 'bg-indigo-100 border-indigo-300 text-indigo-500 dark:bg-indigo-900/50 dark:border-indigo-700 dark:text-indigo-400' : 'bg-white border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-600 dark:text-white'}`}
                >
                  {face}
                </motion.div>
              ))
            ) : (
              Array.from({ length: settings.diceCount }).map((_, idx) => (
                <div key={idx} className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-2xl flex items-center justify-center text-4xl font-black text-slate-300 dark:text-slate-700 shadow-inner border border-slate-200 dark:border-slate-800">
                  ?
                </div>
              ))
            )}
          </div>
          <div className="text-5xl font-black text-indigo-600 dark:text-indigo-400 drop-shadow-sm">
            {rollingFaces.length > 0 ? rollingFaces.reduce((a, b) => a + b, 0) : '-'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-6 transition-colors">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Roll Distribution</h3>
             <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-3 py-1 rounded-full shadow-inner border border-slate-200 dark:border-slate-600">
               {roomState.history.length} Rolls
             </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <XAxis dataKey="sum" tick={{fontSize: 12, fill: 'currentColor'}} className="text-slate-500 dark:text-slate-400" />
                <YAxis tick={{fontSize: 12, fill: 'currentColor'}} className="text-slate-500 dark:text-slate-400" />
                <Tooltip cursor={{fill: 'rgba(148, 163, 184, 0.1)'}} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                <Bar dataKey="expected" fill="#94a3b8" name="Expected" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="actual" fill="#3b82f6" name="Actual Rolls" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TIEBREAKER MODAL */}
      <AnimatePresence>
        {isTiebreaker && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-7 max-w-2xl w-full text-center border-2 border-amber-500 shadow-2xl shadow-amber-500/20 relative max-h-[92vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="shrink-0 mb-2">
                <h2 className="text-xl sm:text-3xl font-black text-amber-400 mb-1 font-display">
                  {settings.tiebreakerMode === 'rps' ? 'ROCK, PAPER, SCISSORS!' : 'COIN FLIP TIEBREAKER!'}
                </h2>
                <p className="text-slate-300 font-bold text-xs sm:text-base">Round {tiebreaker.round}</p>
              </div>
              
              {/* Players Confrontation Area */}
              <div className="flex-1 overflow-y-auto custom-scrollbar my-2 py-1 min-h-0 flex flex-col justify-center">
                <div className="flex items-center justify-around gap-2 sm:gap-6 w-full">
                  {tiebreaker.tiedPlayers.map((pId, index) => {
                    const resultStr = tiebreaker.currentFlips[pId];
                    let displayVal = settings.tiebreakerMode === 'rps' ? '❓' : '🪙';
                    let choiceVal = '';
                    
                    if (resultStr && !isTiebreakerAction) {
                      if (settings.tiebreakerMode === 'rps') {
                        if (resultStr === 'READY') {
                          displayVal = (pId === socket.id && myTiebreakerPick) ? myTiebreakerPick : '⏳';
                        }
                        else if (resultStr === 'rock') displayVal = '✊';
                        else if (resultStr === 'paper') displayVal = '✋';
                        else if (resultStr === 'scissors') displayVal = '✌️';
                        else displayVal = resultStr;
                      } else if (settings.tiebreakerMode === 'coin') {
                        if (typeof resultStr === 'string' && resultStr.includes(':')) {
                          const [c, l] = resultStr.split(':');
                          choiceVal = c;
                          displayVal = l;
                        } else {
                          displayVal = resultStr;
                        }
                      }
                    } else if (isTiebreakerAction && tiebreakerSpinResult[pId]) {
                       let val = tiebreakerSpinResult[pId];
                       if (settings.tiebreakerMode === 'rps') {
                         if (val === 'rock') val = '✊';
                         else if (val === 'paper') val = '✋';
                         else if (val === 'scissors') val = '✌️';
                       }
                       displayVal = val;
                    }

                    return (
                      <React.Fragment key={pId}>
                        {index > 0 && (
                          <div className="flex items-center justify-center px-1">
                            <span className="text-xl sm:text-3xl font-black text-amber-500/70">VS</span>
                          </div>
                        )}
                        <div className="flex flex-col items-center flex-1 min-w-0">
                          <div className="text-xs sm:text-base font-extrabold text-white mb-1.5 sm:mb-2 truncate max-w-[130px] sm:max-w-none text-center">
                            {roomState.players[pId].name} {pId === socket.id && <span className="text-amber-400 block sm:inline text-[11px] sm:text-xs font-bold">(You)</span>}
                          </div>
                          
                          <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 relative my-1 perspective-1000">
                            <motion.div
                              animate={
                                isTiebreakerAction 
                                  ? (settings.tiebreakerMode === 'rps' 
                                      ? { scale: [1, 1.15, 1] } 
                                      : { rotateY: [0, 720, 1440, 2160, 2880, 3600], scale: [1, 1.15, 1] })
                                  : { rotateY: 0, rotateZ: 0, scale: 1 }
                              }
                              transition={{ duration: 2.0, ease: "easeInOut" }}
                              className={`w-full h-full shadow-lg flex items-center justify-center ${settings.tiebreakerMode === 'rps' ? 'rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-indigo-400 bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-indigo-500/30' : 'rounded-full border-2 sm:border-4 border-amber-400 bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30'}`}
                              style={{ transformStyle: 'preserve-3d' }}
                            >
                              {displayVal === '⏳' ? (
                                <svg className="animate-spin h-7 w-7 sm:h-10 sm:w-10 text-white/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <span className={`text-2xl sm:text-4xl md:text-5xl font-black drop-shadow-md select-none ${settings.tiebreakerMode === 'rps' ? 'text-white' : 'text-amber-100'}`}>
                                  {displayVal}
                                </span>
                              )}
                            </motion.div>
                          </div>

                          {settings.tiebreakerMode === 'coin' && choiceVal && !isTiebreakerAction && (
                            <div className="text-[11px] sm:text-xs font-bold text-amber-200/90 mt-1 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                              Chose {choiceVal === 'H' ? 'Heads' : choiceVal === 'T' ? 'Tails' : choiceVal}
                            </div>
                          )}

                          <div className={`text-sm sm:text-xl font-black mt-1 ${settings.tiebreakerMode === 'rps' ? 'text-indigo-400' : 'text-amber-400'}`}>
                            Score: {tiebreaker.scores[pId] || 0}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons Pinned at Bottom */}
              <div className="shrink-0 pt-3 sm:pt-4 border-t border-slate-700/80 w-full mt-2">
                {tiebreaker.tiedPlayers.includes(socket.id) && !tiebreaker.currentFlips[socket.id] && (
                  <div className="w-full">
                    <div className="text-xs sm:text-sm font-extrabold text-amber-300 uppercase tracking-wider mb-2.5">
                      Choose your move:
                    </div>
                    {settings.tiebreakerMode === 'coin' ? (
                      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-md mx-auto">
                        <button 
                          onClick={() => socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'H' })}
                          disabled={isTiebreakerAction}
                          className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-base sm:text-xl py-3.5 sm:py-4 px-4 sm:px-8 rounded-2xl transition-all active:scale-95 shadow-xl shadow-amber-500/30 border-2 border-amber-300/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <span>🪙</span> HEADS
                        </button>
                        <button 
                          onClick={() => socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'T' })}
                          disabled={isTiebreakerAction}
                          className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-base sm:text-xl py-3.5 sm:py-4 px-4 sm:px-8 rounded-2xl transition-all active:scale-95 shadow-xl shadow-amber-500/30 border-2 border-amber-300/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          <span>🪙</span> TAILS
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-lg mx-auto">
                        <button
                          onClick={() => {
                            setMyTiebreakerPick('✊');
                            socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'rock' });
                          }}
                          disabled={isTiebreakerAction}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm md:text-base py-3 sm:py-3.5 px-2 sm:px-4 rounded-xl active:scale-95 transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 border border-indigo-400/40 disabled:opacity-50"
                        >
                          <span className="text-base sm:text-xl">✊</span> ROCK
                        </button>
                        <button
                          onClick={() => {
                            setMyTiebreakerPick('✋');
                            socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'paper' });
                          }}
                          disabled={isTiebreakerAction}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm md:text-base py-3 sm:py-3.5 px-2 sm:px-4 rounded-xl active:scale-95 transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 border border-indigo-400/40 disabled:opacity-50"
                        >
                          <span className="text-base sm:text-xl">✋</span> PAPER
                        </button>
                        <button
                          onClick={() => {
                            setMyTiebreakerPick('✌️');
                            socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'scissors' });
                          }}
                          disabled={isTiebreakerAction}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm md:text-base py-3 sm:py-3.5 px-2 sm:px-4 rounded-xl active:scale-95 transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 border border-indigo-400/40 disabled:opacity-50"
                        >
                          <span className="text-base sm:text-xl">✌️</span> SCISSORS
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Auto-Resolve for Observers */}
                {!tiebreaker.tiedPlayers.includes(socket.id) && tiebreaker.tiedPlayers.every(id => roomState.players[id].isAI) && !isTiebreakerAction && (
                  <button 
                    onClick={() => socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'H' })}
                    disabled={isTiebreakerAction}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm sm:text-base py-3.5 px-6 rounded-xl transition-all active:scale-95 shadow-lg border border-indigo-400/40"
                  >
                    ⚡ SIMULATE AI TIEBREAKER
                  </button>
                )}

                {tiebreaker.tiedPlayers.includes(socket.id) && tiebreaker.currentFlips[socket.id] && !isTiebreakerAction && (
                  <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs sm:text-sm py-2 px-4 rounded-xl inline-flex items-center gap-2 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    Choice submitted! Waiting for opponent...
                  </div>
                )}
                {isTiebreakerAction && (
                  <div className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-black text-sm sm:text-base py-2.5 px-5 rounded-xl inline-flex items-center gap-2 animate-pulse">
                    <span>🎲</span> {settings.tiebreakerMode === 'rps' ? 'Resolving moves...' : 'Flipping coins...'}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GAME OVER OVERLAY MODAL */}
      <AnimatePresence>
        {gameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 max-w-lg w-full max-h-[90vh] flex flex-col text-center relative overflow-hidden transition-colors"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-600"></div>
              
              {/* Header (shrink-0) */}
              <div className="shrink-0 pt-2 pb-1">
                <div className="inline-block bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full p-3 mb-2 shadow-inner border border-green-200 dark:border-green-800">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mb-1 font-display">Game Over!</h2>
                <p className="text-lg sm:text-xl text-green-600 dark:text-green-400 font-extrabold">
                  {roomState.players[roomState.finalWinner]?.name || 'Unknown'} wins!
                </p>
              </div>

              {/* Scrollable Body (flex-1 overflow-y-auto) */}
              <div className="flex-1 overflow-y-auto custom-scrollbar my-3 pr-1 space-y-3.5 text-left">
                {/* Points Payout */}
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700/80 shadow-inner">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2.5 border-b border-slate-200 dark:border-slate-700 pb-1.5">Points Payout</h3>
                  <div className="space-y-1.5">
                    {Object.values(roomState.players)
                      .sort((a, b) => (b.pointChange || 0) - (a.pointChange || 0))
                      .map((p, i) => (
                        <div key={p.id} className="flex justify-between items-center text-sm">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {i === 0 ? '👑 ' : ''}{p.name}
                          </span>
                          <span className={`font-mono font-bold ${p.pointChange > 0 ? 'text-green-600 dark:text-green-400' : p.pointChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                            {p.pointChange > 0 ? '+' : ''}{p.pointChange || 0}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Debrief (Luck vs Skill) */}
                {postGameAnalysis && (
                  <div className="bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl p-3.5 border border-indigo-200 dark:border-indigo-800/60 shadow-inner">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-800 dark:text-indigo-300 mb-2.5 border-b border-indigo-200 dark:border-indigo-800/80 pb-1.5">Debrief (Luck vs Skill)</h3>
                    <div className="space-y-2.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">🧠</span>
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">The Mastermind</span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 ml-6">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{roomState.players[postGameAnalysis.mastermind]?.name}</span> had the most mathematically optimal initial board placement.
                        </div>
                      </div>
                      {postGameAnalysis.isWinnerLucky && (
                        <div className="flex flex-col gap-0.5 mt-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">🍀</span>
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">Pure Luck</span>
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-300 ml-6">
                            <span className="font-bold text-green-600 dark:text-green-400">{roomState.players[postGameAnalysis.luckiestPlayer]?.name}</span> won despite having the worst initial mathematical placement! The dice favored them today!
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tiebreaker Breakdown */}
                {tiebreaker && (
                  <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700/80 shadow-inner">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1.5 flex items-center gap-1.5">
                      <span>
                        {settings.tiebreakerMode === 'roll' ? '🎲' : settings.tiebreakerMode === 'rps' ? '✌️' : '🪙'}
                      </span> 
                      {settings.tiebreakerMode === 'roll' 
                        ? 'Tiebreaker Highest Roll' 
                        : settings.tiebreakerMode === 'rps' 
                          ? 'Tiebreaker Rock Paper Scissors' 
                          : 'Tiebreaker Coin Flip'}
                    </h3>
                    <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar">
                      <div className="flex gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <div className="w-1/3">Player</div>
                        <div className="w-1/3 text-center">{settings.tiebreakerMode === 'roll' ? 'Rolls' : settings.tiebreakerMode === 'rps' ? 'Moves' : 'Flips'}</div>
                        <div className="w-1/3 text-right">{settings.tiebreakerMode === 'roll' ? 'Final' : 'Wins'}</div>
                      </div>
                      {tiebreaker.tiedPlayers.map(pId => (
                        <div key={pId} className="flex gap-2 items-center text-xs">
                          <div className="w-1/3 font-bold text-slate-700 dark:text-slate-200 truncate">
                            {roomState.players[pId].name}
                          </div>
                          <div className="w-1/3 flex justify-center flex-wrap gap-1 font-mono">
                            {tiebreaker.flips.map((f, i) => {
                              let result = f[pId];
                              if (settings.tiebreakerMode === 'rps' && result) {
                                if (result === 'rock') result = '✊';
                                else if (result === 'paper') result = '✋';
                                else if (result === 'scissors') result = '✌️';
                              }
                              return (
                                <span key={i} className={`${
                                  settings.tiebreakerMode === 'roll' 
                                    ? 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30' 
                                    : settings.tiebreakerMode === 'rps'
                                      ? 'text-slate-700 bg-slate-200 dark:text-slate-300 dark:bg-slate-700'
                                      : (result === 'H' ? 'text-green-500 bg-green-100 dark:bg-green-900/30' : 'text-red-500 bg-red-100 dark:bg-red-900/30')
                                } px-1.5 py-0.5 rounded text-[10px] flex items-center justify-center font-bold`}>
                                  {result || '-'}
                                </span>
                              );
                            })}
                          </div>
                          <div className="w-1/3 text-right font-black text-slate-800 dark:text-slate-100">
                            {settings.tiebreakerMode === 'roll' ? (tiebreaker.flips[tiebreaker.flips.length-1]?.[pId] || '-') : (tiebreaker.scores[pId] || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Pinned Bottom Action Button (shrink-0) */}
              <div className="shrink-0 pt-3 border-t border-slate-200 dark:border-slate-800 mt-1">
                {roomState.host === socket.id ? (
                  <button 
                    onClick={() => socket.emit('resetToLobby', { roomId: roomState.id })} 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm sm:text-base py-3.5 px-6 rounded-xl shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
                  >
                    Return to Lobby
                  </button>
                ) : (
                  <button 
                    onClick={() => window.location.reload()} 
                    className="w-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-black text-sm sm:text-base py-3.5 px-6 rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer"
                  >
                    Leave Room
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
