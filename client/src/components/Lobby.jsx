import React, { useState } from 'react';
import { 
  Users, 
  Bot, 
  Crown, 
  Copy, 
  Check, 
  Settings2, 
  Play, 
  LogOut, 
  Plus, 
  Minus, 
  Coins, 
  Scissors,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function Lobby({ roomState, socket, onLeave }) {
  const isHost = roomState.host === socket.id;
  const [copied, setCopied] = useState(false);
  const [showMobileSettings, setShowMobileSettings] = useState(false);

  const handleCopyCode = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(roomState.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSettingsChange = (setting, value) => {
    let val = value;
    if (['maxPlayers', 'diceCount', 'diceSides', 'piecesPerPlayer'].includes(setting)) {
      val = parseInt(value, 10);
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

  const playersList = Object.entries(roomState.players);
  const myPlayer = roomState.players[socket.id];
  const allHumansReady = playersList.filter(([, p]) => !p.isAI).every(([, p]) => p.lobbyReady);
  const maxPlayersLimit = roomState.settings.maxPlayers || 8;
  const isRoomFull = playersList.length >= maxPlayersLimit;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Banner / Room Header */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-md dark:shadow-xl relative overflow-hidden transition-all border border-slate-200 dark:border-slate-700/80">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/40 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {roomState.isSinglePlayer ? 'Solo Practice' : 'Multiplayer Lobby'}
              </span>
              {isHost && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shadow-sm">
                  <Crown className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  Host
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-display text-slate-900 dark:text-white">
              Match Lobby
            </h1>
          </div>

          {/* Room Code Badge */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopyCode}
              title="Click to copy Room Code"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 transition-all text-slate-900 dark:text-white group active:scale-95 shadow-sm"
            >
              <div className="text-left">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                  Room Code
                </div>
                <div className="text-base font-mono font-extrabold tracking-widest text-indigo-600 dark:text-indigo-300">
                  {roomState.id}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-indigo-600 text-white group-hover:bg-indigo-500 transition-all shadow-sm">
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              </div>
            </button>

            <button
              onClick={onLeave}
              className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-red-500/20 border-2 border-slate-200 dark:border-slate-700 hover:border-red-500/50 text-slate-500 dark:text-slate-400 hover:text-red-500 transition-all active:scale-95"
              title="Leave Room"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Players + Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Players Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-2xl p-5 shadow-md dark:shadow-lg border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="font-extrabold text-lg text-slate-900 dark:text-white font-display">Players</h2>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                  {playersList.length} / {maxPlayersLimit}
                </span>
              </div>

              {isHost && !roomState.isSinglePlayer && (
                <button
                  onClick={addAI}
                  disabled={isRoomFull}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400/40 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  <Bot className="w-3.5 h-3.5" />
                  + Add AI
                </button>
              )}
            </div>

            {/* Players List */}
            <div className="space-y-2.5">
              {playersList.map(([id, player]) => {
                const isMe = id === socket.id;
                const isPlayerHost = id === roomState.host;

                return (
                  <div
                    key={id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isMe 
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-500/50 shadow-sm' 
                        : 'bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-inner shrink-0 ${
                        player.isAI 
                          ? 'bg-violet-100 dark:bg-violet-900/80 text-violet-700 dark:text-violet-200 border border-violet-300 dark:border-violet-500/50'
                          : isPlayerHost
                            ? 'bg-amber-100 dark:bg-amber-900/80 text-amber-700 dark:text-amber-200 border border-amber-300 dark:border-amber-500/50'
                            : 'bg-indigo-100 dark:bg-indigo-900/80 text-indigo-700 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-500/50'
                      }`}>
                        {player.isAI ? <Bot className="w-4 h-4" /> : (player.name?.[0]?.toUpperCase() || 'P')}
                      </div>

                      {/* Name & Badges */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {player.name}
                          </span>
                          {isPlayerHost && (
                            <span title="Room Host">
                              <Crown className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {isMe && <span className="text-indigo-600 dark:text-indigo-300 font-bold">You</span>}
                          {player.isAI && <span className="text-violet-600 dark:text-violet-300 font-bold">Computer AI</span>}
                          {!player.isAI && !isMe && <span>Player</span>}
                        </div>
                      </div>
                    </div>

                    {/* Status badge & Kick action */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!player.isAI ? (
                        player.lobbyReady ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/60 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-slate-900 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            Waiting
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/40">
                          Ready
                        </span>
                      )}

                      {/* Kick button */}
                      {isHost && id !== socket.id && (
                        <button
                          onClick={() => socket.emit('kickPlayer', { roomId: roomState.id, targetId: id })}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Kick player"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick helper note */}
            {!roomState.isSinglePlayer && (
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-4 text-center">
                Invite friends with room code <span className="font-mono text-indigo-600 dark:text-indigo-300 font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">{roomState.id}</span>
              </p>
            )}
          </div>
        </div>

        {/* RIGHT: Game Settings Column (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel rounded-2xl p-5 sm:p-6 shadow-md dark:shadow-lg border border-slate-200 dark:border-slate-700/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="font-extrabold text-lg text-slate-900 dark:text-white font-display">Game Settings</h2>
              </div>
              <div className="flex items-center gap-2">
                {!isHost && (
                  <span className="hidden sm:inline-block text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    Host controls settings
                  </span>
                )}

                {/* Mobile-only Hide/Show toggle button */}
                <button
                  type="button"
                  onClick={() => setShowMobileSettings(!showMobileSettings)}
                  className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-500/40 transition-all active:scale-95 shadow-sm"
                  aria-expanded={showMobileSettings}
                >
                  <span>{showMobileSettings ? 'Hide Settings' : 'Show Settings'}</span>
                  {showMobileSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Collapsed Mobile Quick Preview Summary */}
            {!showMobileSettings && (
              <div className="lg:hidden flex flex-wrap items-center gap-1.5 pt-0.5 pb-1 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  🎲 d{roomState.settings.diceSides} ({roomState.settings.diceCount} {roomState.settings.diceCount === 1 ? 'die' : 'dice'})
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                  🧱 {roomState.settings.piecesPerPlayer} blocks
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold capitalize">
                  ⚡ {roomState.settings.tiebreakerMode === 'rps' ? 'RPS' : 'Coin Flip'}
                </span>
              </div>
            )}

            {/* Collapsible settings container (Mobile toggled, always visible on Desktop lg) */}
            <div className={`${showMobileSettings ? 'block' : 'hidden'} lg:block space-y-5 animate-fade-in`}>

            {/* Setting 1: Dice Sides (Type) */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Dice Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { sides: 4, label: 'd4 (Tetra)', desc: 'Sums 2-8' },
                  { sides: 6, label: 'd6 (Classic)', desc: 'Sums 2-12' },
                  { sides: 8, label: 'd8 (Octa)', desc: 'Sums 2-16' },
                ].map(({ sides, label, desc }) => {
                  const active = roomState.settings.diceSides === sides;
                  return (
                    <button
                      key={sides}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSettingsChange('diceSides', sides)}
                      className={`p-3 rounded-xl text-left border-2 transition-all ${
                        active 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/40' 
                          : 'bg-slate-50 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200'
                      } ${!isHost ? 'cursor-not-allowed opacity-80' : 'cursor-pointer active:scale-98'}`}
                    >
                      <div className={`font-bold text-sm flex items-center justify-between ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {label}
                        {active && <span className="w-2 h-2 rounded-full bg-white"></span>}
                      </div>
                      <div className={`text-xs mt-0.5 font-medium ${active ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        {desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Setting 2: Number of Dice */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Dice Count
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(n => {
                  const active = roomState.settings.diceCount === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSettingsChange('diceCount', n)}
                      className={`py-2.5 px-3 rounded-xl font-bold text-sm border-2 text-center transition-all ${
                        active 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md ring-2 ring-indigo-400/40' 
                          : 'bg-slate-50 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                      } ${!isHost ? 'cursor-not-allowed opacity-80' : 'cursor-pointer active:scale-98'}`}
                    >
                      {n} {n === 1 ? 'Die' : 'Dice'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Setting 3: Tiebreaker Mode */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Tiebreaker Mode (Sudden Death)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { mode: 'coin', title: 'Coin Flip', desc: 'Best of 3 Heads / Tails', icon: Coins },
                  { mode: 'rps', title: 'Rock, Paper, Scissors', desc: 'Classic Best-of-3 duel', icon: Scissors },
                ].map(({ mode, title, desc, icon: IconComponent }) => {
                  const active = (roomState.settings.tiebreakerMode || 'coin') === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSettingsChange('tiebreakerMode', mode)}
                      className={`p-3.5 rounded-xl text-left border-2 flex items-center gap-3 transition-all ${
                        active 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md ring-2 ring-indigo-400/40' 
                          : 'bg-slate-50 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200'
                      } ${!isHost ? 'cursor-not-allowed opacity-80' : 'cursor-pointer active:scale-98'}`}
                    >
                      <div className={`p-2.5 rounded-xl ${active ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className={`font-bold text-sm ${active ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{title}</div>
                        <div className={`text-xs font-medium ${active ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                          {desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Setting 4: Pieces per Player + Max Rolls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pieces per Player */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Blocks per Player
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!isHost || (roomState.settings.piecesPerPlayer || 12) <= 1}
                    onClick={() => handleSettingsChange('piecesPerPlayer', Math.max(1, (roomState.settings.piecesPerPlayer || 12) - 1))}
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white disabled:opacity-40 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    disabled={!isHost}
                    value={roomState.settings.piecesPerPlayer || 12}
                    onChange={(e) => handleSettingsChange('piecesPerPlayer', Math.min(200, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="w-full text-center py-2 px-2 bg-white dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-extrabold font-mono focus:border-indigo-500 outline-none text-base"
                    min="1"
                    max="200"
                  />
                  <button
                    type="button"
                    disabled={!isHost || (roomState.settings.piecesPerPlayer || 12) >= 200}
                    onClick={() => handleSettingsChange('piecesPerPlayer', Math.min(200, (roomState.settings.piecesPerPlayer || 12) + 1))}
                    className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white disabled:opacity-40 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Max Rolls */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Max Rolls Limit
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['Unlimited', '30', '50', '100'].map((opt) => {
                    const active = String(roomState.settings.maxRolls || 'Unlimited') === String(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        disabled={!isHost}
                        onClick={() => handleSettingsChange('maxRolls', opt)}
                        className={`py-2 rounded-xl text-xs font-bold border-2 transition-all text-center ${
                          active 
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                            : 'bg-slate-50 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200'
                        } ${!isHost ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                      >
                        {opt === 'Unlimited' ? '∞' : opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Setting 5: AI Placement Difficulty */}
            <div>
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                AI Strategy (Placement)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Random', 'Mixed', 'Optimal'].map((diff) => {
                  const active = (roomState.settings.aiDifficulty || 'Mixed') === diff;
                  return (
                    <button
                      key={diff}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleSettingsChange('aiDifficulty', diff)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border-2 text-center transition-all ${
                        active 
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md ring-2 ring-indigo-400/40' 
                          : 'bg-slate-50 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200'
                      } ${!isHost ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                    >
                      {diff}
                    </button>
                  );
                })}
              </div>
            </div>

            </div> {/* Closes collapsible settings container */}
          </div>
        </div>

      </div>

      {/* BOTTOM ACTION BAR - Sticky for easy access */}
      <div className="sticky bottom-3 z-30 glass-panel bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-2xl border-2 border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center sm:text-left">
          {allHumansReady ? (
            <span className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2 justify-center sm:justify-start">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>All players ready! Host can start the match.</span>
            </span>
          ) : (
            <span className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0"></span>
              <span>Waiting for all human players to click <strong>Ready Up</strong>.</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Ready Button */}
          <button
            onClick={() => socket.emit('toggleLobbyReady', { roomId: roomState.id })}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-3.5 px-7 rounded-xl font-black text-sm tracking-wide transition-all shadow-xl active:scale-95 cursor-pointer ${
              myPlayer?.lobbyReady
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30 ring-2 ring-amber-400/60'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 ring-4 ring-emerald-400/40 animate-pulse'
            }`}
          >
            <Check className="w-5 h-5" />
            <span>{myPlayer?.lobbyReady ? 'Unready' : 'Ready Up'}</span>
          </button>

          {/* Start Game (Host only) */}
          {isHost && (
            <button
              onClick={startGame}
              disabled={!allHumansReady}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 py-3.5 px-8 rounded-xl font-black text-sm tracking-wide transition-all active:scale-95 shadow-xl ${
                allHumansReady
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-900/40 ring-4 ring-indigo-400/40 animate-pulse cursor-pointer'
                  : 'bg-slate-700 text-slate-400 border border-slate-600 opacity-60 cursor-not-allowed shadow-none'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Game</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
