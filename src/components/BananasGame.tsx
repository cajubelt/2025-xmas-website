import { useState, useRef, useCallback, useEffect } from 'react';
import './BananasGame.css';

// Standard Bananagrams letter distribution (144 tiles total in original)
const LETTER_DISTRIBUTION: Record<string, number> = {
  A: 13, B: 3, C: 3, D: 6, E: 18, F: 3, G: 4, H: 3, I: 12, J: 2,
  K: 2, L: 5, M: 3, N: 8, O: 11, P: 3, Q: 2, R: 9, S: 6, T: 9,
  U: 6, V: 3, W: 3, X: 2, Y: 3, Z: 2
};
const ORIGINAL_TOTAL = Object.values(LETTER_DISTRIBUTION).reduce((a, b) => a + b, 0); // 144

// Adjustable total supply - change this to scale the game size
const TOTAL_TILES = 72; // Half the original

const INITIAL_TILES = 10
const TILE_SIZE = 44;
const SNAP_THRESHOLD = 30; // pixels - how close to snap to an adjacent tile

interface Tile {
  id: string;
  letter: string;
}

interface PlacedTile extends Tile {
  x: number;
  y: number;
}

function createTilePool(): string[] {
  const pool: string[] = [];
  const scale = TOTAL_TILES / ORIGINAL_TOTAL;
  
  // Scale each letter's count proportionally, ensuring at least 1 of each
  for (const [letter, count] of Object.entries(LETTER_DISTRIBUTION)) {
    const scaledCount = Math.max(1, Math.round(count * scale));
    for (let i = 0; i < scaledCount; i++) {
      pool.push(letter);
    }
  }
  
  // Shuffle the pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function drawTiles(pool: string[], count: number): { drawn: Tile[], remaining: string[] } {
  const drawn: Tile[] = [];
  const remaining = [...pool];
  for (let i = 0; i < count && remaining.length > 0; i++) {
    const letter = remaining.pop()!;
    drawn.push({ id: `tile-${Date.now()}-${i}-${Math.random()}`, letter });
  }
  return { drawn, remaining };
}

const OPPONENT_NAMES = ['Millie', 'Chipaul', 'Charlie', 'Tammy', 'Emily', 'Richard'];
const PEEL_MESSAGES = [
  'PEEL! 🍌',
  'Peel! Hehe!',
  'PEEL!! 🎉',
  'Another peel!',
  'Peeling again!',
  'PEEL! 😄',
  'Does "peel" have two e\'s? 🤔',
  "What do I say when I'm done again?",
  "Dump! Wait I mean peel! 🤦‍♂️",
];

export default function BananasGame() {
  const [pool, setPool] = useState<string[]>([]);
  const [handTiles, setHandTiles] = useState<Tile[]>([]);
  const [boardTiles, setBoardTiles] = useState<PlacedTile[]>([]);
  const [draggedTile, setDraggedTile] = useState<Tile | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [dragSource, setDragSource] = useState<'hand' | 'board' | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [victory, setVictory] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isOverDump, setIsOverDump] = useState(false);
  const [showDumpWarning, setShowDumpWarning] = useState(false);
  const [pendingDumpTile, setPendingDumpTile] = useState<{ tile: Tile, source: 'hand' | 'board' } | null>(null);
  const [hideDumpWarning, setHideDumpWarning] = useState(false);
  const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);
  const [snapPreview, setSnapPreview] = useState<{ x: number, y: number } | null>(null);
  const [hasPlayerPeeled, setHasPlayerPeeled] = useState(false);
  const [opponentName] = useState(() => OPPONENT_NAMES[Math.floor(Math.random() * OPPONENT_NAMES.length)]);
  const [opponentSpeechBubble, setOpponentSpeechBubble] = useState<string | null>(null);
  const [defeat, setDefeat] = useState(false);
  const [showVictoryOverlay, setShowVictoryOverlay] = useState(true);
  const boardRef = useRef<HTMLDivElement>(null);
  const dumpRef = useRef<HTMLDivElement>(null);
  const opponentTimerRef = useRef<number | null>(null);
  const poolRef = useRef<string[]>([]);

  // Keep poolRef in sync with pool state for synchronous access in timers
  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);

  // Helper function to calculate snap position
  const calculateSnapPosition = useCallback((
    dropX: number,
    dropY: number,
    boardWidth: number,
    boardHeight: number,
    currentTileId: string | undefined
  ): { x: number, y: number } | null => {
    // Clamp position to board bounds
    const clampedX = Math.max(0, Math.min(dropX, boardWidth - TILE_SIZE));
    const clampedY = Math.max(0, Math.min(dropY, boardHeight - TILE_SIZE));

    let finalX = clampedX;
    let finalY = clampedY;
    let closestSnapDistance = Infinity;
    let didSnap = false;

    // Check all existing tiles for potential snap positions
    for (const existingTile of boardTiles) {
      if (existingTile.id === currentTileId) continue;
      
      // Calculate potential snap positions (adjacent to this tile)
      const snapPositions = [
        { x: existingTile.x - TILE_SIZE, y: existingTile.y }, // left
        { x: existingTile.x + TILE_SIZE, y: existingTile.y }, // right
        { x: existingTile.x, y: existingTile.y - TILE_SIZE }, // above
        { x: existingTile.x, y: existingTile.y + TILE_SIZE }, // below
      ];
      
      for (const pos of snapPositions) {
        const dist = Math.sqrt(Math.pow(clampedX - pos.x, 2) + Math.pow(clampedY - pos.y, 2));
        if (dist < SNAP_THRESHOLD && dist < closestSnapDistance) {
          closestSnapDistance = dist;
          finalX = pos.x;
          finalY = pos.y;
          didSnap = true;
        }
      }
    }

    if (!didSnap) return null;

    // Ensure snapped position is within bounds
    finalX = Math.max(0, Math.min(finalX, boardWidth - TILE_SIZE));
    finalY = Math.max(0, Math.min(finalY, boardHeight - TILE_SIZE));

    // Check for overlaps with existing tiles
    const wouldOverlap = boardTiles.some(t => {
      if (t.id === currentTileId) return false;
      const dx = Math.abs(t.x - finalX);
      const dy = Math.abs(t.y - finalY);
      return dx < TILE_SIZE && dy < TILE_SIZE;
    });

    if (wouldOverlap) return null;

    return { x: finalX, y: finalY };
  }, [boardTiles]);

  const startGame = useCallback(() => {
    // Clear any existing opponent timer
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    const newPool = createTilePool();
    const { drawn, remaining } = drawTiles(newPool, INITIAL_TILES);
    setPool(remaining);
    setHandTiles(drawn);
    setBoardTiles([]);
    setGameStarted(true);
    setVictory(false);
    setDefeat(false);
    setShowVictoryOverlay(true);
    setShowDumpWarning(false);
    setPendingDumpTile(null);
    setHasPlayerPeeled(false);
    setOpponentSpeechBubble(null);
  }, []);

  const scheduleOpponentPeel = useCallback(() => {
    // Clear any existing timer
    if (opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
    }
    // Schedule next peel between 15-30 seconds
    const delay = 15000 + Math.random() * 15000;
    opponentTimerRef.current = window.setTimeout(() => {
      // Read pool synchronously from ref
      const currentPool = poolRef.current;
      
      // If not enough tiles for both players, opponent wins (player loses)
      if (currentPool.length < 2) {
        setOpponentSpeechBubble('BANANAS! I win! 🎉');
        setDefeat(true);
        return;
      }
      
      // Draw one tile for the player
      const playerTile = currentPool[currentPool.length - 1];
      const newTile: Tile = { id: `tile-${Date.now()}-opp-${Math.random()}`, letter: playerTile };
      
      // Remove 2 tiles from pool (1 for player, 1 burned for opponent)
      const remaining = currentPool.slice(0, -2);
      setPool(remaining);
      
      // Add tile to player's hand
      setHandTiles(h => [...h, newTile]);
      
      // Show speech bubble
      const message = PEEL_MESSAGES[Math.floor(Math.random() * PEEL_MESSAGES.length)];
      setOpponentSpeechBubble(message);
      setTimeout(() => setOpponentSpeechBubble(null), 2500);
      
      // Schedule next peel if there are still tiles
      if (remaining.length >= 2) {
        scheduleOpponentPeel();
      }
    }, delay);
  }, []);

  const drawOneTile = useCallback(() => {
    if (pool.length === 0) return;
    // Draw 1 tile for player, burn 1 for opponent (2 total from pool)
    const { drawn, remaining: afterPlayer } = drawTiles(pool, 1);
    // Burn one more tile for the opponent's peel
    const remaining = afterPlayer.length > 0 ? afterPlayer.slice(0, -1) : afterPlayer;
    setPool(remaining);
    setHandTiles(prev => [...prev, ...drawn]);
    
    // Start/reset opponent timer on peel
    if (!hasPlayerPeeled) {
      setHasPlayerPeeled(true);
    }
    // Always reset the opponent timer when player peels
    scheduleOpponentPeel();
  }, [pool, hasPlayerPeeled, scheduleOpponentPeel]);

  const executeDump = useCallback((tile: Tile, source: 'hand' | 'board') => {
    // Remove the tile from hand or board
    if (source === 'hand') {
      setHandTiles(prev => prev.filter(t => t.id !== tile.id));
    } else {
      setBoardTiles(prev => prev.filter(t => t.id !== tile.id));
    }
    // Return tile to pool and draw 3 new tiles
    // First, add the tile back to pool
    const currentPool = [...poolRef.current, tile.letter];
    // Shuffle the returned tile in
    for (let i = currentPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [currentPool[i], currentPool[j]] = [currentPool[j], currentPool[i]];
    }
    
    // Draw 3 tiles from the updated pool
    const tilesToDraw = Math.min(3, currentPool.length);
    const { drawn, remaining } = drawTiles(currentPool, tilesToDraw);
    
    // Update state
    setPool(remaining);
    setHandTiles(h => [...h, ...drawn]);
  }, []);

  const handleDumpConfirm = useCallback(() => {
    if (pendingDumpTile) {
      if (dontShowAgainChecked) {
        setHideDumpWarning(true);
      }
      executeDump(pendingDumpTile.tile, pendingDumpTile.source);
      setPendingDumpTile(null);
      setShowDumpWarning(false);
      setDontShowAgainChecked(false);
    }
  }, [pendingDumpTile, dontShowAgainChecked, executeDump]);

  const handleDumpCancel = useCallback(() => {
    setPendingDumpTile(null);
    setShowDumpWarning(false);
    setDontShowAgainChecked(false);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, tile: Tile, source: 'hand' | 'board') => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setDragPosition({ x: e.clientX, y: e.clientY });
    setDraggedTile(tile);
    setDragSource(source);
  }, []);

  const handleBoardMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start panning if clicking directly on the board (not on a tile)
    if (e.target === e.currentTarget) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setBoardTiles(prev => prev.map(tile => ({
        ...tile,
        x: tile.x + dx,
        y: tile.y + dy
      })));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    if (!draggedTile) return;
    setDragPosition({ x: e.clientX, y: e.clientY });
    
    // Check if over dump zone
    if (dumpRef.current) {
      const dumpRect = dumpRef.current.getBoundingClientRect();
      const over = e.clientX >= dumpRect.left && 
                   e.clientX <= dumpRect.right && 
                   e.clientY >= dumpRect.top && 
                   e.clientY <= dumpRect.bottom;
      setIsOverDump(over);
    }

    // Calculate snap preview position
    if (boardRef.current) {
      const boardRect = boardRef.current.getBoundingClientRect();
      const dropX = e.clientX - dragOffset.x - boardRect.left;
      const dropY = e.clientY - dragOffset.y - boardRect.top;

      // Check if over board
      const isOnBoard = 
        e.clientX >= boardRect.left && 
        e.clientX <= boardRect.right && 
        e.clientY >= boardRect.top && 
        e.clientY <= boardRect.bottom;

      if (isOnBoard) {
        const snap = calculateSnapPosition(dropX, dropY, boardRect.width, boardRect.height, draggedTile.id);
        setSnapPreview(snap);
      } else {
        setSnapPreview(null);
      }
    }
  }, [draggedTile, isPanning, panStart, dragOffset, calculateSnapPosition]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!draggedTile || !boardRef.current) {
      setDraggedTile(null);
      setDragSource(null);
      setIsOverDump(false);
      setSnapPreview(null);
      return;
    }

    // Check if dropped on dump zone
    if (dumpRef.current) {
      const dumpRect = dumpRef.current.getBoundingClientRect();
      const isOnDump = e.clientX >= dumpRect.left && 
                       e.clientX <= dumpRect.right && 
                       e.clientY >= dumpRect.top && 
                       e.clientY <= dumpRect.bottom;
      
      if (isOnDump && dragSource) {
        if (hideDumpWarning) {
          // Skip warning, execute dump directly
          executeDump(draggedTile, dragSource);
        } else {
          // Show warning modal
          setPendingDumpTile({ tile: draggedTile, source: dragSource });
          setShowDumpWarning(true);
        }
        setDraggedTile(null);
        setDragSource(null);
        setIsOverDump(false);
        setSnapPreview(null);
        return;
      }
    }

    const boardRect = boardRef.current.getBoundingClientRect();
    const dropX = e.clientX - dragOffset.x - boardRect.left;
    const dropY = e.clientY - dragOffset.y - boardRect.top;

    // Check if dropped on board
    const isOnBoard = 
      e.clientX >= boardRect.left && 
      e.clientX <= boardRect.right && 
      e.clientY >= boardRect.top && 
      e.clientY <= boardRect.bottom;

    if (isOnBoard) {
      // Clamp position to board bounds
      const clampedX = Math.max(0, Math.min(dropX, boardRect.width - TILE_SIZE));
      const clampedY = Math.max(0, Math.min(dropY, boardRect.height - TILE_SIZE));

      // Use snap position if available, otherwise use clamped position
      const snap = calculateSnapPosition(dropX, dropY, boardRect.width, boardRect.height, draggedTile.id);
      const finalX = snap ? snap.x : clampedX;
      const finalY = snap ? snap.y : clampedY;

      // Check for overlaps with existing tiles (only if not snapping, snap already checks)
      const wouldOverlap = !snap && boardTiles.some(t => {
        if (t.id === draggedTile.id) return false;
        const dx = Math.abs(t.x - finalX);
        const dy = Math.abs(t.y - finalY);
        return dx < TILE_SIZE && dy < TILE_SIZE;
      });

      if (!wouldOverlap) {
        // Place tile on board
        if (dragSource === 'hand') {
          setHandTiles(prev => prev.filter(t => t.id !== draggedTile.id));
        } else {
          setBoardTiles(prev => prev.filter(t => t.id !== draggedTile.id));
        }
        setBoardTiles(prev => [...prev, { ...draggedTile, x: finalX, y: finalY }]);
      }
    } else if (dragSource === 'board') {
      // Dragged from board to outside - return to hand
      setBoardTiles(prev => prev.filter(t => t.id !== draggedTile.id));
      setHandTiles(prev => [...prev, { id: draggedTile.id, letter: draggedTile.letter }]);
    }

    setDraggedTile(null);
    setDragSource(null);
    setIsOverDump(false);
    setSnapPreview(null);
  }, [isPanning, draggedTile, dragOffset, dragSource, boardTiles, hideDumpWarning, executeDump, calculateSnapPosition]);

  useEffect(() => {
    if (draggedTile || isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggedTile, isPanning, handleMouseMove, handleMouseUp]);

  // Clean up opponent timer on victory, defeat, or unmount
  useEffect(() => {
    if ((victory || defeat) && opponentTimerRef.current) {
      clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
  }, [victory, defeat]);

  useEffect(() => {
    return () => {
      if (opponentTimerRef.current) {
        clearTimeout(opponentTimerRef.current);
      }
    };
  }, []);

  const allTilesUsed = pool.length === 0 && handTiles.length === 0;

  const claimVictory = () => {
    setVictory(true);
  };

  if (!gameStarted) {
    return (
      <div className="bananas-game">
        <div className="bananas-start-screen">
          <h1>🍌 Bananas! 🍌</h1>
          <p>A word tile game for Michie</p>
          <button className="bananas-start-btn" onClick={startGame}>
            Start Game
          </button>
        </div>
      </div>
    );
  }

  // Victory overlay is shown on top of the board so player can review their words
  const victoryOverlay = victory && showVictoryOverlay && (
    <div className="victory-overlay">
      <div className="victory-content">
        <button className="victory-close-btn" onClick={() => setShowVictoryOverlay(false)}>✕</button>
        <h1>🎉 BANANAS! 🎉</h1>
        <h2>You Win!</h2>
        <div className="victory-bananas">🍌🍌🍌🍌🍌</div>
        <p>Congratulations, Michie!</p>
        <div className="confetti">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="confetti-piece" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][Math.floor(Math.random() * 6)]
            }} />
          ))}
        </div>
        <button className="bananas-start-btn" onClick={startGame}>
          Play Again
        </button>
      </div>
    </div>
  );

  // Floating play again button when victory overlay is closed
  const playAgainButton = victory && !showVictoryOverlay && (
    <button className="floating-play-again" onClick={startGame}>
      🍌 Play Again
    </button>
  );

  if (defeat) {
    return (
      <div className="bananas-game">
        <div className="bananas-defeat">
          <h1>😢 Oh no! 😢</h1>
          <h2>{opponentName} Won!</h2>
          <div className="defeat-bananas">🍌💔🍌</div>
          <p>The bunch ran out before you could finish!</p>
          <p className="defeat-encouragement">Better luck next time, Michie!</p>
          <button className="bananas-start-btn" onClick={startGame}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bananas-game">
      <div className="bananas-header">
        <h1>🍌 Bananas!</h1>
        <div className="bananas-stats">
          <span>Tiles in bunch: {pool.length}</span>
          <span>Your tiles: {handTiles.length + boardTiles.length}</span>
        </div>
        {opponentSpeechBubble && (
          <div className="opponent-speech">
            <span className="opponent-avatar">👤</span>
            <div className="speech-bubble">
              <span className="opponent-name">{opponentName}:</span> {opponentSpeechBubble}
            </div>
          </div>
        )}
      </div>

      <div className="bananas-board" ref={boardRef} onMouseDown={handleBoardMouseDown}>
        {boardTiles.map(tile => (
          <div
            key={tile.id}
            className={`bananas-tile on-board ${draggedTile?.id === tile.id ? 'dragging' : ''}`}
            style={{ left: tile.x, top: tile.y }}
            onMouseDown={(e) => handleMouseDown(e, tile, 'board')}
          >
            {tile.letter}
          </div>
        ))}
        {/* Snap preview ghost */}
        {draggedTile && snapPreview && (
          <div
            className="bananas-tile on-board snap-preview"
            style={{ left: snapPreview.x, top: snapPreview.y }}
          >
            {draggedTile.letter}
          </div>
        )}
        {boardTiles.length === 0 && !draggedTile && (
          <div className="board-placeholder">
            Drag tiles here to build your words
          </div>
        )}
      </div>

      <div className="bananas-controls">
        <div className="bananas-hand-area">
          <div className="bananas-hand">
            {handTiles.map(tile => (
              <div
                key={tile.id}
                className={`bananas-tile in-hand ${draggedTile?.id === tile.id ? 'dragging' : ''}`}
                onMouseDown={(e) => handleMouseDown(e, tile, 'hand')}
              >
                {tile.letter}
              </div>
            ))}
          </div>
          <div 
            ref={dumpRef}
            className={`bananas-dump ${isOverDump ? 'dump-hover' : ''}`}
          >
            <span className="dump-icon">🗑️</span>
            <span className="dump-label">Dump</span>
          </div>
        </div>
        <div className="bananas-actions">
          {allTilesUsed ? (
            <button className="bananas-victory-btn" onClick={claimVictory}>
              🏆 Claim Victory!
            </button>
          ) : (
            <button 
              className="bananas-draw-btn" 
              onClick={drawOneTile}
              disabled={pool.length === 0 || handTiles.length > 0}
              title={handTiles.length > 0 ? "Place all tiles on the board before peeling" : ""}
            >
              {handTiles.length > 0 ? "Place tiles first!" : `Peel (${pool.length} left)`}
            </button>
          )}
          <p className="bananas-hint">Drag tiles to Dump to exchange for 3 new tiles • Drag the board to pan</p>
        </div>
      </div>

      {/* Dragged tile preview */}
      {draggedTile && (
        <div
          className="bananas-tile dragging-preview"
          style={{
            left: dragPosition.x - dragOffset.x,
            top: dragPosition.y - dragOffset.y,
          }}
        >
          {draggedTile.letter}
        </div>
      )}

      {/* Dump warning modal */}
      {showDumpWarning && (
        <div className="dump-modal-overlay">
          <div className="dump-modal">
            <h3>🗑️ Dump Tile?</h3>
            <p>
              Dumping a tile returns it to the bunch and gives you <strong>3 new tiles</strong> in exchange.
            </p>
            {pendingDumpTile && (
              <p className="dump-tile-preview">
                You're dumping: <span className="dump-tile-letter">{pendingDumpTile.tile.letter}</span>
              </p>
            )}
            <label className="dump-checkbox-label">
              <input 
                type="checkbox" 
                checked={dontShowAgainChecked}
                onChange={(e) => setDontShowAgainChecked(e.target.checked)}
              />
              Don't show this warning again
            </label>
            <div className="dump-modal-buttons">
              <button className="dump-cancel-btn" onClick={handleDumpCancel}>
                Cancel
              </button>
              <button className="dump-confirm-btn" onClick={handleDumpConfirm}>
                Dump It!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory overlay - shown on top of board so player can review */}
      {victoryOverlay}

      {/* Floating play again button when overlay is dismissed */}
      {playAgainButton}
    </div>
  );
}
