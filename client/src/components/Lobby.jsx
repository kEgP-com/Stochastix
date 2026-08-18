import React from 'react';

export default function Lobby({ roomState, socket }) {
  const isHost = roomState.host === socket.id;

  const handleSettingsChange = (setting, value) => {
    let val = value;
    if (setting !== 'tiebreakerMode') {
      val = parseInt(value);
    }
    const newSettings = { [setting]: val };
    
    let currentDiceCount = roomState.settings.diceCount;
    let currentDiceSides = roomState.settings.diceSides;

    if (setting === 'diceCount') currentDiceCount = val;
    if (setting === 'diceSides') currentDiceSides = val;

    if (setting === 'diceCount' || setting === 'diceSides') {
       newSettings.piecesPerPlayer = currentDiceCount * currentDiceSides;
    }

    socket.emit('updateSettings', {
      roomId: roomState.id,
      settings: newSettings
    });
  };

  const addAI = () => {
    socket.emit('addAI', { roomId: roomState.id });
  };

  const startGame = () => {
    socket.emit('startGame', { roomId: roomState.id });
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 transition-colors animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-slate-100">
        {roomState.isSinglePlayer ? 'Single Player Setup' : 'Multiplayer Lobby'}
      </h2>
      
      <div className="grid grid-cols-2 gap-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-lg text-slate-700 dark:text-slate-300">
              Players <span className="text-sm font-bold bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-slate-500 dark:text-slate-400 ml-2">{Object.keys(roomState.players).length} / 8</span>
            </h3>
            {isHost && !roomState.isSinglePlayer && (
              <button 
                onClick={addAI} 
                disabled={Object.keys(roomState.players).length >= 8}
                className="text-sm bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1 rounded text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
              >
                + Add Computer
              </button>
            )}
          </div>
          <ul className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar pr-2">
            {Object.entries(roomState.players).map(([id, player]) => (
              <li key={id} className="flex items-center space-x-3 text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg border border-slate-100 dark:border-slate-700/50 transition-colors hover:border-slate-300 dark:hover:border-slate-600">
                <span className={`w-3 h-3 rounded-full shadow-sm ${id === roomState.host ? 'bg-amber-400' : 'bg-blue-400'}`}></span>
                <span className="font-medium">{player.name}</span>
                {id === socket.id && <span className="text-xs text-slate-500 dark:text-slate-400 font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded shadow-sm border border-slate-200 dark:border-slate-700">(You)</span>}
                {id === roomState.host && !roomState.isSinglePlayer && <span className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded shadow-sm border border-amber-200 dark:border-amber-800">👑 Game Master</span>}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-lg mb-4 text-slate-700 dark:text-slate-300">Game Settings</h3>
          <div className="space-y-4 max-h-[320px] overflow-y-auto custom-scrollbar pr-2">
            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Max Players</label>
              <select
                disabled={!isHost}
                value={roomState.settings.maxPlayers || 8}
                onChange={(e) => handleSettingsChange('maxPlayers', e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-2 disabled:bg-slate-50 disabled:dark:bg-slate-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-white transition-colors focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} Players</option>)}
              </select>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Tiebreaker Mode</label>
              <select
                disabled={!isHost}
                value={roomState.settings.tiebreakerMode || 'coin'}
                onChange={(e) => handleSettingsChange('tiebreakerMode', e.target.value)}
                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-colors dark:text-white"
              >
                <option value="coin">Best of 3 Coin Flip</option>
                <option value="rps">Rock, Paper, Scissors</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Number of Dice</label>
              <select
                disabled={!isHost}
                value={roomState.settings.diceCount}
                onChange={(e) => handleSettingsChange('diceCount', e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-2 disabled:bg-slate-50 disabled:dark:bg-slate-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-white transition-colors focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Dice Sides</label>
              <select
                disabled={!isHost}
                value={roomState.settings.diceSides}
                onChange={(e) => handleSettingsChange('diceSides', e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-2 disabled:bg-slate-50 disabled:dark:bg-slate-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-white transition-colors focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[4, 6, 8].map(n => <option key={n} value={n}>d{n}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Pieces per Player</label>
              <input
                type="number"
                disabled={!isHost}
                value={roomState.settings.piecesPerPlayer}
                onChange={(e) => handleSettingsChange('piecesPerPlayer', e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-2 disabled:bg-slate-50 disabled:dark:bg-slate-800 bg-white dark:bg-slate-700 text-slate-800 dark:text-white transition-colors focus:ring-2 focus:ring-blue-500 outline-none"
                min="1"
                max="200"
              />
            </div>
          </div>
        </div>
      </div>

      {isHost ? (
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={startGame}
            className="bg-green-600 dark:bg-green-500 text-white font-bold py-3 px-8 rounded-xl hover:bg-green-700 dark:hover:bg-green-600 transition shadow-md shadow-green-500/20 active:scale-95"
          >
            Start Game
          </button>
        </div>
      ) : (
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
          Waiting for the Game Master to start the game...
        </div>
      )}
    </div>
  );
}
