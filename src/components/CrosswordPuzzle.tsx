import { useState, useEffect, useRef, useCallback } from 'react';
import './CrosswordPuzzle.css';

interface WordData {
  word: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
  clue: string;
  isGiftClue?: boolean;
  displayNumber?: number;
}

interface GridCell {
  letter: string;
  isActive: boolean;
  number: number | null;
}

const words: WordData[] = [
  { word: 'MARSHMALLOW', row: 2, col: 0, direction: 'down', 
    clue: "The ingredient that made this year's Thanksgiving extra lit" },
  { word: 'AISLE', row: 3, col: 0, direction: 'across', 
    clue: "You walked down this earlier this year — and it wasn't on a plane" },
  { word: 'GUSTO', row: 1, col: 2, direction: 'down', 
    clue: "A beloved's name at home, extended, means zeal" },
  { word: 'MANGER', row: 7, col: 0, direction: 'across', 
    clue: '"Away in a ___, no crib for a bed"' },
  { word: 'LANEIGE', row: 10, col: 0, direction: 'across', 
    clue: 'Bedside essential, all the way from Seoul' },
  { word: 'GREEN', row: 7, col: 3, direction: 'down', 
    clue: 'A favorite hue, your bridal party wore it too' },
  { word: 'SPRINGS', row: 5, col: 5, direction: 'down', 
    clue: 'These can be hot, natural, or in your mattress', isGiftClue: true },
  { word: 'SILVER', row: 5, col: 5, direction: 'across', 
    clue: 'The color of tinsel on the Christmas tree', isGiftClue: true },
  { word: 'PRE', row: 6, col: 5, direction: 'across', 
    clue: "What comes before 'nuptial'?" },
  { word: 'FIR', row: 4, col: 6, direction: 'down', 
    clue: 'The tree that fills your home with holiday scent' },
  { word: 'LEO', row: 5, col: 7, direction: 'down', 
    clue: 'A starry lion you love to cuddle' },
  { word: 'RHINEFIELD', row: 5, col: 10, direction: 'down', 
    clue: 'This New Forest house witnessed one of your happiest days' },
  { word: 'BANHXEO', row: 8, col: 8, direction: 'across', 
    clue: 'A crispy golden memory from lunch' },
  { word: 'TAHOE', row: 12, col: 6, direction: 'across', 
    clue: "This year's holiday destination, where two states meet at a snowy shore" },
  { word: 'KIND', row: 14, col: 7, direction: 'across', 
    clue: "A word for Rich's nature, or a bar for the trail" },
  { word: 'THAI', row: 11, col: 8, direction: 'down', 
    clue: 'The land where beach parties abound and true love is found' },
  { word: 'WELLS', row: 7, col: 13, direction: 'down', 
    clue: 'These hold water, and part of a name Rich knows well' },
];

export default function CrosswordPuzzle() {
  const [grid, setGrid] = useState<GridCell[][]>([]);
  const [userInputs, setUserInputs] = useState<{ [key: string]: string }>({});
  const [currentSelection, setCurrentSelection] = useState<WordData | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [cellStates, setCellStates] = useState<{ [key: string]: 'correct' | 'incorrect' | null }>({});
  const [completedClues, setCompletedClues] = useState<Set<string>>(new Set());
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [gridBounds, setGridBounds] = useState({ minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 });
  const [showRevealDropdown, setShowRevealDropdown] = useState(false);
  const [showClearDropdown, setShowClearDropdown] = useState(false);
  const [showCheckDropdown, setShowCheckDropdown] = useState(false);
  
  const confettiContainerRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const wordsWithNumbers = useRef<WordData[]>([]);
  const revealDropdownRef = useRef<HTMLDivElement>(null);
  const clearDropdownRef = useRef<HTMLDivElement>(null);
  const checkDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (revealDropdownRef.current && !revealDropdownRef.current.contains(event.target as Node)) {
        setShowRevealDropdown(false);
      }
      if (clearDropdownRef.current && !clearDropdownRef.current.contains(event.target as Node)) {
        setShowClearDropdown(false);
      }
      if (checkDropdownRef.current && !checkDropdownRef.current.contains(event.target as Node)) {
        setShowCheckDropdown(false);
      }
    };
    
    if (showRevealDropdown || showClearDropdown || showCheckDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showRevealDropdown, showClearDropdown, showCheckDropdown]);

  // Initialize grid
  useEffect(() => {
    let maxRow = 0, maxCol = 0;
    words.forEach(w => {
      const endRow = w.direction === 'down' ? w.row + w.word.length - 1 : w.row;
      const endCol = w.direction === 'across' ? w.col + w.word.length - 1 : w.col;
      maxRow = Math.max(maxRow, endRow);
      maxCol = Math.max(maxCol, endCol);
    });

    const ROWS = maxRow + 1;
    const COLS = maxCol + 1;

    const newGrid: GridCell[][] = [];
    for (let r = 0; r < ROWS; r++) {
      newGrid[r] = [];
      for (let c = 0; c < COLS; c++) {
        newGrid[r][c] = { letter: '', isActive: false, number: null };
      }
    }

    // Calculate display numbers
    const startPositions: { key: string; row: number; col: number; wordIndices: number[] }[] = [];
    words.forEach((wordData, idx) => {
      const key = `${wordData.row}-${wordData.col}`;
      const existing = startPositions.find(p => p.key === key);
      if (!existing) {
        startPositions.push({ key, row: wordData.row, col: wordData.col, wordIndices: [idx] });
      } else {
        existing.wordIndices.push(idx);
      }
    });

    startPositions.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    const numberedWords = [...words];
    startPositions.forEach((pos, numIdx) => {
      const num = numIdx + 1;
      pos.wordIndices.forEach(wordIdx => {
        numberedWords[wordIdx] = { ...numberedWords[wordIdx], displayNumber: num };
      });
    });

    wordsWithNumbers.current = numberedWords;

    // Fill grid with letters
    numberedWords.forEach(wordData => {
      const { word, row, col, direction, displayNumber } = wordData;
      for (let i = 0; i < word.length; i++) {
        const r = direction === 'down' ? row + i : row;
        const c = direction === 'across' ? col + i : col;
        
        if (r < ROWS && c < COLS && r >= 0 && c >= 0) {
          newGrid[r][c].letter = word[i];
          newGrid[r][c].isActive = true;
          
          if (i === 0 && !newGrid[r][c].number) {
            newGrid[r][c].number = displayNumber!;
          }
        }
      }
    });

    // Calculate bounds
    let minRow = ROWS, maxR = 0, minCol = COLS, maxC = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (newGrid[r][c].isActive) {
          minRow = Math.min(minRow, r);
          maxR = Math.max(maxR, r);
          minCol = Math.min(minCol, c);
          maxC = Math.max(maxC, c);
        }
      }
    }

    setGridBounds({ minRow, maxRow: maxR, minCol, maxCol: maxC });
    setGrid(newGrid);
  }, []);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      if (timerRunning) {
        setTimerSeconds(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Check for puzzle completion whenever user inputs change
  useEffect(() => {
    if (grid.length === 0 || showModal) return;
    
    let allCorrect = true;
    let allFilled = true;
    
    for (let r = gridBounds.minRow; r <= gridBounds.maxRow; r++) {
      for (let c = gridBounds.minCol; c <= gridBounds.maxCol; c++) {
        if (grid[r]?.[c]?.isActive) {
          const key = `${r}-${c}`;
          const userValue = userInputs[key] || '';
          const correct = grid[r][c].letter;
          
          if (!userValue) {
            allFilled = false;
            allCorrect = false;
          } else if (userValue !== correct) {
            allCorrect = false;
          }
        }
      }
    }
    
    if (allFilled && allCorrect) {
      // Mark all cells as correct
      const newCellStates: { [key: string]: 'correct' | 'incorrect' | null } = {};
      for (let r = gridBounds.minRow; r <= gridBounds.maxRow; r++) {
        for (let c = gridBounds.minCol; c <= gridBounds.maxCol; c++) {
          if (grid[r]?.[c]?.isActive) {
            newCellStates[`${r}-${c}`] = 'correct';
          }
        }
      }
      setCellStates(newCellStates);
      setCompletedClues(new Set(wordsWithNumbers.current.map(w => `${w.word}-${w.direction}`)));
      setTimerRunning(false);
      launchConfetti();
      setShowModal(true);
    }
  }, [userInputs, grid, gridBounds, showModal]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getCurrentDate = useCallback(() => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return new Date().toLocaleDateString('en-US', options);
  }, []);

  const selectWord = useCallback((wordData: WordData) => {
    setCurrentSelection(wordData);

    const { word, row, col, direction } = wordData;
    
    // Find first empty cell or focus first cell
    for (let i = 0; i < word.length; i++) {
      const r = direction === 'down' ? row + i : row;
      const c = direction === 'across' ? col + i : col;
      const key = `${r}-${c}`;
      if (!userInputs[key]) {
        setSelectedCell({ row: r, col: c });
        setTimeout(() => inputRefs.current[key]?.focus(), 0);
        return;
      }
    }
    
    setSelectedCell({ row, col });
    setTimeout(() => inputRefs.current[`${row}-${col}`]?.focus(), 0);
  }, [userInputs]);

  const getWordCells = useCallback((wordData: WordData) => {
    const cells: { row: number; col: number }[] = [];
    for (let i = 0; i < wordData.word.length; i++) {
      const r = wordData.direction === 'down' ? wordData.row + i : wordData.row;
      const c = wordData.direction === 'across' ? wordData.col + i : wordData.col;
      cells.push({ row: r, col: c });
    }
    return cells;
  }, []);

  const isHighlighted = useCallback((row: number, col: number) => {
    if (!currentSelection) return false;
    return getWordCells(currentSelection).some(cell => cell.row === row && cell.col === col);
  }, [currentSelection, getWordCells]);

  const findWordsAtCell = useCallback((row: number, col: number) => {
    return wordsWithNumbers.current.filter(w => {
      const cells = getWordCells(w);
      return cells.some(cell => cell.row === row && cell.col === col);
    });
  }, [getWordCells]);

  const handleCellClick = useCallback((row: number, col: number) => {
    const matchingWords = findWordsAtCell(row, col);
    
    if (matchingWords.length > 0) {
      if (currentSelection && matchingWords.length > 1 && 
          selectedCell?.row === row && selectedCell?.col === col) {
        const otherWord = matchingWords.find(w => 
          w.word !== currentSelection.word || w.direction !== currentSelection.direction
        );
        if (otherWord) {
          setCurrentSelection(otherWord);
          setSelectedCell({ row, col });
          return;
        }
      }
      setCurrentSelection(matchingWords[0]);
      setSelectedCell({ row, col });
    }
  }, [currentSelection, selectedCell, findWordsAtCell]);

  const moveToCell = useCallback((row: number, col: number) => {
    const key = `${row}-${col}`;
    const input = inputRefs.current[key];
    if (input) {
      input.focus();
      setSelectedCell({ row, col });
      return true;
    }
    return false;
  }, []);

  const moveToNextInWord = useCallback((row: number, col: number) => {
    if (!currentSelection) return;
    
    const { word } = currentSelection;
    const cells = getWordCells(currentSelection);
    const currentIdx = cells.findIndex(c => c.row === row && c.col === col);

    if (currentIdx >= 0 && currentIdx < word.length - 1) {
      const nextCell = cells[currentIdx + 1];
      moveToCell(nextCell.row, nextCell.col);
    }
  }, [currentSelection, getWordCells, moveToCell]);

  const moveToPrevInWord = useCallback((row: number, col: number) => {
    if (!currentSelection) return;
    
    const cells = getWordCells(currentSelection);
    const currentIdx = cells.findIndex(c => c.row === row && c.col === col);

    if (currentIdx > 0) {
      const prevCell = cells[currentIdx - 1];
      moveToCell(prevCell.row, prevCell.col);
      setUserInputs(prev => ({ ...prev, [`${prevCell.row}-${prevCell.col}`]: '' }));
    }
  }, [currentSelection, getWordCells, moveToCell]);

  const moveToNextWord = useCallback((reverse = false) => {
    const sortedWords = [...wordsWithNumbers.current].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    if (!currentSelection) {
      selectWord(sortedWords[0]);
      return;
    }

    const currentIdx = sortedWords.findIndex(w => 
      w.word === currentSelection.word && w.direction === currentSelection.direction
    );
    
    const nextIdx = reverse 
      ? (currentIdx - 1 + sortedWords.length) % sortedWords.length
      : (currentIdx + 1) % sortedWords.length;
    
    selectWord(sortedWords[nextIdx]);
  }, [currentSelection, selectWord]);

  const handleInput = useCallback((row: number, col: number, value: string) => {
    const key = `${row}-${col}`;
    const upperValue = value.toUpperCase();
    setUserInputs(prev => ({ ...prev, [key]: upperValue }));
    setCellStates(prev => ({ ...prev, [key]: null }));
    
    if (upperValue) {
      moveToNextInWord(row, col);
    }
  }, [moveToNextInWord]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const key = `${row}-${col}`;
    
    if (e.key === 'Backspace' && !userInputs[key]) {
      e.preventDefault();
      moveToPrevInWord(row, col);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveToCell(row, col + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveToCell(row, col - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveToCell(row + 1, col);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveToCell(row - 1, col);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      moveToNextWord(e.shiftKey);
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      // Handle letter input - this allows typing over existing letters
      e.preventDefault();
      handleInput(row, col, e.key);
    }
  }, [userInputs, moveToCell, moveToPrevInWord, moveToNextWord, handleInput]);

  const checkSquare = useCallback(() => {
    if (!selectedCell) {
      setToastMessage('Select a cell first');
      setShowCheckDropdown(false);
      return;
    }
    const { row, col } = selectedCell;
    const key = `${row}-${col}`;
    const userValue = userInputs[key] || '';
    
    if (!userValue) {
      setToastMessage('Cell is empty');
      setShowCheckDropdown(false);
      return;
    }
    
    if (grid[row]?.[col]?.isActive) {
      const correct = grid[row][col].letter;
      if (userValue === correct) {
        setCellStates(prev => ({ ...prev, [key]: 'correct' }));
        setToastMessage('Correct!');
      } else {
        setCellStates(prev => ({ ...prev, [key]: 'incorrect' }));
        setToastMessage('Incorrect');
      }
    }
    setShowCheckDropdown(false);
  }, [selectedCell, grid, userInputs]);

  const checkWord = useCallback(() => {
    if (!currentSelection) {
      setToastMessage('Select a word first');
      setShowCheckDropdown(false);
      return;
    }
    const cells = getWordCells(currentSelection);
    const newCellStates: { [key: string]: 'correct' | 'incorrect' | null } = { ...cellStates };
    let anyFilled = false;
    let allCorrect = true;
    
    cells.forEach(({ row, col }) => {
      const key = `${row}-${col}`;
      const userValue = userInputs[key] || '';
      const correct = grid[row]?.[col]?.letter;
      
      if (userValue) {
        anyFilled = true;
        if (userValue === correct) {
          newCellStates[key] = 'correct';
        } else {
          newCellStates[key] = 'incorrect';
          allCorrect = false;
        }
      } else {
        allCorrect = false;
      }
    });

    if (!anyFilled) {
      setToastMessage('Word is empty');
      setShowCheckDropdown(false);
      return;
    }

    setCellStates(newCellStates);
    
    if (allCorrect) {
      setCompletedClues(prev => new Set([...prev, `${currentSelection.word}-${currentSelection.direction}`]));
      setToastMessage('Word is correct!');
    } else {
      setToastMessage('Some letters are incorrect');
    }
    setShowCheckDropdown(false);
  }, [currentSelection, getWordCells, grid, userInputs, cellStates]);

  const revealSquare = useCallback(() => {
    if (!selectedCell) {
      setToastMessage('Select a cell first');
      setShowRevealDropdown(false);
      return;
    }
    const { row, col } = selectedCell;
    const key = `${row}-${col}`;
    if (grid[row]?.[col]?.isActive) {
      setUserInputs(prev => ({ ...prev, [key]: grid[row][col].letter }));
      setCellStates(prev => ({ ...prev, [key]: 'correct' }));
      setToastMessage('Square revealed!');
    }
    setShowRevealDropdown(false);
  }, [selectedCell, grid]);

  const revealWord = useCallback(() => {
    if (!currentSelection) {
      setToastMessage('Select a word first');
      setShowRevealDropdown(false);
      return;
    }
    const cells = getWordCells(currentSelection);
    const newInputs: { [key: string]: string } = { ...userInputs };
    const newCellStates: { [key: string]: 'correct' | 'incorrect' | null } = { ...cellStates };
    
    cells.forEach(({ row, col }) => {
      const key = `${row}-${col}`;
      if (grid[row]?.[col]?.isActive) {
        newInputs[key] = grid[row][col].letter;
        newCellStates[key] = 'correct';
      }
    });

    setUserInputs(newInputs);
    setCellStates(newCellStates);
    setCompletedClues(prev => new Set([...prev, `${currentSelection.word}-${currentSelection.direction}`]));
    setToastMessage('Word revealed!');
    setShowRevealDropdown(false);
  }, [currentSelection, getWordCells, grid, userInputs, cellStates]);

  const revealPuzzle = useCallback(() => {
    const newInputs: { [key: string]: string } = {};
    const newCellStates: { [key: string]: 'correct' | 'incorrect' | null } = {};
    
    for (let r = gridBounds.minRow; r <= gridBounds.maxRow; r++) {
      for (let c = gridBounds.minCol; c <= gridBounds.maxCol; c++) {
        if (grid[r]?.[c]?.isActive) {
          const key = `${r}-${c}`;
          newInputs[key] = grid[r][c].letter;
          newCellStates[key] = 'correct';
        }
      }
    }

    setUserInputs(newInputs);
    setCellStates(newCellStates);
    setCompletedClues(new Set(wordsWithNumbers.current.map(w => `${w.word}-${w.direction}`)));
    setShowRevealDropdown(false);
  }, [grid, gridBounds]);

  const clearSquare = useCallback(() => {
    if (!selectedCell) {
      setToastMessage('Select a cell first');
      setShowClearDropdown(false);
      return;
    }
    const { row, col } = selectedCell;
    const key = `${row}-${col}`;
    setUserInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[key];
      return newInputs;
    });
    setCellStates(prev => {
      const newStates = { ...prev };
      delete newStates[key];
      return newStates;
    });
    setToastMessage('Square cleared!');
    setShowClearDropdown(false);
  }, [selectedCell]);

  const clearWord = useCallback(() => {
    if (!currentSelection) {
      setToastMessage('Select a word first');
      setShowClearDropdown(false);
      return;
    }
    const cells = getWordCells(currentSelection);
    setUserInputs(prev => {
      const newInputs = { ...prev };
      cells.forEach(({ row, col }) => {
        delete newInputs[`${row}-${col}`];
      });
      return newInputs;
    });
    setCellStates(prev => {
      const newStates = { ...prev };
      cells.forEach(({ row, col }) => {
        delete newStates[`${row}-${col}`];
      });
      return newStates;
    });
    setCompletedClues(prev => {
      const newSet = new Set(prev);
      newSet.delete(`${currentSelection.word}-${currentSelection.direction}`);
      return newSet;
    });
    setToastMessage('Word cleared!');
    setShowClearDropdown(false);
  }, [currentSelection, getWordCells]);

  const clearPuzzle = useCallback(() => {
    setUserInputs({});
    setCellStates({});
    setCompletedClues(new Set());
    setToastMessage('Puzzle cleared!');
    setShowClearDropdown(false);
  }, []);

  const playAgain = useCallback(() => {
    setShowModal(false);
    setUserInputs({});
    setCellStates({});
    setCompletedClues(new Set());
    setToastMessage(null);
    setTimerSeconds(0);
    setTimerRunning(true);
  }, []);

  const launchConfetti = useCallback(() => {
    const container = confettiContainerRef.current;
    if (!container) return;
    
    const emojis = ['🎄', '🎄', '🎄', '❄️', '🎁', '⭐'];
    
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'crossword-confetti';
      confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.fontSize = (Math.random() * 16 + 16) + 'px';
      confetti.style.animationDuration = (Math.random() * 4 + 6) + 's';
      confetti.style.animationDelay = Math.random() * 2 + 's';
      container.appendChild(confetti);
      
      setTimeout(() => confetti.remove(), 10000);
    }
  }, []);

  const displayCols = gridBounds.maxCol - gridBounds.minCol + 1;

  const acrossWords = wordsWithNumbers.current
    .filter(w => w.direction === 'across')
    .sort((a, b) => (a.displayNumber || 0) - (b.displayNumber || 0));
  
  const downWords = wordsWithNumbers.current
    .filter(w => w.direction === 'down')
    .sort((a, b) => (a.displayNumber || 0) - (b.displayNumber || 0));

  return (
    <div className="crossword-container">
      <div className="crossword-confetti-container" ref={confettiContainerRef}></div>
      
      {/* Success Modal */}
      <div className={`crossword-modal-overlay ${showModal ? 'active' : ''}`}>
        <div className="crossword-modal">
          <h2>Happy holidays!</h2>
          <div className="crossword-modal-subtitle">Your gift is on the way to your email.</div>
          <div className="crossword-modal-hint"><strong>🎁   Hint:</strong> Silver Springs</div>
          <button className="crossword-modal-btn" onClick={playAgain}>Play again</button>
        </div>
      </div>
      
      <div className="crossword-wrapper">
        <div className="crossword-header">
          <div className="crossword-header-title-row">
            <h1>The Crossword</h1>
            <div className="crossword-date">{getCurrentDate()}</div>
          </div>
          <div className="crossword-byline">By Michie and Charlie</div>
        </div>

        <div className="crossword-note-banner">
          <div className="crossword-note-label">Editors' note</div>
          <div className="crossword-note-content">
            This is a special one-of-a-kind puzzle made just for Emily. The clues contain personal references—if you're not Emily, good luck! 🎄
          </div>
        </div>

        <div className="crossword-toolbar">
          <div className="crossword-timer">
            <svg className="crossword-timer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span className="crossword-timer-display">{formatTime(timerSeconds)}</span>
            <button 
              className="crossword-toolbar-btn crossword-timer-btn" 
              onClick={() => setTimerRunning(!timerRunning)}
            >
              {timerRunning ? '⏸' : '▶'}
            </button>
          </div>
          <div className="crossword-toolbar-actions">
            <div className="crossword-dropdown-wrapper" ref={clearDropdownRef}>
              <button 
                className="crossword-toolbar-btn" 
                onClick={() => setShowClearDropdown(!showClearDropdown)}
              >
                Clear
              </button>
              {showClearDropdown && (
                <div className="crossword-dropdown-menu">
                  <button onClick={clearSquare}>Square</button>
                  <button onClick={clearWord}>Word</button>
                  <button onClick={clearPuzzle}>Puzzle</button>
                </div>
              )}
            </div>
            <div className="crossword-dropdown-wrapper" ref={revealDropdownRef}>
              <button 
                className="crossword-toolbar-btn" 
                onClick={() => setShowRevealDropdown(!showRevealDropdown)}
              >
                Reveal
              </button>
              {showRevealDropdown && (
                <div className="crossword-dropdown-menu">
                  <button onClick={revealSquare}>Square</button>
                  <button onClick={revealWord}>Word</button>
                  <button onClick={revealPuzzle}>Puzzle</button>
                </div>
              )}
            </div>
            <div className="crossword-dropdown-wrapper" ref={checkDropdownRef}>
              <button 
                className="crossword-toolbar-btn" 
                onClick={() => setShowCheckDropdown(!showCheckDropdown)}
              >
                Check
              </button>
              {showCheckDropdown && (
                <div className="crossword-dropdown-menu">
                  <button onClick={checkSquare}>Square</button>
                  <button onClick={checkWord}>Word</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="crossword-game-layout">
          <div className="crossword-panel" style={{ '--display-cols': displayCols } as React.CSSProperties}>
            <div 
              className="crossword-current-clue" 
              style={{ width: `calc(${displayCols} * var(--cell-size) + 4px)` }}
            >
              {currentSelection ? (
                <>
                  <span className="crossword-current-clue-number">
                    {currentSelection.displayNumber}
                  </span>
                  <span className="crossword-current-clue-text">{currentSelection.clue}</span>
                </>
              ) : (
                <span className="crossword-current-clue-text">Click a cell to begin</span>
              )}
            </div>
            
            <div 
              className="crossword-grid"
              style={{ gridTemplateColumns: `repeat(${displayCols}, var(--cell-size))` }}
            >
              {grid.length > 0 && Array.from(
                { length: gridBounds.maxRow - gridBounds.minRow + 1 },
                (_, ri) => gridBounds.minRow + ri
              ).map(r => (
                Array.from(
                  { length: gridBounds.maxCol - gridBounds.minCol + 1 },
                  (_, ci) => gridBounds.minCol + ci
                ).map(c => {
                  const cell = grid[r]?.[c];
                  if (!cell) return null;
                  
                  const key = `${r}-${c}`;
                  const isSelected = selectedCell?.row === r && selectedCell?.col === c;
                  const highlighted = isHighlighted(r, c);
                  const cellState = cellStates[key];

                  return (
                    <div 
                      key={key}
                      className={`crossword-cell ${
                        cell.isActive ? 'active' : 'empty'
                      } ${highlighted ? 'highlighted' : ''} ${
                        isSelected ? 'selected' : ''
                      } ${cellState || ''}`}
                      data-row={r}
                      data-col={c}
                    >
                      {cell.isActive && (
                        <>
                          {cell.number && (
                            <span className="crossword-cell-number">{cell.number}</span>
                          )}
                          <input
                            ref={el => { inputRefs.current[key] = el; }}
                            type="text"
                            maxLength={1}
                            value={userInputs[key] || ''}
                            onChange={e => handleInput(r, c, e.target.value)}
                            onKeyDown={e => handleKeyDown(e, r, c)}
                            onClick={() => handleCellClick(r, c)}
                            onFocus={() => {
                              setSelectedCell({ row: r, col: c });
                              if (!currentSelection) {
                                const matchingWords = findWordsAtCell(r, c);
                                if (matchingWords.length > 0) {
                                  setCurrentSelection(matchingWords[0]);
                                }
                              }
                            }}
                          />
                        </>
                      )}
                    </div>
                  );
                })
              ))}
            </div>
            
            {toastMessage && (
              <div className="crossword-toast success">{toastMessage}</div>
            )}
          </div>

          <div className="crossword-clues-panel">
            <div className="crossword-clues-column">
              <h3>Across</h3>
              {acrossWords.map(w => (
                <div
                  key={`${w.word}-across`}
                  className={`crossword-clue-item ${
                    w.isGiftClue ? 'gift-clue' : ''
                  } ${
                    currentSelection?.word === w.word && currentSelection?.direction === 'across' 
                      ? 'selected' 
                      : ''
                  } ${
                    completedClues.has(`${w.word}-across`) ? 'completed' : ''
                  }`}
                  onClick={() => selectWord(w)}
                >
                  <span className="crossword-clue-num">{w.displayNumber}</span>
                  <span className="crossword-clue-text">{w.clue}</span>
                </div>
              ))}
            </div>
            <div className="crossword-clues-column">
              <h3>Down</h3>
              {downWords.map(w => (
                <div
                  key={`${w.word}-down`}
                  className={`crossword-clue-item ${
                    w.isGiftClue ? 'gift-clue' : ''
                  } ${
                    currentSelection?.word === w.word && currentSelection?.direction === 'down' 
                      ? 'selected' 
                      : ''
                  } ${
                    completedClues.has(`${w.word}-down`) ? 'completed' : ''
                  }`}
                  onClick={() => selectWord(w)}
                >
                  <span className="crossword-clue-num">{w.displayNumber}</span>
                  <span className="crossword-clue-text">{w.clue}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

