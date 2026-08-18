class Room {
  constructor(id) {
    this.id = id;
    this.players = {}; 
    this.state = 'LOBBY'; 
    this.isSinglePlayer = false;
    this.settings = {
      diceCount: 2,
      diceSides: 6,
      piecesPerPlayer: 12,
      maxPlayers: 8,
      tiebreakerMode: 'coin',
      maxRolls: 'Unlimited'
    };
    this.history = []; 
    this.host = null;
  }

  addPlayer(socketId, name, isAI = false) {
    if (this.state !== 'LOBBY') return false;
    if (Object.keys(this.players).length >= this.settings.maxPlayers) return false;
    
    if (Object.keys(this.players).length === 0) {
      this.host = socketId;
    }
    this.players[socketId] = {
      name,
      ready: false,
      pieces: {},
      totalPieces: this.settings.piecesPerPlayer,
      isAI
    };
    return true;
  }

  removePlayer(socketId) {
    delete this.players[socketId];
    if (this.host === socketId) {
      const remaining = Object.keys(this.players);
      if (remaining.length > 0) {
        // Prefer human host
        const human = remaining.find(id => !this.players[id].isAI);
        this.host = human || remaining[0];
      } else {
        this.host = null;
      }
    }
  }

  updateSettings(socketId, settings) {
    if (this.host !== socketId || this.state !== 'LOBBY') return false;
    this.settings = { ...this.settings, ...settings };
    for (const p in this.players) {
      this.players[p].totalPieces = this.settings.piecesPerPlayer;
    }
    return true;
  }

  _getAIPlacement() {
    const { diceCount, diceSides, piecesPerPlayer } = this.settings;
    let dp = new Array(diceSides + 1).fill(0);
    for (let i = 1; i <= diceSides; i++) dp[i] = 1;

    for (let n = 2; n <= diceCount; n++) {
      const nextDp = new Array(n * diceSides + 1).fill(0);
      for (let sum = 0; sum < dp.length; sum++) {
        if (dp[sum] > 0) {
          for (let roll = 1; roll <= diceSides; roll++) {
            nextDp[sum + roll] += dp[sum];
          }
        }
      }
      dp = nextDp;
    }

    const totalWays = Math.pow(diceSides, diceCount);
    
    const placement = {};
    for (let i = diceCount; i <= diceCount * diceSides; i++) placement[i] = 0;

    // Add noise so AI isn't playing perfectly
    const weights = [];
    for (let i = diceCount; i <= diceCount * diceSides; i++) {
        const trueProb = dp[i] / totalWays;
        // 60% smart math, 40% complete randomness
        const noisyWeight = (trueProb * 0.6) + (Math.random() * 0.4);
        weights.push({ sum: i, weight: noisyWeight });
    }

    for (let p = 0; p < piecesPerPlayer; p++) {
        const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
        let r = Math.random() * totalWeight;
        for (let i = 0; i < weights.length; i++) {
            r -= weights[i].weight;
            if (r <= 0 || i === weights.length - 1) {
                placement[weights[i].sum]++;
                break;
            }
        }
    }

    return placement;
  }

  startGame(socketId) {
    if (this.host !== socketId || this.state !== 'LOBBY') return false;
    this.state = 'SETUP';
    
    // Auto-setup AI players
    for (const p in this.players) {
      if (this.players[p].isAI) {
        this.players[p].pieces = this._getAIPlacement();
        this.players[p].ready = true;
      }
    }
    
    this._checkReady();
    return true;
  }

  setPlacement(socketId, placement) {
    if (this.state !== 'SETUP') return false;
    
    const totalPlaced = Object.values(placement).reduce((a, b) => a + b, 0);
    if (totalPlaced !== this.settings.piecesPerPlayer) return false;

    this.players[socketId].pieces = placement;
    this.players[socketId].ready = true;

    this._checkReady();
    return true;
  }

  _checkReady() {
    if (this.state !== 'SETUP') return;
    const allReady = Object.values(this.players).every(p => p.ready);
    if (allReady) {
      this.state = 'PLAYING';
    }
  }

  rollDice() {
    if (this.state !== 'PLAYING') return null;

    let sum = 0;
    const details = [];
    for (let i = 0; i < this.settings.diceCount; i++) {
      const r = Math.floor(Math.random() * this.settings.diceSides) + 1;
      sum += r;
      details.push(r);
    }
    
    this.history.push(sum);

    let winners = [];
    let someoneFinished = false;
    for (const [id, player] of Object.entries(this.players)) {
      if (player.pieces[sum] > 0) {
        player.pieces[sum] -= 1;
        player.totalPieces -= 1;
      }
      if (player.totalPieces === 0) {
        winners.push(id);
        someoneFinished = true;
      }
    }

    if (!someoneFinished && this.settings.maxRolls !== 'Unlimited') {
      const maxLimit = parseInt(this.settings.maxRolls, 10);
      if (!isNaN(maxLimit) && this.history.length >= maxLimit) {
        // Limit reached! Find player(s) with least pieces
        let lowestPieces = Infinity;
        for (const [id, player] of Object.entries(this.players)) {
          if (player.totalPieces < lowestPieces) {
            lowestPieces = player.totalPieces;
            winners = [id];
          } else if (player.totalPieces === lowestPieces) {
            winners.push(id);
          }
        }
      }
    }

    if (winners.length === 1) {
      this.state = 'GAMEOVER';
      this.finalWinner = winners[0];
    } else if (winners.length > 1) {
      this.state = 'TIEBREAKER';
      let scores = {};
      winners.forEach(w => scores[w] = 0);
      this.tiebreaker = {
        tiedPlayers: winners,
        scores,
        flips: [],
        currentFlips: {},
        round: 1
      };
    }

    return { sum, details, winners };
  }

  playTiebreaker(playerId, choice) {
    if (this.state !== 'TIEBREAKER') return null;

    const isObserver = !this.tiebreaker.tiedPlayers.includes(playerId);
    const humanTiedPlayers = this.tiebreaker.tiedPlayers.filter(id => !this.players[id].isAI);
    const mode = this.settings.tiebreakerMode || 'coin';

    if (isObserver) {
       if (humanTiedPlayers.length > 0) return null;
    } else {
       if (this.tiebreaker.currentFlips[playerId]) return null;
       
       if (mode === 'coin') {
           const coinLanded = Math.random() < 0.5 ? 'H' : 'T';
           const won = choice === coinLanded;
           this.tiebreaker.currentFlips[playerId] = `${choice}:${coinLanded}`;
           if (won) this.tiebreaker.scores[playerId]++;
       } else if (mode === 'rps') {
           this.tiebreaker.currentFlips[playerId] = choice;
       }
    }

    // Handle AI automatically
    const rpsOptions = ['rock', 'paper', 'scissors'];
    this.tiebreaker.tiedPlayers.forEach(id => {
        if (this.players[id].isAI && !this.tiebreaker.currentFlips[id]) {
            if (mode === 'coin') {
                const aiChoice = Math.random() < 0.5 ? 'H' : 'T';
                const coinLanded = Math.random() < 0.5 ? 'H' : 'T';
                const won = aiChoice === coinLanded;
                this.tiebreaker.currentFlips[id] = `${aiChoice}:${coinLanded}`;
                if (won) this.tiebreaker.scores[id]++;
            } else if (mode === 'rps') {
                this.tiebreaker.currentFlips[id] = rpsOptions[Math.floor(Math.random() * 3)];
            }
        }
    });

    // Check if round is complete
    if (Object.keys(this.tiebreaker.currentFlips).length === this.tiebreaker.tiedPlayers.length) {
        const lastRoundData = { ...this.tiebreaker.currentFlips };
        this.tiebreaker.flips.push(lastRoundData);

        let gameOver = false;
        
        if (mode === 'coin') {
            if (this.tiebreaker.round >= 3) {
                let maxScore = -1;
                let leaders = [];
                for (const p of this.tiebreaker.tiedPlayers) {
                    if (this.tiebreaker.scores[p] > maxScore) {
                        maxScore = this.tiebreaker.scores[p];
                        leaders = [p];
                    } else if (this.tiebreaker.scores[p] === maxScore) {
                        leaders.push(p);
                    }
                }
                if (leaders.length === 1) {
                    this.finalWinner = leaders[0];
                    gameOver = true;
                } else if (leaders.length > 0 && leaders.length < this.tiebreaker.tiedPlayers.length) {
                    this.tiebreaker.tiedPlayers = leaders; // narrow down
                }
            }
        } else if (mode === 'rps') {
            const choices = new Set();
            for (const p of this.tiebreaker.tiedPlayers) {
                choices.add(this.tiebreaker.currentFlips[p]);
            }
            if (choices.size === 2) {
                let winningChoice = '';
                if (choices.has('rock') && choices.has('scissors')) winningChoice = 'rock';
                else if (choices.has('scissors') && choices.has('paper')) winningChoice = 'scissors';
                else if (choices.has('paper') && choices.has('rock')) winningChoice = 'paper';
                
                for (const p of this.tiebreaker.tiedPlayers) {
                    if (this.tiebreaker.currentFlips[p] === winningChoice) {
                        this.tiebreaker.scores[p]++;
                    }
                }
            }
            if (this.tiebreaker.round >= 3) {
                let maxScore = -1;
                let leaders = [];
                for (const p of this.tiebreaker.tiedPlayers) {
                    if (this.tiebreaker.scores[p] > maxScore) {
                        maxScore = this.tiebreaker.scores[p];
                        leaders = [p];
                    } else if (this.tiebreaker.scores[p] === maxScore) {
                        leaders.push(p);
                    }
                }
                if (leaders.length === 1) {
                    this.finalWinner = leaders[0];
                    gameOver = true;
                } else if (leaders.length > 0 && leaders.length < this.tiebreaker.tiedPlayers.length) {
                    this.tiebreaker.tiedPlayers = leaders;
                }
            }
        } else if (mode === 'roll') {
            let maxRoll = -1;
            let leaders = [];
            for (const p of this.tiebreaker.tiedPlayers) {
                const r = this.tiebreaker.currentFlips[p];
                if (r > maxRoll) {
                    maxRoll = r;
                    leaders = [p];
                } else if (r === maxRoll) {
                    leaders.push(p);
                }
            }
            if (leaders.length === 1) {
                this.finalWinner = leaders[0];
                this.tiebreaker.scores[leaders[0]]++;
                gameOver = true;
            } else {
                this.tiebreaker.tiedPlayers = leaders;
            }
        }

        if (gameOver) {
            this.state = 'GAMEOVER';
        } else {
            this.tiebreaker.round++;
            this.tiebreaker.currentFlips = {}; // clear for next round
        }
        return { roundComplete: true, lastRoundData };
    }
    return { roundComplete: false };
  }

  setReadyToRoll(playerId, autoRoll = false) {
    if (this.state !== 'PLAYING') return null;
    if (!this.players[playerId]) return null;

    this.players[playerId].readyToRoll = true;
    
    // Auto-mark AI as ready
    for (const p in this.players) {
        if (this.players[p].isAI) {
            this.players[p].readyToRoll = true;
        }
    }

    const allReady = Object.values(this.players).every(p => p.readyToRoll);
    if (allReady) {
        const result = this.rollDice();
        // Reset ready state for humans
        for (const p in this.players) {
            if (!this.players[p].isAI) {
                this.players[p].readyToRoll = false;
            }
        }
        return { rolled: true, ...result };
    }
    return { rolled: false, players: this.players };
  }

  getState() {
    return {
      id: this.id,
      players: this.players,
      host: this.host,
      state: this.state,
      settings: this.settings,
      history: this.history,
      isSinglePlayer: this.isSinglePlayer,
      finalWinner: this.finalWinner,
      tiebreaker: this.tiebreaker
    };
  }
}

module.exports = Room;
