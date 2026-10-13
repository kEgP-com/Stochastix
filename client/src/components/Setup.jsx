import React, { useState, useMemo } from 'react';
import { calculatePMF } from '../lib/probability';

export default function Setup({ roomState, socket }) {
  const settings = roomState.settings;
  const minSum = settings.diceCount;
  const maxSum = settings.diceCount * settings.diceSides;
  
  const [showHeatmap, setShowHeatmap] = useState(false);
  
  const pmf = useMemo(() => calculatePMF(settings.diceCount, settings.diceSides), [settings]);
  const maxProb = useMemo(() => Math.max(...pmf.map(p => p.probability)), [pmf]);

  const me = roomState.players[socket.id];
  const [placement, setPlacement] = useState(() => {
    if (me?.pieces && Object.keys(me.pieces).length > 0) {
      return { ...me.pieces };
    }
    const initial = {};
    for (let i = minSum; i <= maxSum; i++) {
      initial[i] = 0;
    }
    return initial;
  });

  const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0);
  const remaining = settings.piecesPerPlayer - totalPlaced;

  const handleColumnClick = (targetCol) => {
    if (remaining > 0) {
      setPlacement(prev => ({
        ...prev,
        [targetCol]: prev[targetCol] + 1
      }));
    }
  };

  const handlePieceClick = (sourceCol, e) => {
    e.stopPropagation();
    if (placement[sourceCol] > 0) {
      setPlacement(prev => ({
        ...prev,
        [sourceCol]: prev[sourceCol] - 1
      }));
    }
  };

  const submitPlacement = () => {
    if (remaining !== 0) return;
    socket.emit('setPlacement', {
      roomId: roomState.id,
      placement
    });
  };

  const randomizePlacement = () => {
    const minSum = settings.diceCount;
    const maxSum = settings.diceCount * settings.diceSides;
    const newPlacement = {};
    for (let i = minSum; i <= maxSum; i++) newPlacement[i] = 0;
    
    let piecesToPlace = settings.piecesPerPlayer;
    while (piecesToPlace > 0) {
      const col = Math.floor(Math.random() * (maxSum - minSum + 1)) + minSum;
      newPlacement[col]++;
      piecesToPlace--;
    }
    setPlacement(newPlacement);
  };

  if (me.ready) {
    return (
      <div className="text-center py-16 animate-fade-in text-slate-100 max-w-lg mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 font-display">Waiting for other players...</h2>
        <p className="text-slate-400 text-sm mb-6">Your pieces are locked in and ready.</p>
        
        <div className="glass-panel rounded-2xl p-5 border border-slate-700/60 shadow-xl text-left mb-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Player Status</h3>
          <div className="space-y-2.5">
            {Object.entries(roomState.players).map(([id, p]) => (
              <div key={id} className="flex justify-between items-center font-semibold text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-200">{p.name}</span>
                  {p.isAI && <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded">AI</span>}
                </div>
                <div className="flex items-center gap-2">
                  {p.ready ? (
                    <span className="text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg text-xs font-bold">Ready</span>
                  ) : (
                    <span className="text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Placing...
                    </span>
                  )}
                  {roomState.host === socket.id && id !== socket.id && (
                    <button
                      onClick={() => socket.emit('kickPlayer', { roomId: roomState.id, targetId: id })}
                      className="text-slate-400 hover:text-red-400 transition-colors px-1"
                      title="Kick Player"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="flex justify-center space-x-2">
            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
          </div>
          
          <button
            onClick={() => socket.emit('unreadyPlacement', { roomId: roomState.id })}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl shadow-sm transition-colors active:scale-95"
          >
            Edit Board
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in pb-12">
      <div className="glass-panel rounded-2xl shadow-xl border border-slate-700/60 p-5 sm:p-6 overflow-hidden transition-all">
        
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-100 font-display mb-0.5">Setup Phase</h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Click columns to place your blocks. The numbers with higher probability will be rolled more frequently!
            </p>
          </div>
        </div>

        {/* COMPACT LAYOUT: Side-by-side */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Sidebar: Controls & Pool & Player Status */}
          <div className="w-full lg:w-1/3 flex flex-col gap-6">

            {/* Player Readiness Status */}
            <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Player Status</h3>
              <div className="space-y-2">
                {Object.entries(roomState.players).map(([id, p]) => (
                  <div key={id} className="flex justify-between items-center text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-200">{p.name}</span>
                      {p.isAI && <span className="text-[10px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded">AI</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {p.ready ? (
                        <span className="text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded text-xs">Ready</span>
                      ) : (
                        <span className="text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded text-xs">Placing...</span>
                      )}
                      {roomState.host === socket.id && id !== socket.id && (
                        <button
                          onClick={() => socket.emit('kickPlayer', { roomId: roomState.id, targetId: id })}
                          className="text-slate-400 hover:text-red-400 transition-colors px-1"
                          title="Kick Player"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between bg-indigo-950/40 px-5 py-3.5 rounded-xl border border-indigo-800/40 transition-colors">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Blocks Remaining</div>
              <div className="text-3xl font-black text-indigo-400 font-mono leading-none">{remaining}</div>
            </div>

            {/* Piece Pool */}
            <div className="bg-slate-900/60 rounded-xl p-5 border-2 border-dashed border-slate-800 min-h-[140px] transition-colors flex-1 flex flex-col">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Block Pool</h3>
              <div className="flex flex-wrap gap-2 flex-1 items-start content-start">
                {Array.from({ length: remaining }).map((_, i) => (
                  <div
                    key={`pool-${i}`}
                    className="w-8 h-8 bg-gradient-to-b from-indigo-500 to-indigo-700 rounded-lg shadow-sm border border-indigo-400/30 transition-transform"
                  />
                ))}
                {remaining === 0 && (
                  <div className="w-full text-center text-emerald-400 font-semibold py-4 text-xs">
                    ✓ All blocks placed! Ready to lock in.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={randomizePlacement}
                  className="text-xs font-bold text-slate-300 hover:text-white bg-slate-900/70 hover:bg-slate-800 border border-slate-700/80 px-3 py-2 rounded-xl transition-colors"
                >
                  🎲 Randomize
                </button>
                
                <button
                  onClick={() => setShowHeatmap(!showHeatmap)}
                  className={`text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                    showHeatmap 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                      : 'bg-slate-900/70 hover:bg-slate-800 text-slate-300 border-slate-700/80'
                  }`}
                >
                  {showHeatmap ? '🔥 Heatmap On' : '📊 Heatmap'}
                </button>
              </div>
              
              <button
                onClick={submitPlacement}
                disabled={remaining !== 0}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-950/40 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none text-sm tracking-wide"
              >
                Lock In Placement
              </button>
            </div>

          </div>

          {/* Right Main Area: Board */}
          <div className="w-full lg:w-2/3">
            <div className="flex bg-slate-900/60 p-5 rounded-2xl border border-slate-800 overflow-x-auto custom-scrollbar-x gap-2.5 h-full min-h-[320px] shadow-inner transition-colors">
              {Array.from({ length: maxSum - minSum + 1 }, (_, i) => i + minSum).map(num => {
                const prob = pmf.find(p => p.sum === num)?.probability || 0;
                const intensity = maxProb > 0 ? Math.max(0, prob / maxProb) : 0;
                // Yellow/Orange for low, Green for high
                const heatmapStyle = showHeatmap ? { backgroundColor: `rgba(34, 197, 94, ${intensity * 0.4 + 0.05})` } : {};
                
                return (
                <div 
                  key={num} 
                  onClick={() => handleColumnClick(num)}
                  className={`flex-1 min-w-[36px] flex flex-col items-center justify-end relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-t-xl transition-colors ${remaining > 0 ? 'cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-700 hover:border-blue-300 dark:hover:border-blue-500' : ''}`}
                >
                  {showHeatmap && <div className="absolute inset-0 rounded-t-xl pointer-events-none transition-colors" style={heatmapStyle}></div>}
                  <div className="absolute top-0 w-full py-1 text-center opacity-50 z-10">
                    <span className="text-sm font-black text-slate-400 dark:text-slate-500">{num}</span>
                    {showHeatmap && (
                      <div className="text-[9px] font-bold text-green-600 dark:text-green-400 -mt-1">{(prob * 100).toFixed(1)}%</div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 pb-1 pt-12 items-center w-full min-h-[200px] z-10">
                    {Array.from({ length: placement[num] }).map((_, i) => (
                      <div 
                        key={`board-${num}-${i}`}
                        onClick={(e) => handlePieceClick(num, e)}
                        className="w-full max-w-[40px] h-4 bg-blue-500 dark:bg-blue-600 rounded-sm shadow-sm border-b-2 border-blue-700 dark:border-blue-800 cursor-pointer active:scale-95 hover:bg-red-400 dark:hover:bg-red-500 transition-colors"
                        title="Click to remove"
                      />
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
