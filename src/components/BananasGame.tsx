import { useState, useRef, useCallback, useEffect } from 'react';
import './BananasGame.css';

// Standard Bananagrams letter distribution (144 tiles total)
const LETTER_DISTRIBUTION: Record<string, number> = {
  A: 13, B: 3, C: 3, D: 6, E: 18, F: 3, G: 4, H: 3, I: 12, J: 2,
  K: 2, L: 5, M: 3, N: 8, O: 11, P: 3, Q: 2, R: 9, S: 6, T: 9,
  U: 6, V: 3, W: 3, X: 2, Y: 3, Z: 2
};

const INITIAL_TILES = 21;
const TILE_SIZE = 44;

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
  for (const [letter, count] of Object.entries(LETTER_DISTRIBUTION)) {
    for (let i = 0; i < count; i++) {
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
  const boardRef = useRef<HTMLDivElement>(null);
  const dumpRef = useRef<HTMLDivElement>(null);

  const startGame = useCallback(() => {
    const newPool = createTilePool();
    const { drawn, remaining } = drawTiles(newPool, INITIAL_TILES);
    setPool(remaining);
    setHandTiles(drawn);
    setBoardTiles([]);
    setGameStarted(true);
    setVictory(false);
    setShowDumpWarning(false);
    setPendingDumpTile(null);
  }, []);

  const drawOneTile = useCallback(() => {
    if (pool.length === 0) return;
    const { drawn, remaining } = drawTiles(pool, 1);
    setPool(remaining);
    setHandTiles(prev => [...prev, ...drawn]);
  }, [pool]);

  const executeDump = useCallback((tile: Tile, source: 'hand' | 'board') => {
    // Remove the tile from hand or board
    if (source === 'hand') {
      setHandTiles(prev => prev.filter(t => t.id !== tile.id));
    } else {
      setBoardTiles(prev => prev.filter(t => t.id !== tile.id));
    }
    // Return tile to pool and draw 3 new tiles
    setPool(prev => {
      const newPool = [...prev, tile.letter];
      // Shuffle the returned tile in
      for (let i = newPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newPool[i], newPool[j]] = [newPool[j], newPool[i]];
      }
      return newPool;
    });
    // Draw 3 tiles after a brief delay to let pool update
    setTimeout(() => {
      setPool(prev => {
        const tilesToDraw = Math.min(3, prev.length);
        const { drawn, remaining } = drawTiles(prev, tilesToDraw);
        setHandTiles(h => [...h, ...drawn]);
        return remaining;
      });
    }, 0);
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
  }, [draggedTile, isPanning, panStart]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (!draggedTile || !boardRef.current) {
      setDraggedTile(null);
      setDragSource(null);
      setIsOverDump(false);
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

      // Check for overlaps with existing tiles
      const wouldOverlap = boardTiles.some(t => {
        if (t.id === draggedTile.id) return false;
        const dx = Math.abs(t.x - clampedX);
        const dy = Math.abs(t.y - clampedY);
        return dx < TILE_SIZE && dy < TILE_SIZE;
      });

      if (!wouldOverlap) {
        // Place tile on board
        if (dragSource === 'hand') {
          setHandTiles(prev => prev.filter(t => t.id !== draggedTile.id));
        } else {
          setBoardTiles(prev => prev.filter(t => t.id !== draggedTile.id));
        }
        setBoardTiles(prev => [...prev, { ...draggedTile, x: clampedX, y: clampedY }]);
      }
    } else if (dragSource === 'board') {
      // Dragged from board to outside - return to hand
      setBoardTiles(prev => prev.filter(t => t.id !== draggedTile.id));
      setHandTiles(prev => [...prev, { id: draggedTile.id, letter: draggedTile.letter }]);
    }

    setDraggedTile(null);
    setDragSource(null);
    setIsOverDump(false);
  }, [isPanning, draggedTile, dragOffset, dragSource, boardTiles, hideDumpWarning, executeDump]);

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

  if (victory) {
    return (
      <div className="bananas-game">
        <div className="bananas-victory">
          <h1>🎉 BANANAS! 🎉</h1>
          <h2>You Win!</h2>
          <div className="victory-bananas">🍌🍌🍌🍌🍌</div>
          <p>Congratulations, Michie! You used all your tiles!</p>
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
  }

  return (
    <div className="bananas-game">
      <div className="bananas-header">
        <h1>🍌 Bananas!</h1>
        <div className="bananas-stats">
          <span>Tiles in bunch: {pool.length}</span>
          <span>Your tiles: {handTiles.length + boardTiles.length}</span>
        </div>
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
        {boardTiles.length === 0 && (
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
    </div>
  );
}
