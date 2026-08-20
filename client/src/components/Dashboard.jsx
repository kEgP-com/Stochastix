import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { calculatePMF } from '../lib/probability';
export default function Dashboard({ socket, currentUser }) {
  const [history, setHistory] = useState([]);
  const username = currentUser?.username;
  const [activeTab, setActiveTab] = useState('overview'); // overview, history, theory, tiebreaker
  const [historyFilter, setHistoryFilter] = useState('all'); // all, win, loss
  const [theoryDiceCount, setTheoryDiceCount] = useState(2);
  const [theoryDiceSides, setTheoryDiceSides] = useState(6);

  const [tiebreakerFilter, setTiebreakerFilter] = useState('all'); // all, coin, roll

  useEffect(() => {
    socket.emit('getHistory');
    
    socket.on('historyData', (data) => {
      setHistory(data);
    });

    return () => {
      socket.off('historyData');
    };
  }, [socket]);

  const availableConfigs = useMemo(() => {
    const configs = new Set();
    history.forEach(g => {
      const dCount = g.settings?.diceCount || 2;
      const dSides = g.settings?.diceSides || 6;
      configs.add(`${dCount}d${dSides}`);
    });
    return Array.from(configs).sort();
  }, [history]);

  const [chartConfig, setChartConfig] = useState('2d6');

  useEffect(() => {
    if (availableConfigs.length > 0 && !availableConfigs.includes(chartConfig)) {
      setChartConfig(availableConfigs.includes('2d6') ? '2d6' : availableConfigs[0]);
    }
  }, [availableConfigs, chartConfig]);

  // Dynamic chart data
  const chartData = useMemo(() => {
    if (!chartConfig) return [];
    
    const [c, s] = chartConfig.split('d').map(Number);
    const diceCount = c || 2;
    const diceSides = s || 6;

    const filteredGames = history.filter(g => {
      const gC = g.settings?.diceCount || 2;
      const gS = g.settings?.diceSides || 6;
      return gC === diceCount && gS === diceSides;
    });

    if (filteredGames.length === 0) return [];

    let totalRolls = 0;
    const frequencies = {};
    for (let i = diceCount; i <= diceCount * diceSides; i++) frequencies[i] = 0;
    
    filteredGames.forEach(g => {
      g.rolls.forEach(r => {
        if (frequencies[r] !== undefined) {
          frequencies[r]++;
          totalRolls++;
        }
      });
    });

    const displayBase = Math.max(totalRolls, 10);
    const pmf = calculatePMF(diceCount, diceSides);
    return pmf.map(p => ({
      sum: p.sum,
      expected: parseFloat((p.probability * displayBase).toFixed(1)),
      actual: frequencies[p.sum] || 0
    }));
  }, [history, chartConfig]);

  // Tiebreaker analytics
  const tiebreakerStats = useMemo(() => {
    let coinGames = 0;
    let rpsGames = 0;
    
    // Coin stats
    let landedHeads = 0;
    let landedTails = 0;
    let choseHeads = 0;
    let choseTails = 0;
    
    // RPS stats
    let rockCount = 0;
    let paperCount = 0;
    let scissorsCount = 0;
    
    history.forEach(g => {
      if (g.tiebreaker) {
        if (!g.settings.tiebreakerMode || g.settings.tiebreakerMode === 'coin') {
          coinGames++;
          g.tiebreaker.flips.forEach(round => {
            Object.values(round).forEach(result => {
              if (typeof result === 'string') {
                if (result.includes(':')) {
                  const [choice, landed] = result.split(':');
                  if (choice === 'H') choseHeads++;
                  if (choice === 'T') choseTails++;
                  if (landed === 'H') landedHeads++;
                  if (landed === 'T') landedTails++;
                } else {
                  // Legacy fallback
                  if (result === 'H') landedHeads++;
                  if (result === 'T') landedTails++;
                }
              }
            });
          });
        } else if (g.settings.tiebreakerMode === 'rps') {
          rpsGames++;
          g.tiebreaker.flips.forEach(round => {
            Object.values(round).forEach(result => {
              if (result === 'rock') rockCount++;
              if (result === 'paper') paperCount++;
              if (result === 'scissors') scissorsCount++;
            });
          });
        }
      }
    });

    return { 
      coinGames, rpsGames, 
      landedHeads, landedTails, choseHeads, choseTails,
      rockCount, paperCount, scissorsCount,
      total: coinGames + rpsGames 
    };
  }, [history]);

  // Theoretical Table Data
  const theoryData = useMemo(() => {
    const pmf = calculatePMF(theoryDiceCount, theoryDiceSides);
    // Sort by most likely (highest probability first)
    return [...pmf].sort((a, b) => b.probability - a.probability);
  }, [theoryDiceCount, theoryDiceSides]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history;
    return history.filter(g => {
      const isWin = g.winner === currentUser?.username;
      return historyFilter === 'win' ? isWin : !isWin;
    });
  }, [history, historyFilter, currentUser?.username]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'history', label: 'Match History' },
    { id: 'career', label: 'Career Stats' },
    { id: 'theory', label: 'Theory & Probabilities' },
    { id: 'tiebreaker', label: 'Tiebreaker Stats' },
  ];

  const careerStats = useMemo(() => {
    if (history.length === 0) return null;
    
    // Average Rolls per game
    const totalRolls = history.reduce((sum, g) => sum + g.totalRolls, 0);
    const avgRolls = Math.round(totalRolls / history.length);
    
    // Win Rate by Dice Config
    const configStats = {};
    const rivalStats = {};

    history.forEach(g => {
      const isWin = g.winner === currentUser?.username;
      
      const config = `${g.settings.diceCount}d${g.settings.diceSides}`;
      if (!configStats[config]) configStats[config] = { played: 0, wins: 0 };
      configStats[config].played++;
      if (isWin) configStats[config].wins++;

      g.players.forEach(p => {
        if (p.name !== currentUser?.username && !p.isAI) {
          if (!rivalStats[p.name]) rivalStats[p.name] = { played: 0, winsOverThem: 0, lossesToThem: 0 };
          rivalStats[p.name].played++;
          if (isWin) rivalStats[p.name].winsOverThem++;
          else if (g.winner === p.name) rivalStats[p.name].lossesToThem++;
        }
      });
    });

    let nemesis = null;
    let nemesisLosses = 0;
    let punchingBag = null;
    let punchingBagWins = 0;
    
    Object.keys(rivalStats).forEach(rival => {
      if (rivalStats[rival].lossesToThem > nemesisLosses) {
        nemesisLosses = rivalStats[rival].lossesToThem;
        nemesis = rival;
      }
      if (rivalStats[rival].winsOverThem > punchingBagWins) {
        punchingBagWins = rivalStats[rival].winsOverThem;
        punchingBag = rival;
      }
    });

    return {
      avgRolls,
      configStats,
      rivalStats,
      nemesis: nemesisLosses > 0 ? { name: nemesis, count: nemesisLosses } : null,
      punchingBag: punchingBagWins > 0 ? { name: punchingBag, count: punchingBagWins } : null
    };
  }, [history, currentUser]);

  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newUsername, setNewUsername] = useState(currentUser?.username || '');

  useEffect(() => {
    if (showProfileSettings && currentUser) {
      setNewUsername(currentUser.username);
    }
  }, [showProfileSettings, currentUser]);

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    if (newPassword.trim()) {
      socket.emit('updatePassword', { username: currentUser.username, oldPassword: '', newPassword });
    }
    if (newUsername.trim() && newUsername !== currentUser.username) {
      socket.emit('updateProfile', { oldUsername: currentUser.username, newUsername: newUsername.trim() });
      const currentLocal = JSON.parse(localStorage.getItem('currentUser') || '{}');
      currentLocal.username = newUsername.trim();
      localStorage.setItem('currentUser', JSON.stringify(currentLocal));
      
      // Update global user object (if a react context/prop trick is needed, App.jsx handles authSuccess)
      // We will rely on the server to emit an update or just trust localstorage for next reload
    }
    setShowProfileSettings(false);
    setNewPassword('');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 animate-fade-in transition-colors">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Analytics Dashboard</h2>
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg font-bold border border-blue-200 dark:border-blue-800 shadow-sm">
            {history.length} Games Played
          </div>
          <button 
            onClick={() => setShowProfileSettings(true)}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-colors"
          >
            Profile Settings
          </button>
        </div>
      </div>

      {/* Profile Settings Modal */}
      {showProfileSettings && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">Profile Settings</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter new username"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 dark:text-slate-400 mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowProfileSettings(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto custom-scrollbar gap-2 mb-8 border-b border-slate-200 dark:border-slate-700 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-bold whitespace-nowrap transition-colors ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 h-full transition-colors flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Theoretical vs. Actual Rolls</h3>
                {availableConfigs.length > 0 && (
                  <select 
                    value={chartConfig} 
                    onChange={(e) => setChartConfig(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-3 py-1.5 outline-none font-semibold cursor-pointer"
                  >
                    {availableConfigs.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>
              {chartData.length > 0 ? (
                <div className="flex-1 min-h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <XAxis dataKey="sum" stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                      <YAxis stroke="currentColor" className="text-slate-500 dark:text-slate-400" />
                      <Tooltip cursor={{fill: 'rgba(148, 163, 184, 0.1)'}} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                      <Bar dataKey="expected" fill="#94a3b8" name="Expected Count" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="actual" fill="#3b82f6" name="Actual Rolls" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex-1 min-h-[320px] flex items-center justify-center text-slate-400 dark:text-slate-500">
                  No 2d6 games played yet.
                </div>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 transition-colors">
             <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-6">Quick Stats</h3>
             <div className="space-y-4">
               <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                 <div className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Your Wins</div>
                 <div className="text-3xl font-black text-green-600 dark:text-green-400">
                    {history.filter(g => g.winner === currentUser?.username).length}
                 </div>
               </div>
               <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                 <div className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Win Rate</div>
                 <div className="text-3xl font-black text-indigo-500 dark:text-indigo-400">
                    {history.length > 0 ? Math.round((history.filter(g => g.winner === currentUser?.username).length / history.length) * 100) : 0}%
                 </div>
               </div>
               <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                 <div className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Total Rolls Recorded</div>
                 <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                    {history.reduce((sum, g) => sum + g.totalRolls, 0)}
                 </div>
               </div>
               <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                 <div className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Tiebreakers Played</div>
                 <div className="text-3xl font-black text-amber-500 dark:text-amber-400">
                    {tiebreakerStats.total}
                 </div>
               </div>
             </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors flex flex-col max-h-[800px]">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100">Match History</h3>
            <div className="flex gap-2">
              <button onClick={() => setHistoryFilter('all')} className={`px-3 py-1 rounded-md text-sm font-bold transition-colors ${historyFilter === 'all' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>All</button>
              <button onClick={() => setHistoryFilter('win')} className={`px-3 py-1 rounded-md text-sm font-bold transition-colors ${historyFilter === 'win' ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Wins</button>
              <button onClick={() => setHistoryFilter('loss')} className={`px-3 py-1 rounded-md text-sm font-bold transition-colors ${historyFilter === 'loss' ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Losses</button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-4 custom-scrollbar">
            {filteredHistory.length === 0 ? (
              <div className="text-center p-8 text-slate-400 dark:text-slate-500 font-bold">No games match this filter.</div>
            ) : (
              <div className="space-y-4">
                {[...filteredHistory].reverse().map((game, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${game.winner === currentUser?.username ? 'bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/30' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'} transition-colors`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-mono mb-1">
                          {new Date(game.timestamp).toLocaleDateString()} {new Date(game.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 text-lg">
                          Winner: <span className={game.winner === currentUser?.username ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-indigo-400'}>{game.winner}</span> 👑
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">
                          {game.settings.diceCount}d{game.settings.diceSides}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 mt-3 flex justify-between">
                      <div><span className="font-semibold text-slate-700 dark:text-slate-300">Players:</span> {game.players.map(p => p.name).join(', ')}</div>
                      <div><span className="font-semibold text-slate-700 dark:text-slate-300">Rolls:</span> {game.totalRolls}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: CAREER */}
      {activeTab === 'career' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 transition-colors">
            <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100 mb-6">Player Profile</h3>
            {careerStats ? (
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Average Rolls Per Game</div>
                  <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{careerStats.avgRolls}</div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Win Rate by Configuration</h4>
                  <div className="space-y-3">
                    {Object.entries(careerStats.configStats).map(([config, stats]) => (
                      <div key={config} className="flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-600 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-3 py-1 rounded-full">{config}</span>
                        <div className="text-right">
                          <span className="font-black text-slate-800 dark:text-slate-200">{Math.round((stats.wins / stats.played) * 100)}%</span>
                          <span className="text-slate-500 dark:text-slate-400 ml-2">({stats.wins}/{stats.played})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500">No career stats available yet. Play some games!</div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 transition-colors">
            <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100 mb-6">Rivals & Nemeses</h3>
            {careerStats ? (
              <div className="space-y-6">
                {careerStats.nemesis && (
                  <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-2xl">😈</span>
                      <div className="text-sm font-bold text-red-500 dark:text-red-400 uppercase tracking-wider">Your Nemesis</div>
                    </div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200 ml-9">
                      <span className="text-red-600 dark:text-red-400 font-black">{careerStats.nemesis.name}</span> has beaten you {careerStats.nemesis.count} times.
                    </div>
                  </div>
                )}
                {careerStats.punchingBag && (
                  <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-2xl">🥊</span>
                      <div className="text-sm font-bold text-green-500 dark:text-green-400 uppercase tracking-wider">Your Punching Bag</div>
                    </div>
                    <div className="text-lg font-bold text-slate-800 dark:text-slate-200 ml-9">
                      You've beaten <span className="text-green-600 dark:text-green-400 font-black">{careerStats.punchingBag.name}</span> {careerStats.punchingBag.count} times.
                    </div>
                  </div>
                )}
                
                {Object.keys(careerStats.rivalStats).length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-700 pb-2 mt-4">Head-to-Head Records</h4>
                    <div className="space-y-3">
                      {Object.entries(careerStats.rivalStats).map(([name, stats]) => (
                        <div key={name} className="flex justify-between items-center text-sm">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{name}</span>
                          <span className="font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">
                            <span className="text-green-600 dark:text-green-400">{stats.winsOverThem}</span> - <span className="text-red-500 dark:text-red-400">{stats.lossesToThem}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {Object.keys(careerStats.rivalStats).length === 0 && (
                  <div className="text-slate-500">You haven't played against any human opponents yet.</div>
                )}
              </div>
            ) : (
              <div className="text-slate-500">Play some multiplayer games to meet your rivals!</div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: THEORY */}
      {activeTab === 'theory' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 transition-colors">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100">Most Likely Outcomes</h3>
              <div className="flex gap-2">
                <select value={theoryDiceCount} onChange={e => setTheoryDiceCount(Number(e.target.value))} className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-1 font-bold outline-none">
                  {[1,2,3].map(n => <option key={n} value={n}>{n} Dice</option>)}
                </select>
                <select value={theoryDiceSides} onChange={e => setTheoryDiceSides(Number(e.target.value))} className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-1 font-bold outline-none">
                  {[4,6,8].map(n => <option key={n} value={n}>d{n}</option>)}
                </select>
              </div>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-slate-700 max-h-[300px]">
              <table className="w-full text-left text-sm relative">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 sticky top-0 z-10 shadow-sm outline outline-1 outline-slate-200 dark:outline-slate-700">
                  <tr>
                    <th className="p-3 font-bold">Sum</th>
                    <th className="p-3 font-bold">Combinations</th>
                    <th className="p-3 font-bold text-right">Probability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {theoryData.map((row, i) => (
                    <tr key={row.sum} className={i < 3 ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                      <td className="p-3 font-black text-slate-800 dark:text-slate-200">
                        {row.sum} {i === 0 && '⭐'}
                      </td>
                      <td className="p-3 font-mono text-slate-500 dark:text-slate-400">{row.combinations}</td>
                      <td className="p-3 text-right font-bold text-blue-600 dark:text-blue-400">
                        {(row.probability * 100).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {theoryDiceCount === 2 && (
              <div className="mt-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto custom-scrollbar-x">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">Visualizing 2d{theoryDiceSides}</h4>
                <table className="w-full max-w-sm border-collapse text-center mx-auto text-sm">
                  <thead>
                    <tr>
                      <th className="p-2 font-bold text-slate-400">+</th>
                      {Array.from({length: theoryDiceSides}).map((_, i) => <th key={i} className="p-2 font-bold text-slate-500 bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600">{i+1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({length: theoryDiceSides}).map((_, r) => (
                      <tr key={r}>
                        <th className="p-2 font-bold text-slate-500 bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600">{r+1}</th>
                        {Array.from({length: theoryDiceSides}).map((_, c) => {
                          const sum = r + 1 + c + 1;
                          const isMostLikely = sum === theoryDiceSides + 1;
                          return (
                            <td key={c} className={`p-2 border border-slate-300 dark:border-slate-600 font-bold transition-colors ${isMostLikely ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                              {sum}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {theoryDiceCount === 3 && (
              <div className="mt-8 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto custom-scrollbar-x">
                <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">Visualizing 3d{theoryDiceSides} (Layered by Die 3)</h4>
                <div className="flex gap-6 min-w-max pb-4">
                  {Array.from({length: theoryDiceSides}).map((_, z) => (
                    <div key={z} className="flex flex-col items-center">
                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">If Die 3 = {z + 1}</div>
                      <table className="border-collapse text-center text-xs">
                        <thead>
                          <tr>
                            <th className="p-1.5 font-bold text-slate-400">+</th>
                            {Array.from({length: theoryDiceSides}).map((_, i) => <th key={i} className="p-1.5 font-bold text-slate-500 bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600">{i+1}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from({length: theoryDiceSides}).map((_, r) => (
                            <tr key={r}>
                              <th className="p-1.5 font-bold text-slate-500 bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600">{r+1}</th>
                              {Array.from({length: theoryDiceSides}).map((_, c) => {
                                const sum = r + 1 + c + 1 + z + 1;
                                const isMostLikely = theoryData[0] && sum === theoryData[0].sum;
                                return (
                                  <td key={c} className={`p-1.5 border border-slate-300 dark:border-slate-600 font-bold transition-colors ${isMostLikely ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                                    {sum}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 transition-colors">
              <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100 mb-4">Experimental vs. Theoretical</h3>
              {(() => {
                const totalCombos = Math.pow(theoryDiceSides, theoryDiceCount);
                const mostLikelyData = theoryData[0];
                return (
                  <div className="prose dark:prose-invert prose-slate prose-sm">
                    <p>
                      <strong>Theoretical Probability</strong> is what we <em>expect</em> to happen based on the math. For example, when rolling {theoryDiceCount}d{theoryDiceSides}, there are {totalCombos} total combinations. The sum {mostLikelyData?.sum} has the most combinations ({mostLikelyData?.combinations}), so its theoretical probability is roughly {(mostLikelyData?.probability * 100).toFixed(2)}%.
                    </p>
                    <p>
                      <strong>Experimental Probability</strong> is what <em>actually</em> happens during your game. If you roll the dice 10 times and get a {mostLikelyData?.sum} three times, your experimental probability is 30%.
                    </p>
                <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded-r-lg mt-4">
                  <h4 className="font-bold text-amber-800 dark:text-amber-400 m-0 mb-1">The Law of Large Numbers</h4>
                  <p className="m-0 text-amber-700 dark:text-amber-300">
                    In a single game (experimental), the results can be wild and unpredictable! However, as you play more games and roll more dice, your aggregate experimental results will slowly converge to match the theoretical curve exactly.
                  </p>
                </div>
              </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TIEBREAKER */}
      {activeTab === 'tiebreaker' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 transition-colors">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100">Tiebreaker Statistics</h3>
            <div className="flex gap-2">
              <button onClick={() => setTiebreakerFilter('all')} className={`px-3 py-1 rounded-md text-sm font-bold transition-colors ${tiebreakerFilter === 'all' ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>All</button>
              <button onClick={() => setTiebreakerFilter('coin')} className={`px-3 py-1 rounded-md text-sm font-bold transition-colors ${tiebreakerFilter === 'coin' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Coin Flip</button>
              <button onClick={() => setTiebreakerFilter('rps')} className={`px-3 py-1 rounded-md text-sm font-bold transition-colors ${tiebreakerFilter === 'rps' ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>Rock, Paper, Scissors</button>
            </div>
          </div>
          
          {(tiebreakerFilter === 'all') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-5xl mb-2">⚔️</div>
                <div className="text-3xl font-black text-slate-800 dark:text-white mb-1">{tiebreakerStats.total}</div>
                <div className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Tiebreakers</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-100 dark:border-amber-900/30 text-center">
                <div className="text-5xl mb-2">🪙</div>
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mb-1">{tiebreakerStats.coinGames}</div>
                <div className="text-sm font-bold text-amber-700/50 dark:text-amber-500/50 uppercase tracking-widest">Coin Flip Matches</div>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-900/30 text-center">
                <div className="text-5xl mb-2">✊</div>
                <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mb-1">{tiebreakerStats.rpsGames}</div>
                <div className="text-sm font-bold text-indigo-700/50 dark:text-indigo-500/50 uppercase tracking-widest">RPS Matches</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {(tiebreakerFilter === 'all' || tiebreakerFilter === 'coin') && (
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-6">Coin Flip Distribution</h4>
                {tiebreakerStats.coinGames === 0 ? (
                  <div className="text-slate-400 font-bold p-4">No Coin Flip matches recorded.</div>
                ) : (
                  <div className="flex justify-center items-end gap-8">
                    <div className="flex flex-col items-center">
                      <div className="w-16 bg-amber-400 rounded-t-lg transition-all" style={{ height: `${Math.max((tiebreakerStats.landedHeads / (tiebreakerStats.landedHeads + tiebreakerStats.landedTails || 1)) * 150, 4)}px` }}></div>
                      <div className="mt-4 font-black text-2xl text-slate-700 dark:text-slate-300">{tiebreakerStats.landedHeads}</div>
                      <div className="text-sm font-bold text-slate-400">Heads</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-16 bg-slate-400 rounded-t-lg transition-all" style={{ height: `${Math.max((tiebreakerStats.landedTails / (tiebreakerStats.landedHeads + tiebreakerStats.landedTails || 1)) * 150, 4)}px` }}></div>
                      <div className="mt-4 font-black text-2xl text-slate-700 dark:text-slate-300">{tiebreakerStats.landedTails}</div>
                      <div className="text-sm font-bold text-slate-400">Tails</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(tiebreakerFilter === 'all' || tiebreakerFilter === 'rps') && (
              <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-6">Rock, Paper, Scissors Usage</h4>
                {tiebreakerStats.rpsGames === 0 ? (
                  <div className="text-slate-400 font-bold p-4">No RPS matches recorded.</div>
                ) : (
                  <div className="flex justify-center items-end gap-6">
                    <div className="flex flex-col items-center">
                      <div className="w-12 bg-rose-400 rounded-t-lg transition-all" style={{ height: `${Math.max((tiebreakerStats.rockCount / (tiebreakerStats.rockCount + tiebreakerStats.paperCount + tiebreakerStats.scissorsCount || 1)) * 150, 4)}px` }}></div>
                      <div className="mt-2 font-black text-xl text-slate-700 dark:text-slate-300">{tiebreakerStats.rockCount}</div>
                      <div className="text-xs font-bold text-slate-400">✊ Rock</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-12 bg-sky-400 rounded-t-lg transition-all" style={{ height: `${Math.max((tiebreakerStats.paperCount / (tiebreakerStats.rockCount + tiebreakerStats.paperCount + tiebreakerStats.scissorsCount || 1)) * 150, 4)}px` }}></div>
                      <div className="mt-2 font-black text-xl text-slate-700 dark:text-slate-300">{tiebreakerStats.paperCount}</div>
                      <div className="text-xs font-bold text-slate-400">✋ Paper</div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="w-12 bg-emerald-400 rounded-t-lg transition-all" style={{ height: `${Math.max((tiebreakerStats.scissorsCount / (tiebreakerStats.rockCount + tiebreakerStats.paperCount + tiebreakerStats.scissorsCount || 1)) * 150, 4)}px` }}></div>
                      <div className="mt-2 font-black text-xl text-slate-700 dark:text-slate-300">{tiebreakerStats.scissorsCount}</div>
                      <div className="text-xs font-bold text-slate-400">✌️ Scissors</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
