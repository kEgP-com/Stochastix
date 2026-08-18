import React, { useState, useEffect } from 'react';
import { calculatePMF } from '../lib/probability';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

export default function GameBoard({ roomState, socket, lastRoll, isRollingGlobal, isTiebreakerAction, tiebreakerResults }) {
  const settings = roomState.settings;
  const minSum = settings.diceCount;
  const maxSum = settings.diceCount * settings.diceSides;

  const [autoRoll, setAutoRoll] = useState(false);

  const readyToRoll = () => {
    socket.emit('readyToRoll', { roomId: roomState.id });
  };

  const [rollingFaces, setRollingFaces] = useState([]);
  const [tiebreakerSpinResult, setTiebreakerSpinResult] = useState({});

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
            fakeResult[id] = mode === 'coin' ? (Math.random() < 0.5 ? 'H' : 'T') : ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
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
    if (autoRoll && !isRollingGlobal && roomState.state === 'PLAYING' && !roomState.players[socket.id]?.readyToRoll) {
      const timer = setTimeout(() => {
        readyToRoll();
      }, 500); // Small delay to let user see result before immediately readying up
      return () => clearTimeout(timer);
    }
  }, [autoRoll, isRollingGlobal, roomState.state, roomState.players, socket.id]);

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
      
      {/* Left Column: Board and Rolls */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-8 transition-colors flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 border-b border-slate-200 dark:border-slate-700 pb-4">
            <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">Game Board</h2>
            {!gameOver && !isTiebreaker && (
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  onClick={() => setAutoRoll(!autoRoll)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 border ${autoRoll ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700 shadow-inner' : 'bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 shadow-sm'}`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${autoRoll ? 'border-indigo-600 dark:border-indigo-400' : 'border-slate-400 dark:border-slate-500'}`}>
                    {autoRoll && <div className="w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full" />}
                  </div>
                  <span className="whitespace-nowrap">Auto-Roll</span>
                </button>
                <button
                  onClick={readyToRoll}
                  disabled={isRollingGlobal || me?.readyToRoll}
                  className={`bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 sm:px-8 rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all whitespace-nowrap flex-1 sm:flex-none ${(isRollingGlobal || me?.readyToRoll) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isRollingGlobal ? 'Rolling...' : (me?.readyToRoll ? 'Waiting...' : 'Ready To Roll')}
                </button>
              </div>
            )}
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
                        {player.readyToRoll ? (
                          <span className="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold">Ready</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded text-[10px] uppercase tracking-wider font-bold">Thinking</span>
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
        </div>
      </div>      {/* Right Column: Analytics & Info */}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-800 rounded-3xl p-8 max-w-3xl w-full text-center border-2 border-amber-500 shadow-2xl shadow-amber-500/20"
            >
              <h2 className="text-4xl font-black text-amber-500 mb-2">
                {settings.tiebreakerMode === 'rps' ? 'ROCK, PAPER, SCISSORS!' : 'COIN FLIP TIEBREAKER!'}
              </h2>
              <p className="text-slate-300 font-bold text-xl mb-12">Round {tiebreaker.round}</p>
              
              <div className="flex justify-center flex-wrap gap-12 mb-12">
                {tiebreaker.tiedPlayers.map(pId => {
                  const resultStr = tiebreaker.currentFlips[pId];
                  let displayVal = settings.tiebreakerMode === 'rps' ? '✊' : '🪙';
                  let choiceVal = '';
                  let landedVal = '';
                  
                  if (resultStr && !isTiebreakerAction) {
                    if (settings.tiebreakerMode === 'rps') {
                      if (resultStr === 'rock') displayVal = '✊';
                      else if (resultStr === 'paper') displayVal = '✋';
                      else if (resultStr === 'scissors') displayVal = '✌️';
                      else displayVal = resultStr;
                    } else if (settings.tiebreakerMode === 'coin') {
                      if (typeof resultStr === 'string' && resultStr.includes(':')) {
                        const [c, l] = resultStr.split(':');
                        choiceVal = c;
                        landedVal = l;
                        displayVal = l; // Show what it landed on in the circle
                      } else {
                        displayVal = resultStr;
                      }
                    }
                  } else if (isTiebreakerAction && tiebreakerSpinResult[pId]) {
                     displayVal = tiebreakerSpinResult[pId];
                  }

                  return (
                    <div key={pId} className="flex flex-col items-center">
                      <div className="text-xl font-bold text-white mb-6">
                        {roomState.players[pId].name} {pId === socket.id && '(You)'}
                      </div>
                      
                      <div className="w-32 h-32 relative mb-2 perspective-1000">
                        <motion.div
                          animate={
                            isTiebreakerAction 
                              ? (settings.tiebreakerMode === 'rps' 
                                  ? { rotateZ: [-10, 10, -10, 10, 0], scale: [1, 1.2, 1] } 
                                  : { rotateY: [0, 720, 1440, 2160, 2880, 3600], scale: [1, 1.2, 1] })
                              : { rotateY: 0, rotateZ: 0, scale: 1 }
                          }
                          transition={{ duration: 2.0, ease: "easeInOut" }}
                          className={`w-full h-full shadow-inner flex items-center justify-center ${settings.tiebreakerMode === 'rps' ? 'rounded-3xl border-4 border-indigo-400 bg-gradient-to-br from-indigo-500 to-indigo-700' : 'rounded-full border-4 border-amber-400 bg-gradient-to-br from-amber-400 to-amber-600'}`}
                          style={{ transformStyle: 'preserve-3d' }}
                        >
                          <span className={`text-5xl font-black drop-shadow-md ${settings.tiebreakerMode === 'rps' ? 'text-white' : 'text-amber-100'}`}>
                            {displayVal}
                          </span>
                        </motion.div>
                      </div>

                      {settings.tiebreakerMode === 'coin' && choiceVal && !isTiebreakerAction && (
                        <div className="text-sm font-bold text-amber-200/60 mb-2">
                          Chose {choiceVal}
                        </div>
                      )}

                      <div className={`text-2xl font-black ${settings.tiebreakerMode === 'rps' ? 'text-indigo-400 mt-4' : 'text-amber-400 mt-2'}`}>
                        Score: {tiebreaker.scores[pId] || 0}
                      </div>
                    </div>
                  );
                })}
              </div>

              {tiebreaker.tiedPlayers.includes(socket.id) && !tiebreaker.currentFlips[socket.id] && (
                <div className="flex flex-wrap gap-4 justify-center">
                  {settings.tiebreakerMode === 'coin' ? (
                    <>
                      <button 
                        onClick={() => socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'H' })}
                        disabled={isTiebreakerAction}
                        className="bg-amber-500 hover:bg-amber-600 shadow-amber-500/50 text-slate-900 font-black text-lg md:text-xl py-3 md:py-4 px-6 md:px-8 rounded-full transition-all active:scale-95 shadow-lg disabled:opacity-50"
                      >
                        HEADS
                      </button>
                      <button 
                        onClick={() => socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'T' })}
                        disabled={isTiebreakerAction}
                        className="bg-amber-500 hover:bg-amber-600 shadow-amber-500/50 text-slate-900 font-black text-lg md:text-xl py-3 md:py-4 px-6 md:px-8 rounded-full transition-all active:scale-95 shadow-lg disabled:opacity-50"
                      >
                        TAILS
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'rock' })}
                        disabled={isTiebreakerAction}
                        className="bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/50 text-slate-900 font-black text-lg md:text-xl py-2 md:py-3 px-4 md:px-6 rounded-2xl transition-all active:scale-95 shadow-lg disabled:opacity-50"
                      >
                        ✊ ROCK
                      </button>
                      <button 
                        onClick={() => socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'paper' })}
                        disabled={isTiebreakerAction}
                        className="bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/50 text-slate-900 font-black text-lg md:text-xl py-2 md:py-3 px-4 md:px-6 rounded-2xl transition-all active:scale-95 shadow-lg disabled:opacity-50"
                      >
                        ✋ PAPER
                      </button>
                      <button 
                        onClick={() => socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'scissors' })}
                        disabled={isTiebreakerAction}
                        className="bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/50 text-slate-900 font-black text-lg md:text-xl py-2 md:py-3 px-4 md:px-6 rounded-2xl transition-all active:scale-95 shadow-lg disabled:opacity-50"
                      >
                        ✌️ SCISSORS
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* AI Auto-Resolve for Observers */}
              {!tiebreaker.tiedPlayers.includes(socket.id) && tiebreaker.tiedPlayers.every(id => roomState.players[id].isAI) && !isTiebreakerAction && (
                <button 
                  onClick={() => socket.emit('playTiebreaker', { roomId: roomState.id, choice: 'H' })}
                  disabled={isTiebreakerAction}
                  className="bg-slate-500 hover:bg-slate-600 shadow-slate-500/50 text-white font-black text-xl py-4 px-12 rounded-full transition-all active:scale-95 shadow-lg"
                >
                  SIMULATE AI TIEBREAKER
                </button>
              )}

              {tiebreaker.tiedPlayers.includes(socket.id) && tiebreaker.currentFlips[socket.id] && !isTiebreakerAction && (
                <div className={`${settings.tiebreakerMode === 'rps' ? 'text-indigo-400/80' : 'text-amber-500/80'} font-bold italic animate-pulse`}>Waiting for others...</div>
              )}
              {isTiebreakerAction && (
                <div className={`${settings.tiebreakerMode === 'rps' ? 'text-indigo-400' : 'text-amber-500'} font-black text-xl italic animate-pulse`}>
                  {settings.tiebreakerMode === 'rps' ? 'Choosing...' : 'Flipping...'}
                </div>
              )}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 max-w-lg w-full text-center relative overflow-hidden transition-colors"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-emerald-600"></div>
              
              <div className="inline-block bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full p-4 mb-4 mt-4 shadow-inner border border-green-200 dark:border-green-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-2">Game Over!</h2>
              <p className="text-2xl text-green-600 dark:text-green-400 font-bold mb-6">
                {roomState.players[roomState.finalWinner]?.name || 'Unknown'} wins!
              </p>

              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 text-left border border-slate-200 dark:border-slate-700 shadow-inner mb-6">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Points Payout</h3>
                <div className="space-y-2">
                  {Object.values(roomState.players)
                    .sort((a, b) => (b.pointChange || 0) - (a.pointChange || 0))
                    .map((p, i) => (
                      <div key={p.id} className="flex justify-between items-center text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {i === 0 ? '👑 ' : ''}{p.name}
                        </span>
                        <span className={`font-bold ${p.pointChange > 0 ? 'text-green-600 dark:text-green-400' : p.pointChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                          {p.pointChange > 0 ? '+' : ''}{p.pointChange || 0}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {tiebreaker && (
                <div className="mt-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 text-left border border-slate-200 dark:border-slate-700 shadow-inner">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-4 border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center gap-2">
                    <span className="text-xl">{settings.tiebreakerMode === 'roll' ? '🎲' : '🪙'}</span> 
                    {settings.tiebreakerMode === 'roll' ? 'Tiebreaker Highest Roll' : 'Tiebreaker Coin Flip'}
                  </h3>
                  <div className="space-y-4 max-h-[160px] overflow-y-auto custom-scrollbar">
                    <div className="flex gap-4 mb-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      <div className="w-1/3">Player</div>
                      <div className="w-1/3 text-center">{settings.tiebreakerMode === 'roll' ? 'Rolls' : 'Flips'}</div>
                      <div className="w-1/3 text-right">{settings.tiebreakerMode === 'roll' ? 'Final Roll' : 'Wins'}</div>
                    </div>
                    {tiebreaker.tiedPlayers.map(pId => (
                      <div key={pId} className="flex gap-4 items-center text-sm">
                        <div className="w-1/3 font-bold text-slate-700 dark:text-slate-300">
                          {roomState.players[pId].name}
                        </div>
                        <div className="w-1/3 flex justify-center gap-1 font-mono">
                          {tiebreaker.flips.map((f, i) => (
                            <span key={i} className={`${settings.tiebreakerMode === 'roll' ? 'text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30' : (f[pId] === 'H' ? 'text-green-500 bg-green-100 dark:bg-green-900/30' : 'text-red-500 bg-red-100 dark:bg-red-900/30')} px-2 py-0.5 rounded text-xs`}>
                              {f[pId] || '-'}
                            </span>
                          ))}
                        </div>
                        <div className="w-1/3 text-right font-black text-slate-800 dark:text-slate-100">
                          {settings.tiebreakerMode === 'roll' ? (tiebreaker.flips[tiebreaker.flips.length-1]?.[pId] || '-') : tiebreaker.scores[pId]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => window.location.reload()} 
                className="mt-8 w-full bg-slate-800 dark:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-slate-900 dark:hover:bg-blue-700 active:scale-95 transition"
              >
                Back to Lobby
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
