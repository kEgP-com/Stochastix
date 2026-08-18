import React, { useState } from 'react';
import { getOptimalPlacement } from '../lib/probability';

export default function Setup({ roomState, socket }) {
  const settings = roomState.settings;
  const minSum = settings.diceCount;
  const maxSum = settings.diceCount * settings.diceSides;
  
  const me = roomState.players[socket.id];
  const [placement, setPlacement] = useState(() => {
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

  const useOptimal = () => {
    const optimal = getOptimalPlacement(settings.diceCount, settings.diceSides, settings.piecesPerPlayer);
    setPlacement(optimal);
  };

  if (me.ready) {
    return (
      <div className="text-center py-20 animate-fade-in text-slate-800 dark:text-slate-100 max-w-lg mx-auto">
        <h2 className="text-3xl font-bold mb-4">Waiting for other players...</h2>
        <p className="text-slate-500 dark:text-slate-400 text-lg mb-8">You have placed all your pieces.</p>
        
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm text-left mb-8">
          <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Player Status</h3>
          <div className="space-y-3">
            {Object.values(roomState.players).map(p => (
              <div key={p.id} className="flex justify-between items-center font-semibold">
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 dark:text-slate-200">{p.name}</span>
                  {p.isAI && <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">AI</span>}
                </div>
                {p.ready ? (
                  <span className="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded text-xs uppercase tracking-wider">Ready</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded text-xs uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Placing...
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-6 overflow-hidden transition-colors">
        
        <div className="flex justify-between items-center mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Setup Phase</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Drag pieces to corresponding columns.
            </p>
          </div>
        </div>

        {/* COMPACT LAYOUT: Side-by-side */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Sidebar: Controls & Pool & Player Status */}
          <div className="w-full lg:w-1/3 flex flex-col gap-6">

            {/* Player Readiness Status */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Player Status</h3>
              <div className="space-y-2">
                {Object.values(roomState.players).map(p => (
                  <div key={p.id} className="flex justify-between items-center text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 dark:text-slate-200">{p.name}</span>
                      {p.isAI && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">AI</span>}
                    </div>
                    {p.ready ? (
                      <span className="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded text-xs uppercase tracking-wider">Ready</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded text-xs uppercase tracking-wider">Placing...</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-6 py-4 rounded-xl border border-blue-100 dark:border-blue-800 transition-colors">
              <div className="text-sm font-bold text-blue-800/60 dark:text-blue-400/80 uppercase tracking-widest">Pieces Left</div>
              <div className="text-4xl font-black text-blue-600 dark:text-blue-400 leading-none">{remaining}</div>
            </div>

            {/* Piece Pool */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 min-h-[160px] transition-colors flex-1 flex flex-col">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Piece Pool</h3>
              <div className="flex flex-wrap gap-2 flex-1 items-start content-start">
                {Array.from({ length: remaining }).map((_, i) => (
                  <div
                    key={`pool-${i}`}
                    className="w-10 h-10 bg-blue-500 dark:bg-blue-600 rounded-lg shadow-md border-b-4 border-blue-700 dark:border-blue-800 transition-transform"
                  />
                ))}
                {remaining === 0 && (
                  <div className="w-full text-center text-slate-400 dark:text-slate-500 font-medium py-4">
                    All pieces placed! Ready to go.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={useOptimal}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-semibold px-4 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
              >
                Use AI Optimal Placement
              </button>
              
              <button
                onClick={submitPlacement}
                disabled={remaining !== 0}
                className="w-full bg-green-600 dark:bg-green-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-green-700 dark:hover:bg-green-600 active:scale-95 transition shadow-lg shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                Ready to Play
              </button>
            </div>

          </div>

          {/* Right Main Area: Board */}
          <div className="w-full lg:w-2/3">
            <div className="flex bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto custom-scrollbar-x gap-3 h-full min-h-[300px] shadow-inner transition-colors hover:border-blue-200 dark:hover:border-blue-800">
              {Array.from({ length: maxSum - minSum + 1 }, (_, i) => i + minSum).map(num => (
                <div 
                  key={num} 
                  onClick={() => handleColumnClick(num)}
                  className={`flex-1 min-w-[50px] flex flex-col items-center justify-end relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-t-xl transition-colors ${remaining > 0 ? 'cursor-pointer hover:bg-blue-50/50 dark:hover:bg-slate-700 hover:border-blue-300 dark:hover:border-blue-500' : ''}`}
                >
                  <div className="absolute top-0 w-full py-2 bg-slate-100 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600 text-center rounded-t-xl transition-colors">
                    <span className="text-base font-bold text-slate-600 dark:text-slate-300">{num}</span>
                  </div>
                  <div className="flex flex-col gap-1 pb-2 pt-12 items-center w-full min-h-[200px]">
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
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
