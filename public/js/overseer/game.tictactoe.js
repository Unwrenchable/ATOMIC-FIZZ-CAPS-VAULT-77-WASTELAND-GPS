/**
 * TIC-TAC-TOE - Terminal Mini-Game
 * Play against the Overseer AI in classic tic-tac-toe
 * 
 * Commands:
 * - ttt start: Start a new game
 * - ttt [1-9]: Place your mark (X) in position 1-9
 * - ttt quit: Quit current game
 */

(function () {
  "use strict";

  const TicTacToe = {
    active: false,
    board: null,
    playerSymbol: "X",
    aiSymbol: "O",
    currentTurn: "player", // "player" or "ai"
    gameOver: false,
    gamesPlayed: 0,
    playerWins: 0,
    aiWins: 0,
    draws: 0,

    // Win conditions (indices)
    winConditions: [
      [0, 1, 2], // Top row
      [3, 4, 5], // Middle row
      [6, 7, 8], // Bottom row
      [0, 3, 6], // Left column
      [1, 4, 7], // Middle column
      [2, 5, 8], // Right column
      [0, 4, 8], // Diagonal \
      [2, 4, 6]  // Diagonal /
    ],

    // Initialize new game
    start() {
      this.active = true;
      this.board = Array(9).fill(null);
      this.currentTurn = "player";
      this.gameOver = false;

      this.print(">>> TIC-TAC-TOE INITIATED <<<");
      this.print("YOU ARE [X] | OVERSEER IS [O]");
      this.print("");
      this.drawBoard();
      this.print("");
      this.print("ENTER YOUR MOVE (1-9):");
      this.print("  1 | 2 | 3");
      this.print("  4 | 5 | 6");
      this.print("  7 | 8 | 9");
      this.print("");
      this.print("TYPE: ttt [position] to place your X");
    },

    // Handle player move
    move(position) {
      if (!this.active) {
        this.print("NO GAME ACTIVE. TYPE 'ttt start' TO BEGIN.");
        return;
      }

      if (this.gameOver) {
        this.print("GAME IS OVER. TYPE 'ttt start' FOR NEW GAME.");
        return;
      }

      if (this.currentTurn !== "player") {
        this.print("WAIT FOR OVERSEER'S TURN...");
        return;
      }

      // Validate position
      const pos = parseInt(position, 10);
      if (isNaN(pos) || pos < 1 || pos > 9) {
        this.print("INVALID POSITION. USE 1-9.");
        return;
      }

      const index = pos - 1;
      if (this.board[index] !== null) {
        this.print("POSITION OCCUPIED. CHOOSE ANOTHER.");
        return;
      }

      // Make player move
      this.board[index] = this.playerSymbol;
      this.print("");
      this.print(`YOU PLACED X AT POSITION ${pos}`);
      this.print("");
      this.drawBoard();

      // Check win/draw
      if (this.checkWin(this.playerSymbol)) {
        this.endGame("player");
        return;
      }

      if (this.checkDraw()) {
        this.endGame("draw");
        return;
      }

      // AI turn
      this.currentTurn = "ai";
      this.print("");
      this.print("OVERSEER IS CALCULATING...");
      
      setTimeout(() => {
        this.aiMove();
      }, 800);
    },

    // AI makes a move
    aiMove() {
      if (this.gameOver) return;

      // Smart AI: Try to win, block player, or take strategic position
      let move = this.findBestMove();
      
      this.board[move] = this.aiSymbol;
      this.print("");
      this.print(`OVERSEER PLACED O AT POSITION ${move + 1}`);
      this.print("");
      this.drawBoard();

      // Check win/draw
      if (this.checkWin(this.aiSymbol)) {
        this.endGame("ai");
        return;
      }

      if (this.checkDraw()) {
        this.endGame("draw");
        return;
      }

      // Back to player
      this.currentTurn = "player";
      this.print("");
      this.print("YOUR TURN. ENTER POSITION (1-9):");
    },

    // Find best AI move
    findBestMove() {
      // 1. Try to win
      for (let i = 0; i < 9; i++) {
        if (this.board[i] === null) {
          this.board[i] = this.aiSymbol;
          if (this.checkWin(this.aiSymbol)) {
            this.board[i] = null;
            return i;
          }
          this.board[i] = null;
        }
      }

      // 2. Block player from winning
      for (let i = 0; i < 9; i++) {
        if (this.board[i] === null) {
          this.board[i] = this.playerSymbol;
          if (this.checkWin(this.playerSymbol)) {
            this.board[i] = null;
            return i;
          }
          this.board[i] = null;
        }
      }

      // 3. Take center if available
      if (this.board[4] === null) {
        return 4;
      }

      // 4. Take a corner
      const corners = [0, 2, 6, 8];
      const availableCorners = corners.filter(i => this.board[i] === null);
      if (availableCorners.length > 0) {
        return availableCorners[Math.floor(Math.random() * availableCorners.length)];
      }

      // 5. Take any available space
      const available = [];
      for (let i = 0; i < 9; i++) {
        if (this.board[i] === null) available.push(i);
      }
      return available[Math.floor(Math.random() * available.length)];
    },

    // Check if symbol has won
    checkWin(symbol) {
      return this.winConditions.some(condition => {
        return condition.every(index => this.board[index] === symbol);
      });
    },

    // Check for draw
    checkDraw() {
      return this.board.every(cell => cell !== null);
    },

    // End game
    endGame(winner) {
      this.gameOver = true;
      this.gamesPlayed++;
      this.print("");
      this.print(">>> GAME OVER <<<");
      
      if (winner === "player") {
        this.playerWins++;
        this.print("VICTORY! YOU DEFEATED THE OVERSEER!");
        this.print("IMPRESSIVE... FOR A VAULT DWELLER.");
      } else if (winner === "ai") {
        this.aiWins++;
        this.print("OVERSEER WINS!");
        this.print("PERHAPS YOU NEED MORE PRACTICE, CITIZEN.");
      } else {
        this.draws++;
        this.print("DRAW! A TIE GAME.");
        this.print("YOU ARE MORE CAPABLE THAN I ANTICIPATED.");
      }

      this.print("");
      this.print(`SCOREBOARD: YOU ${this.playerWins} | OVERSEER ${this.aiWins} | DRAWS ${this.draws}`);
      this.print("");
      this.print("TYPE 'ttt start' TO PLAY AGAIN.");

      this.active = false;
    },

    // Quit game
    quit() {
      if (!this.active) {
        this.print("NO GAME IS ACTIVE.");
        return;
      }

      this.active = false;
      this.gameOver = true;
      this.print("");
      this.print(">>> GAME TERMINATED <<<");
      this.print("GIVING UP SO SOON?");
      this.print("");
      this.print(`SCOREBOARD: YOU ${this.playerWins} | OVERSEER ${this.aiWins} | DRAWS ${this.draws}`);
    },

    // Draw the board
    drawBoard() {
      const display = this.board.map((cell, i) => {
        if (cell === null) return (i + 1).toString();
        return cell;
      });

      this.print("╔═══╦═══╦═══╗");
      this.print(`║ ${display[0]} ║ ${display[1]} ║ ${display[2]} ║`);
      this.print("╠═══╬═══╬═══╣");
      this.print(`║ ${display[3]} ║ ${display[4]} ║ ${display[5]} ║`);
      this.print("╠═══╬═══╬═══╣");
      this.print(`║ ${display[6]} ║ ${display[7]} ║ ${display[8]} ║`);
      this.print("╚═══╩═══╩═══╝");
    },

    // Print to terminal
    print(message) {
      if (window.overseer && window.overseer.print) {
        window.overseer.print(message);
      } else {
        console.log(message);
      }
    },

    // Show stats
    stats() {
      this.print(">>> TIC-TAC-TOE STATISTICS <<<");
      this.print(`GAMES PLAYED: ${this.gamesPlayed}`);
      this.print(`YOUR WINS: ${this.playerWins}`);
      this.print(`OVERSEER WINS: ${this.aiWins}`);
      this.print(`DRAWS: ${this.draws}`);
      
      if (this.gamesPlayed > 0) {
        const winRate = ((this.playerWins / this.gamesPlayed) * 100).toFixed(1);
        this.print(`YOUR WIN RATE: ${winRate}%`);
        
        if (winRate >= 75) {
          this.print("REMARKABLE PERFORMANCE, VAULT DWELLER.");
        } else if (winRate >= 50) {
          this.print("ACCEPTABLE PERFORMANCE.");
        } else if (winRate >= 25) {
          this.print("YOUR SKILLS NEED IMPROVEMENT.");
        } else {
          this.print("PERHAPS THIS GAME IS NOT FOR YOU.");
        }
      }
    }
  };

  // Export to global
  window.ticTacToe = TicTacToe;

  console.log("[TicTacToe] Module loaded");
})();
