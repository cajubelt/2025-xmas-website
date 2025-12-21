import { useState, useRef, useEffect, useCallback } from "react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/themes/prism-tomorrow.css";

// ============= TYPES =============
interface Human {
  id: number;
  x: number;
  y: number;
  alive: boolean;
  emoji: string;
}

interface Zombie {
  id: number;
  x: number;
  y: number;
  xNext: number;
  yNext: number;
  alive: boolean;
}

interface GameState {
  rich: { x: number; y: number };
  humans: Human[];
  zombies: Zombie[];
  score: number;
  turn: number;
  gameOver: boolean;
  won: boolean;
  message: string;
}

// ============= CONSTANTS =============
const GAME_WIDTH = 16000;
const GAME_HEIGHT = 9000;
const RICH_SPEED = 1000;
const RICH_RANGE = 2000;
const ZOMBIE_SPEED = 400;

// Canvas display scaling
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 450;
const SCALE_X = CANVAS_WIDTH / GAME_WIDTH;
const SCALE_Y = CANVAS_HEIGHT / GAME_HEIGHT;

// ============= HARDCODED TEST CASE =============
const getRandomHumanEmoji = () => Math.random() < 0.5 ? "🙍‍♂️" : "🙍‍♀️";

// Level configurations
interface LevelConfig {
  name: string;
  createInitialState: () => GameState;
  testAll?: boolean;
}

const LEVELS: LevelConfig[] = [
  {
    name: "Level 1",
    createInitialState: () => ({
      rich: { x: 7000, y: 1500 },
      humans: [
        { id: 0, x: 8000, y: 8500, alive: true, emoji: getRandomHumanEmoji() },
      ],
      zombies: [
        { id: 0, x: 2000, y: 500, xNext: 0, yNext: 0, alive: true },
        { id: 1, x: 1000, y: 2000, xNext: 0, yNext: 0, alive: true },
        { id: 2, x: 12000, y: 7000, xNext: 0, yNext: 0, alive: true },
      ],
      score: 0,
      turn: 0,
      gameOver: false,
      won: false,
      message: "",
    }),
  },
  {
    name: "Level 2",
    createInitialState: () => ({
      rich: { x: 8000, y: 4500 },
      humans: [
        { id: 0, x: 4000, y: 4500, alive: true, emoji: getRandomHumanEmoji() },
        { id: 1, x: 13000, y: 4500, alive: true, emoji: getRandomHumanEmoji() },
      ],
      zombies: [
        { id: 0, x: 3000, y: 4000, xNext: 0, yNext: 0, alive: true },
        { id: 1, x: 1000, y: 2000, xNext: 0, yNext: 0, alive: true },
        { id: 2, x: 12000, y: 7000, xNext: 0, yNext: 0, alive: true },
        { id: 3, x: 8000, y: 500, xNext: 0, yNext: 0, alive: true },
      ],
      score: 0,
      turn: 0,
      gameOver: false,
      won: false,
      message: "",
    }),
  },
  {
    name: "Level 3",
    createInitialState: () => ({
      rich: { x: 6000, y: 4500 },
      humans: [
        { id: 0, x: 2000, y: 4500, alive: true, emoji: getRandomHumanEmoji() },
        { id: 1, x: 11000, y: 6000, alive: true, emoji: getRandomHumanEmoji() },
        { id: 1, x: 13000, y: 2000, alive: true, emoji: getRandomHumanEmoji() },

      ],
      zombies: [
        { id: 0, x: 3000, y: 4000, xNext: 0, yNext: 0, alive: true },
        { id: 1, x: 2000, y: 5500, xNext: 0, yNext: 0, alive: true },
        { id: 2, x: 13000, y: 7000, xNext: 0, yNext: 0, alive: true },
        { id: 3, x: 15000, y: 1000, xNext: 0, yNext: 0, alive: true },

      ],
      score: 0,
      turn: 0,
      gameOver: false,
      won: false,
      message: "",
    }),
  },
  {
    name: "Level 4",
    createInitialState: () => ({
      rich: { x: 10000, y: 4500 },
      humans: [
        { id: 0, x: 14000, y: 4500, alive: true, emoji: getRandomHumanEmoji() },
        { id: 1, x: 5000, y: 6000, alive: true, emoji: getRandomHumanEmoji() },
        { id: 2, x: 3000, y: 2000, alive: true, emoji: getRandomHumanEmoji() },

      ],
      zombies: [
        { id: 0, x: 13000, y: 4000, xNext: 0, yNext: 0, alive: true },
        { id: 1, x: 14000, y: 5500, xNext: 0, yNext: 0, alive: true },
        { id: 2, x: 3000, y: 7000, xNext: 0, yNext: 0, alive: true },
        { id: 3, x: 1000, y: 1000, xNext: 0, yNext: 0, alive: true },

      ],
      score: 0,
      turn: 0,
      gameOver: false,
      won: false,
      message: "",
    }),
  },
  {
    name: "Test All",
    createInitialState: () => ({
      rich: { x: 0, y: 0 },
      humans: [],
      zombies: [],
      score: 0,
      turn: 0,
      gameOver: false,
      won: false,
      message: "",
    }),
    testAll: true,
  },
];

// Configuration designed so that default strategy loses, but simple strategies can still win (e.g. move towards closest human)
const initialTestCase: GameState = LEVELS[0].createInitialState();

// ============= GAME LOGIC =============
function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function moveTowards(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  speed: number
): { x: number; y: number } {
  const dist = distance(fromX, fromY, toX, toY);
  if (dist <= speed) {
    return { x: toX, y: toY };
  }
  const ratio = speed / dist;
  return {
    x: Math.floor(fromX + (toX - fromX) * ratio),
    y: Math.floor(fromY + (toY - fromY) * ratio),
  };
}

function findClosestHuman(
  zombie: Zombie,
  humans: Human[],
  rich: { x: number; y: number }
): { x: number; y: number } {
  let closest: { x: number; y: number } = { x: rich.x, y: rich.y };
  let minDist = distance(zombie.x, zombie.y, rich.x, rich.y);

  for (const human of humans) {
    if (!human.alive) continue;
    const dist = distance(zombie.x, zombie.y, human.x, human.y);
    if (dist < minDist) {
      minDist = dist;
      closest = { x: human.x, y: human.y };
    }
  }

  // Target whichever is closest: Rich or a human
  return closest;
}

function fibonacci(n: number): number {
  const fibs = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return fibs[Math.min(n, fibs.length - 1)];
}

function simulateTurn(
  state: GameState,
  targetX: number,
  targetY: number
): GameState {
  const newState: GameState = JSON.parse(JSON.stringify(state));
  newState.turn++;

  // 1. Zombies move towards their targets
  for (const zombie of newState.zombies) {
    if (!zombie.alive) continue;
    const target = findClosestHuman(zombie, newState.humans, newState.rich);
    const newPos = moveTowards(
      zombie.x,
      zombie.y,
      target.x,
      target.y,
      ZOMBIE_SPEED
    );
    zombie.x = newPos.x;
    zombie.y = newPos.y;
  }

  // 2. Rich moves towards his target
  const richNewPos = moveTowards(
    newState.rich.x,
    newState.rich.y,
    targetX,
    targetY,
    RICH_SPEED
  );
  newState.rich.x = richNewPos.x;
  newState.rich.y = richNewPos.y;

  // 3. Any zombie within range of Rich is destroyed
  const aliveHumans = newState.humans.filter((h) => h.alive).length;
  let zombiesKilledThisTurn = 0;

  for (const zombie of newState.zombies) {
    if (!zombie.alive) continue;
    const dist = distance(newState.rich.x, newState.rich.y, zombie.x, zombie.y);
    if (dist <= RICH_RANGE) {
      zombie.alive = false;
      zombiesKilledThisTurn++;
      // Score: humans² × 10 × fibonacci multiplier
      const baseScore = aliveHumans * aliveHumans * 10;
      const fibMultiplier = fibonacci(zombiesKilledThisTurn - 1);
      newState.score += baseScore * fibMultiplier;
    }
  }

  // 4. Zombies eat any human they are within 400 units of
  for (const zombie of newState.zombies) {
    if (!zombie.alive) continue;
    for (const human of newState.humans) {
      if (!human.alive) continue;
      const dist = distance(zombie.x, zombie.y, human.x, human.y);
      if (dist <= 400) {
        human.alive = false;
      }
    }
  }

  // Update zombie next positions
  for (const zombie of newState.zombies) {
    if (!zombie.alive) continue;
    const target = findClosestHuman(zombie, newState.humans, newState.rich);
    const nextPos = moveTowards(
      zombie.x,
      zombie.y,
      target.x,
      target.y,
      ZOMBIE_SPEED
    );
    zombie.xNext = nextPos.x;
    zombie.yNext = nextPos.y;
  }

  // Check win/lose conditions
  const remainingHumans = newState.humans.filter((h) => h.alive).length;
  const remainingZombies = newState.zombies.filter((z) => z.alive).length;

  if (remainingZombies === 0 && remainingHumans > 0) {
    newState.gameOver = true;
    newState.won = true;
    newState.message = `Victory! Score: ${newState.score}`;
  } else if (remainingHumans === 0) {
    newState.gameOver = true;
    newState.won = false;
    newState.message = "Game Over - All humans died!";
  }

  return newState;
}

// ============= CANVAS RENDERING =============
// Preload Rich's image
const richImage = new Image();
richImage.src = "/rich calm face.png";

// Process image to remove white background
let processedRichImage: HTMLCanvasElement | null = null;

richImage.onload = () => {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = richImage.width;
  tempCanvas.height = richImage.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  if (tempCtx) {
    tempCtx.drawImage(richImage, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    
    // Make white pixels transparent
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // If pixel is white (or very close to white), make it transparent
      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0; // Set alpha to 0
      }
    }
    
    tempCtx.putImageData(imageData, 0, 0);
    processedRichImage = tempCanvas;
  }
};

function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState
) {
  // Clear canvas
  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw grid
  ctx.strokeStyle = "#2a2a4e";
  ctx.lineWidth = 1;
  for (let x = 0; x <= GAME_WIDTH; x += 2000) {
    ctx.beginPath();
    ctx.moveTo(x * SCALE_X, 0);
    ctx.lineTo(x * SCALE_X, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= GAME_HEIGHT; y += 1500) {
    ctx.beginPath();
    ctx.moveTo(0, y * SCALE_Y);
    ctx.lineTo(CANVAS_WIDTH, y * SCALE_Y);
    ctx.stroke();
  }

  // Draw Rich's range
  ctx.strokeStyle = "rgba(0, 255, 255, 0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(
    state.rich.x * SCALE_X,
    state.rich.y * SCALE_Y,
    RICH_RANGE * SCALE_X,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  // Draw humans
  for (const human of state.humans) {
    const emoji = human.alive ? human.emoji : "❌";
    
    // Draw human emoji (or red X if dead)
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, human.x * SCALE_X, human.y * SCALE_Y);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // Draw zombies
  for (const zombie of state.zombies) {
    const emoji = zombie.alive ? "🧟" : "🪦";
    
    // Draw zombie emoji (or tombstone if dead)
    ctx.font = "24px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, zombie.x * SCALE_X, zombie.y * SCALE_Y);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // Draw Rich
  const richX = state.rich.x * SCALE_X;
  const richY = state.rich.y * SCALE_Y;
  
  if (processedRichImage) {
    // Calculate dimensions preserving aspect ratio
    const targetHeight = 40; // Base height
    const aspectRatio = processedRichImage.width / processedRichImage.height;
    const richWidth = targetHeight * aspectRatio;
    const richHeight = targetHeight;
    
    // Draw the processed image (with transparent background) centered on Rich's position
    ctx.drawImage(
      processedRichImage, 
      richX - richWidth / 2, 
      richY - richHeight / 2, 
      richWidth, 
      richHeight
    );
  } else {
    // Fallback to cyan dot while image is loading
    ctx.fillStyle = "#00ffff";
    ctx.beginPath();
    ctx.arc(richX, richY, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Label
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Arial";
  ctx.fillText("RICH", richX - 14, richY - 26);

  // Draw HUD
  ctx.fillStyle = "#ffffff";
  ctx.font = "14px Arial";
  ctx.fillText(`Turn: ${state.turn}`, 10, 20);
  ctx.fillText(`Score: ${state.score}`, 10, 40);
  ctx.fillText(
    `Humans: ${state.humans.filter((h) => h.alive).length}`,
    10,
    60
  );
  ctx.fillText(
    `Zombies: ${state.zombies.filter((z) => z.alive).length}`,
    10,
    80
  );

  // Draw game over message
  if (state.gameOver) {
    ctx.fillStyle = state.won
      ? "rgba(0, 255, 0, 0.8)"
      : "rgba(255, 0, 0, 0.8)";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(state.message, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.textAlign = "left";
  }
}

// ============= CLAUDE API INTEGRATION =============
const SYSTEM_PROMPT = `You are a game AI programmer. You will write JavaScript code to control "Rich" in a zombie survival game.

GAME RULES:
- Game zone: 16000 units wide × 9000 units high
- Rich moves 1000 units per turn towards target
- Rich kills zombies within 2000 units at end of turn
- Zombies move 400 units per turn towards nearest human (including Rich)
- Zombies kill humans they are within 400 units of
- Win: Destroy all zombies with at least 1 human alive
- Lose: All humans (except Rich) die

SCORING:
- Per zombie: (alive humans)² × 10
- Multiple kills same turn: Fibonacci multiplier (1, 2, 3, 5, 8...)

YOUR TASK:
Write a JavaScript function that takes the game state and returns {x, y} coordinates for Rich to move towards.

Function signature:
\`\`\`javascript
function getRichTarget(state) {
  // state.rich = {x, y}
  // state.humans = [{id, x, y, alive}, ...]
  // state.zombies = [{id, x, y, xNext, yNext, alive}, ...]
  // state.score, state.turn
  
  // Return: {x: number, y: number}
}
\`\`\`

Helper you can use:
- distance(x1, y1, x2, y2) - returns euclidean distance

IMPORTANT: Return ONLY the function code, no explanations. The function must be valid JavaScript.`;

async function callClaudeAPI(
  apiKey: string,
  userInstructions: string,
  existingAlgorithm?: string
): Promise<string> {
  let userContent: string;
  
  if (existingAlgorithm) {
    userContent = `Here is the existing algorithm:

\`\`\`javascript
${existingAlgorithm}
\`\`\`

Based on the following instructions, you can either update the existing algorithm or write a new one from scratch - whatever best fulfills the request:

${userInstructions}`;
  } else {
    userContent = `Write a getRichTarget function based on these instructions:\n\n${userInstructions}`;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

function cleanCodeFromMarkdown(code: string): string {
  // Extract function from code block if present
  const codeBlockMatch = code.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  return code.trim();
}

function parseAlgorithm(
  code: string
): (state: GameState) => { x: number; y: number } {
  const cleanCode = cleanCodeFromMarkdown(code);

  // Create function with distance helper available
  const wrappedCode = `
    const distance = (x1, y1, x2, y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2);
    ${cleanCode}
    return getRichTarget;
  `;

  try {
    const factory = new Function(wrappedCode);
    return factory();
  } catch (e) {
    console.error("Failed to parse algorithm:", e);
    throw new Error(`Invalid algorithm code: ${e}`);
  }
}

// ============= TEST SCRIPT =============
const TEST_SCRIPT = `function getRichTarget(state) {
  const aliveHumans = state.humans.filter(h => h.alive);
  const aliveZombies = state.zombies.filter(z => z.alive);
  
  if (aliveZombies.length === 0) {
    return {x: state.rich.x, y: state.rich.y};
  }
  
  let bestTarget = null;
  let minDistanceToHuman = Infinity;
  
  for (const human of aliveHumans) {
    const distRichToHuman = distance(state.rich.x, state.rich.y, human.x, human.y);
    
    // Find the most threatening zombie for this human
    let minTurnsToKillHuman = Infinity;
    let threateningZombie = null;
    
    for (const zombie of aliveZombies) {
      const distZombieToHuman = distance(zombie.x, zombie.y, human.x, human.y);
      const turnsToKillHuman = Math.floor((distZombieToHuman - 400) / 400);
      
      if (turnsToKillHuman < minTurnsToKillHuman) {
        minTurnsToKillHuman = turnsToKillHuman;
        threateningZombie = zombie;
      }
    }
    
    if (threateningZombie) {
      // Calculate turns for Rich to reach the human (to defend them)
      const turnsToReachHuman = Math.floor((distRichToHuman - 2000) / 1000);
      
      // Check if this human is saveable and closer than previous best
      if (turnsToReachHuman <= minTurnsToKillHuman && distRichToHuman < minDistanceToHuman) {
        minDistanceToHuman = distRichToHuman;
        bestTarget = human;
      }
    }
  }
  
  // If no saveable human found, go for closest zombie
  if (!bestTarget) {
  throw new Error('no saveable human')
    let minDistance = Infinity;
    for (const zombie of aliveZombies) {
      const dist = distance(state.rich.x, state.rich.y, zombie.x, zombie.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestTarget = zombie;
      }
    }
  }
  
  return bestTarget ? {x: bestTarget.x, y: bestTarget.y} : {x: state.rich.x, y: state.rich.y};
}`;

// ============= MAIN COMPONENT =============
export default function Richard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Check for API key and test mode in query parameters
  const getApiKeyFromQuery = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("apiKey") || params.get("api_key") || "";
  };
  
  const isTestMode = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("test") === "true";
  };
  
  const queryApiKey = getApiKeyFromQuery();
  const [apiKeyInput, setApiKeyInput] = useState(queryApiKey);
  const [apiKeySaved, setApiKeySaved] = useState(!!queryApiKey);
  const [savedApiKey, setSavedApiKey] = useState(queryApiKey);
  const [instructions, setInstructions] = useState(
    ""
  );
  const [gameState, setGameState] = useState<GameState>(
    JSON.parse(JSON.stringify(initialTestCase))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [algorithm, setAlgorithm] = useState<
    ((state: GameState) => { x: number; y: number }) | null
  >(null);
  const [status, setStatus] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [lastGeneratedInstructions, setLastGeneratedInstructions] = useState("");
  
  // Level management
  const [currentLevel, setCurrentLevel] = useState(0);
  const [completedLevels, setCompletedLevels] = useState<Set<number>>(new Set());
  
  // Test mode results (for Level 4 "Test All")
  const [testResults, setTestResults] = useState<(boolean | null)[]>([null, null, null, null]);

  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Initialize test mode if enabled
  useEffect(() => {
    if (isTestMode()) {
      try {
        setGeneratedCode(TEST_SCRIPT);
        const algo = parseAlgorithm(TEST_SCRIPT);
        setAlgorithm(() => algo);
        setStatus("Test mode enabled - prepopulated algorithm loaded!");
      } catch (e) {
        setStatus(`Error loading test script: ${e}`);
      }
    }
  }, []);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setSavedApiKey(apiKeyInput.trim());
      setApiKeySaved(true);
    }
  };

  // Render game state
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderGame(ctx, gameState);
  }, [gameState]);

  // Game loop
  const gameLoop = useCallback(
    (timestamp: number) => {
      if (!algorithm || gameState.gameOver) {
        setIsRunning(false);
        return;
      }

      // Update every 500ms
      if (timestamp - lastUpdateRef.current < 500) {
        animationRef.current = requestAnimationFrame(gameLoop);
        return;
      }
      lastUpdateRef.current = timestamp;

      try {
        const target = algorithm(gameState);
        const newState = simulateTurn(gameState, target.x, target.y);
        setGameState(newState);

        if (!newState.gameOver) {
          animationRef.current = requestAnimationFrame(gameLoop);
        } else {
          setIsRunning(false);
        }
      } catch (e) {
        setStatus(`Algorithm error: ${e}`);
        setIsRunning(false);
      }
    },
    [algorithm, gameState]
  );

  useEffect(() => {
    if (isRunning && algorithm) {
      animationRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning, algorithm, gameLoop]);

  // Mark level as completed when game is won
  useEffect(() => {
    if (gameState.gameOver && gameState.won && !completedLevels.has(currentLevel)) {
      setCompletedLevels(prev => new Set([...prev, currentLevel]));
    }
  }, [gameState.gameOver, gameState.won, currentLevel, completedLevels]);

  const handleGenerateAlgorithm = async () => {
    if (!savedApiKey) {
      setStatus("Please enter your Claude API key");
      return;
    }
    if (!instructions.trim()) {
      setStatus("Please enter instructions for the algorithm");
      return;
    }

    setStatus("Generating algorithm with Claude...");
    try {
      const existingCode = generatedCode ? generatedCode : undefined;
      const code = await callClaudeAPI(savedApiKey, instructions, existingCode);
      const cleanCode = cleanCodeFromMarkdown(code);
      setGeneratedCode(cleanCode);
      const algo = parseAlgorithm(code);
      setAlgorithm(() => algo);
      setLastGeneratedInstructions(instructions);
      setStatus(existingCode ? "Algorithm updated! Click Run to start." : "Algorithm generated! Click Run to start.");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  // Run a single test case to completion and return whether it was won
  const runTestCase = (initialState: GameState): boolean => {
    if (!algorithm) return false;
    
    let state = JSON.parse(JSON.stringify(initialState));
    const maxTurns = 200; // Safety limit
    
    while (!state.gameOver && state.turn < maxTurns) {
      try {
        const target = algorithm(state);
        state = simulateTurn(state, target.x, target.y);
      } catch {
        return false;
      }
    }
    
    return state.won;
  };
  
  // Run all test cases for "Test All" level
  const runAllTests = () => {
    if (!algorithm) return;
    
    const testCases = [
      LEVELS[0].createInitialState(),
      LEVELS[1].createInitialState(),
      LEVELS[2].createInitialState(),
      LEVELS[3].createInitialState(),
    ];
    
    const results = testCases.map(testCase => runTestCase(testCase));
    setTestResults(results);
    
    // If all tests pass, mark "Test All" level (index 4) as completed
    if (results.every(r => r)) {
      setCompletedLevels(prev => new Set([...prev, 4]));
    }
  };

  const handleRun = () => {
    if (!algorithm) return;
    
    // Special handling for Level 4 (Test All)
    if (LEVELS[currentLevel].testAll) {
      runAllTests();
      return;
    }
    
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setGameState(LEVELS[currentLevel].createInitialState());
  };

  const handleLevelSelect = (levelIndex: number) => {
    // Can only select: current level, completed levels, or the next level if current is completed
    const canSelect = 
      levelIndex === currentLevel ||
      completedLevels.has(levelIndex) ||
      (levelIndex === currentLevel + 1 && completedLevels.has(currentLevel));
    
    if (!canSelect) return;
    
    setIsRunning(false);
    setCurrentLevel(levelIndex);
    setGameState(LEVELS[levelIndex].createInitialState());
    
    // Reset test results when switching to Test All level
    if (levelIndex === 4) {
      setTestResults([null, null, null, null]);
    }
  };

  const handleStep = () => {
    if (!algorithm || gameState.gameOver) return;

    try {
      const target = algorithm(gameState);
      const newState = simulateTurn(gameState, target.x, target.y);
      setGameState(newState);
    } catch (e) {
      setStatus(`Algorithm error: ${e}`);
    }
  };

  const handleCodeChange = (newCode: string) => {
    setGeneratedCode(newCode);
    try {
      const algo = parseAlgorithm(newCode);
      setAlgorithm(() => algo);
      setStatus("Algorithm updated!");
    } catch (e) {
      setStatus(`Invalid algorithm: ${e}`);
    }
  };

  // Check if game is in initial state (new or freshly reset)
  const isInitialState = () => {
    return gameState.turn === 0 && 
           gameState.score === 0 && 
           !gameState.gameOver;
  };

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarContent}>
          <h2 style={styles.sidebarTitle}>🎯 Strategy</h2>
          
          {!apiKeySaved ? (
            /* API Key Entry Form */
            <div style={styles.sidebarSection}>
              <label style={styles.label}>Claude API Key:</label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-..."
                style={styles.input}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              />
              <button 
                onClick={handleSaveApiKey}
                style={{
                  ...styles.button,
                  ...styles.fullWidthButton,
                  marginTop: "10px",
                  ...(apiKeyInput.trim() ? {} : styles.buttonDisabled)
                }}
                disabled={!apiKeyInput.trim()}
              >
                💾 Save API Key
              </button>
              <p style={styles.hint}>
                Enter your Claude API key to start generating algorithms.
              </p>
            </div>
          ) : (
            /* Instructions and Algorithm Section */
            <>
              <div style={styles.sidebarSection}>
                <label style={styles.label}>Your Instructions:</label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Describe how Rich should move to defeat zombies and save humans..."
                  style={styles.textarea}
                  rows={4}
                />
                <button 
                  onClick={handleGenerateAlgorithm} 
                  style={{
                    ...styles.button,
                    ...styles.fullWidthButton,
                    marginTop: "10px",
                    ...(instructions === lastGeneratedInstructions ? styles.buttonDisabled : {})
                  }}
                  disabled={instructions === lastGeneratedInstructions}
                >
                  {generatedCode ? "🤖 Update Algorithm" : "🤖 Generate Algorithm"}
                </button>
              </div>

              {status && <div style={styles.status}>{status}</div>}

              {generatedCode && (
                <div style={styles.sidebarSection}>
                  <label style={styles.label}>Generated Algorithm:</label>
                  <div style={styles.editorWrapper}>
                    <Editor
                      value={generatedCode}
                      onValueChange={handleCodeChange}
                      highlight={(code) =>
                        Prism.highlight(code, Prism.languages.javascript, "javascript")
                      }
                      padding={15}
                      style={styles.editor}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        <div style={styles.container}>
          <h1 style={styles.title}>🧟 Richard vs Zombies 🎮</h1>
          <p style={styles.subtitle}>
            Team up with Claude to guide Rich towards victory in a battle against zombies.
          </p>

          <div style={styles.gameArea}>
            {LEVELS[currentLevel].testAll ? (
              /* Test All Mode - Show test results */
              <div style={styles.testResultsContainer}>
                <div style={styles.testResultsBox}>
                  <h3 style={styles.testResultsTitle}>Algorithm Test Results</h3>
                  <p style={styles.testResultsSubtitle}>
                    Run your algorithm against all levels to verify it works
                  </p>
                  <div style={styles.testResultsEmojis}>
                    {testResults.map((result, index) => (
                      <div key={index} style={styles.testResultItem}>
                        <span style={styles.testResultEmoji}>
                          {result === null ? "⬜" : result ? "✅" : "❌"}
                        </span>
                        <span style={styles.testResultLabel}>
                          Level {index + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                  {testResults.every(r => r === true) && (
                    <div style={styles.testResultsSuccess}>
                      🎉 All tests passed! Your algorithm is solid!
                    </div>
                  )}
                  {testResults.some(r => r === false) && (
                    <div style={styles.testResultsFailure}>
                      Some tests failed. Refine your algorithm and try again.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Normal Game Mode */
              <>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  style={styles.canvas}
                />

                <div style={styles.legend}>
                  <span style={styles.legendItem}>
                    <span style={styles.emojiLegend}>🙍 / ❌</span> Humans
                  </span>
                  <span style={styles.legendItem}>
                    <span style={styles.emojiLegend}>🧟 / 🪦</span> Zombies
                  </span>
                </div>
              </>
            )}

            {/* Game Controls - directly beneath the game board */}
            <div style={styles.gameControls}>
              {LEVELS[currentLevel].testAll ? (
                /* Test All Mode Controls */
                <button
                  onClick={handleRun}
                  style={{
                    ...styles.button,
                    ...(!algorithm ? styles.buttonDisabled : {})
                  }}
                  disabled={!algorithm}
                >
                  🧪 Run Tests
                </button>
              ) : (
                /* Normal Game Controls */
                <>
                  <button
                    onClick={isRunning ? handlePause : handleRun}
                    style={{
                      ...styles.button,
                      ...((gameState.gameOver || (!isRunning && !algorithm)) ? styles.buttonDisabled : {})
                    }}
                    disabled={gameState.gameOver || (!isRunning && !algorithm)}
                  >
                    {isRunning ? "⏸️ Pause" : "▶️ Run"}
                  </button>
                  <button 
                    onClick={handleStep} 
                    style={{
                      ...styles.button,
                      ...((!algorithm || gameState.gameOver) ? styles.buttonDisabled : {})
                    }}
                    disabled={!algorithm || gameState.gameOver}
                  >
                    ⏭️ Step
                  </button>
                  <button 
                    onClick={handleReset} 
                    style={{
                      ...styles.button,
                      ...(isInitialState() ? styles.buttonDisabled : {})
                    }}
                    disabled={isInitialState()}
                  >
                    🔄 Reset
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Levels */}
      <div style={styles.rightSidebar}>
        <div style={styles.sidebarContent}>
          <h2 style={styles.sidebarTitle}>📊 Levels</h2>
          <div style={styles.levelsContainer}>
            {LEVELS.map((level, index) => {
              const isCompleted = completedLevels.has(index);
              const isCurrent = index === currentLevel;
              const isUnlocked = 
                index === 0 || 
                completedLevels.has(index) || 
                completedLevels.has(index - 1);
              const canClick = isCurrent || isCompleted || (index === currentLevel + 1 && completedLevels.has(currentLevel));

              return (
                <div
                  key={index}
                  onClick={() => handleLevelSelect(index)}
                  style={{
                    ...styles.levelItem,
                    ...(isCurrent ? styles.levelItemCurrent : {}),
                    ...(isCompleted ? styles.levelItemCompleted : {}),
                    ...(!isUnlocked ? styles.levelItemLocked : {}),
                    ...(canClick ? styles.levelItemClickable : {}),
                  }}
                >
                  <div style={styles.levelHeader}>
                    <span style={styles.levelName}>
                      {isCompleted && "✅ "}
                      {level.name}
                    </span>
                    {isCurrent && <span style={styles.currentBadge}>Current</span>}
                  </div>
                  {!isUnlocked && (
                    <div style={styles.lockedText}>🔒 Complete previous level to unlock</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= STYLES =============
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    width: "100%",
    boxSizing: "border-box",
    backgroundColor: "#070812",
    backgroundImage: [
      "radial-gradient(700px 420px at 15% 10%, rgba(0, 255, 255, 0.10), rgba(0, 255, 255, 0) 60%)",
      "radial-gradient(700px 420px at 85% 90%, rgba(255, 68, 68, 0.08), rgba(255, 68, 68, 0) 60%)",
      "radial-gradient(900px 600px at 50% 40%, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0) 55%)",
      "repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.022) 0px, rgba(255, 255, 255, 0.022) 1px, rgba(255, 255, 255, 0) 1px, rgba(255, 255, 255, 0) 72px)",
      "repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.018) 0px, rgba(255, 255, 255, 0.018) 1px, rgba(255, 255, 255, 0) 1px, rgba(255, 255, 255, 0) 72px)",
    ].join(", "),
    backgroundAttachment: "fixed",
    display: "flex",
  },
  sidebar: {
    width: "33.333%",
    minWidth: "280px",
    maxWidth: "400px",
    height: "100vh",
    backgroundColor: "rgba(10, 10, 20, 0.7)",
    borderRight: "1px solid rgba(255, 255, 255, 0.1)",
    overflowY: "auto",
    flexShrink: 0,
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  sidebarContent: {
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  sidebarTitle: {
    fontSize: "1.25rem",
    color: "#fff",
    marginBottom: "20px",
    paddingBottom: "10px",
    borderBottom: "1px solid #333",
  },
  sidebarSection: {
    marginBottom: "20px",
  },
  mainContent: {
    flex: 1,
    padding: "32px 16px",
    display: "flex",
    justifyContent: "center",
    overflowY: "auto",
    height: "100vh",
  },
  container: {
    maxWidth: "900px",
    width: "100%",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    borderRadius: "14px",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    background: "rgba(10, 10, 20, 0.35)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow:
      "0 18px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 255, 255, 0.03) inset",
  },
  title: {
    textAlign: "center",
    fontSize: "2.5rem",
    marginBottom: "0.5rem",
    background: "linear-gradient(135deg, #00ffff, #ff4444)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    textAlign: "center",
    color: "#888",
    marginBottom: "1.5rem",
  },
  gameArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  canvas: {
    border: "2px solid #333",
    borderRadius: "8px",
    maxWidth: "100%",
  },
  legend: {
    display: "flex",
    gap: "20px",
    marginTop: "10px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "14px",
    color: "#ccc",
  },
  emojiLegend: {
    fontSize: "18px",
    display: "inline-block",
  },
  gameControls: {
    display: "flex",
    gap: "10px",
    marginTop: "15px",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  label: {
    display: "block",
    marginBottom: "5px",
    fontWeight: "bold",
    color: "#ccc",
    fontSize: "14px",
  },
  input: {
    width: "100%",
    padding: "10px",
    borderRadius: "4px",
    border: "1px solid #444",
    backgroundColor: "#2a2a4e",
    color: "#fff",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    padding: "10px",
    borderRadius: "4px",
    border: "1px solid #444",
    backgroundColor: "#2a2a4e",
    color: "#fff",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  button: {
    padding: "10px 20px",
    borderRadius: "4px",
    border: "none",
    backgroundColor: "#4a4a8e",
    color: "#fff",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  fullWidthButton: {
    width: "100%",
  },
  buttonDisabled: {
    backgroundColor: "#2a2a3e",
    color: "#666",
    cursor: "not-allowed",
    opacity: 0.6,
  },
  status: {
    marginBottom: "15px",
    padding: "10px",
    backgroundColor: "rgba(0, 255, 255, 0.1)",
    borderRadius: "4px",
    border: "1px solid rgba(0, 255, 255, 0.3)",
    color: "#00ffff",
    fontSize: "13px",
  },
  editorWrapper: {
    backgroundColor: "#1d1f21",
    borderRadius: "4px",
    border: "1px solid #444",
    overflow: "auto",
    maxHeight: "300px",
  },
  editor: {
    fontFamily: '"Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
    fontSize: "13px",
    lineHeight: "1.5",
    minHeight: "100px",
  },
  hint: {
    fontSize: "12px",
    color: "#666",
    marginTop: "10px",
    fontStyle: "italic",
  },
  rightSidebar: {
    width: "200px",
    minWidth: "180px",
    height: "100vh",
    backgroundColor: "rgba(10, 10, 20, 0.7)",
    borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
    overflowY: "auto",
    flexShrink: 0,
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  levelsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  levelItem: {
    padding: "12px",
    borderRadius: "8px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    transition: "all 0.2s ease",
  },
  levelItemCurrent: {
    backgroundColor: "rgba(0, 255, 255, 0.15)",
    border: "1px solid rgba(0, 255, 255, 0.4)",
    boxShadow: "0 0 10px rgba(0, 255, 255, 0.2)",
  },
  levelItemCompleted: {
    backgroundColor: "rgba(0, 255, 0, 0.1)",
    border: "1px solid rgba(0, 255, 0, 0.3)",
  },
  levelItemLocked: {
    opacity: 0.5,
  },
  levelItemClickable: {
    cursor: "pointer",
  },
  levelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  levelName: {
    fontSize: "14px",
    fontWeight: "bold",
    color: "#fff",
  },
  currentBadge: {
    fontSize: "10px",
    padding: "2px 6px",
    borderRadius: "4px",
    backgroundColor: "rgba(0, 255, 255, 0.3)",
    color: "#00ffff",
    fontWeight: "bold",
  },
  lockedText: {
    fontSize: "11px",
    color: "#666",
    marginTop: "4px",
    fontStyle: "italic",
  },
  testResultsContainer: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid #333",
    borderRadius: "8px",
    backgroundColor: "#1a1a2e",
  },
  testResultsBox: {
    textAlign: "center",
    padding: "40px",
  },
  testResultsTitle: {
    fontSize: "1.5rem",
    color: "#fff",
    marginBottom: "10px",
  },
  testResultsSubtitle: {
    fontSize: "14px",
    color: "#888",
    marginBottom: "30px",
  },
  testResultsEmojis: {
    display: "flex",
    justifyContent: "center",
    gap: "30px",
    marginBottom: "30px",
  },
  testResultItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  testResultEmoji: {
    fontSize: "4rem",
  },
  testResultLabel: {
    fontSize: "12px",
    color: "#888",
  },
  testResultsSuccess: {
    padding: "15px 25px",
    backgroundColor: "rgba(0, 255, 0, 0.15)",
    border: "1px solid rgba(0, 255, 0, 0.4)",
    borderRadius: "8px",
    color: "#00ff00",
    fontSize: "16px",
    fontWeight: "bold",
  },
  testResultsFailure: {
    padding: "15px 25px",
    backgroundColor: "rgba(255, 68, 68, 0.15)",
    border: "1px solid rgba(255, 68, 68, 0.4)",
    borderRadius: "8px",
    color: "#ff4444",
    fontSize: "14px",
  },
};
