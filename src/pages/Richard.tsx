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
const initialTestCase: GameState = {
  rich: { x: 8000, y: 4500 },
  humans: [
    { id: 0, x: 2000, y: 2000, alive: true },
    { id: 1, x: 14000, y: 7000, alive: true },
    { id: 2, x: 5000, y: 6000, alive: true },
  ],
  zombies: [
    { id: 0, x: 3000, y: 3000, xNext: 0, yNext: 0, alive: true },
    { id: 1, x: 12000, y: 6000, xNext: 0, yNext: 0, alive: true },
    { id: 2, x: 6000, y: 1000, xNext: 0, yNext: 0, alive: true },
    { id: 3, x: 15000, y: 8000, xNext: 0, yNext: 0, alive: true },
  ],
  score: 0,
  turn: 0,
  gameOver: false,
  won: false,
  message: "",
};

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
  let closest = { x: rich.x, y: rich.y };
  let minDist = distance(zombie.x, zombie.y, rich.x, rich.y);

  for (const human of humans) {
    if (!human.alive) continue;
    const dist = distance(zombie.x, zombie.y, human.x, human.y);
    if (dist < minDist) {
      minDist = dist;
      closest = { x: human.x, y: human.y };
    }
  }

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

  // 4. Zombies eat any human they share coordinates with
  for (const zombie of newState.zombies) {
    if (!zombie.alive) continue;
    for (const human of newState.humans) {
      if (!human.alive) continue;
      const dist = distance(zombie.x, zombie.y, human.x, human.y);
      if (dist < ZOMBIE_SPEED) {
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
function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  targetX?: number,
  targetY?: number
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

  // Draw target line if exists
  if (targetX !== undefined && targetY !== undefined) {
    ctx.strokeStyle = "rgba(0, 255, 255, 0.5)";
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(state.rich.x * SCALE_X, state.rich.y * SCALE_Y);
    ctx.lineTo(targetX * SCALE_X, targetY * SCALE_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw humans
  for (const human of state.humans) {
    if (!human.alive) continue;
    ctx.fillStyle = "#00ff00";
    ctx.beginPath();
    ctx.arc(human.x * SCALE_X, human.y * SCALE_Y, 8, 0, Math.PI * 2);
    ctx.fill();

    // Human label
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px Arial";
    ctx.fillText(`H${human.id}`, human.x * SCALE_X - 8, human.y * SCALE_Y - 12);
  }

  // Draw zombies
  for (const zombie of state.zombies) {
    if (!zombie.alive) continue;
    ctx.fillStyle = "#ff4444";
    ctx.beginPath();
    ctx.arc(zombie.x * SCALE_X, zombie.y * SCALE_Y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Zombie direction indicator
    ctx.strokeStyle = "#ff8888";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(zombie.x * SCALE_X, zombie.y * SCALE_Y);
    ctx.lineTo(zombie.xNext * SCALE_X, zombie.yNext * SCALE_Y);
    ctx.stroke();

    // Zombie label
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px Arial";
    ctx.fillText(
      `Z${zombie.id}`,
      zombie.x * SCALE_X - 8,
      zombie.y * SCALE_Y - 14
    );
  }

  // Draw Rich
  ctx.fillStyle = "#00ffff";
  ctx.beginPath();
  ctx.arc(state.rich.x * SCALE_X, state.rich.y * SCALE_Y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Arial";
  ctx.fillText("RICH", state.rich.x * SCALE_X - 14, state.rich.y * SCALE_Y - 16);

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
- Zombies kill humans they land on
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
  userInstructions: string
): Promise<string> {
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
          content: `Write a getRichTarget function based on these instructions:\n\n${userInstructions}`,
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

// ============= MAIN COMPONENT =============
export default function Richard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [apiKey, setApiKey] = useState("");
  const [instructions, setInstructions] = useState(
    "Move towards the closest zombie that is threatening a human. Prioritize saving humans that are closest to being killed."
  );
  const [gameState, setGameState] = useState<GameState>(
    JSON.parse(JSON.stringify(initialTestCase))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [algorithm, setAlgorithm] = useState<
    ((state: GameState) => { x: number; y: number }) | null
  >(null);
  const [currentTarget, setCurrentTarget] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [status, setStatus] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");

  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Render game state
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    renderGame(ctx, gameState, currentTarget?.x, currentTarget?.y);
  }, [gameState, currentTarget]);

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
        setCurrentTarget(target);
        const newState = simulateTurn(gameState, target.x, target.y);
        setGameState(newState);

        if (!newState.gameOver) {
          animationRef.current = requestAnimationFrame(gameLoop);
        } else {
          setIsRunning(false);
          setStatus(newState.message);
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

  const handleGenerateAlgorithm = async () => {
    if (!apiKey) {
      setStatus("Please enter your Claude API key");
      return;
    }
    if (!instructions.trim()) {
      setStatus("Please enter instructions for the algorithm");
      return;
    }

    setStatus("Generating algorithm with Claude...");
    try {
      const code = await callClaudeAPI(apiKey, instructions);
      const cleanCode = cleanCodeFromMarkdown(code);
      setGeneratedCode(cleanCode);
      const algo = parseAlgorithm(code);
      setAlgorithm(() => algo);
      setStatus("Algorithm generated! Click Run to start.");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  const handleRun = () => {
    if (!algorithm) {
      setStatus("Generate an algorithm first!");
      return;
    }
    setIsRunning(true);
    setStatus("Running...");
  };

  const handlePause = () => {
    setIsRunning(false);
    setStatus("Paused");
  };

  const handleReset = () => {
    setIsRunning(false);
    setGameState(JSON.parse(JSON.stringify(initialTestCase)));
    setCurrentTarget(null);
    setStatus("Reset to initial state");
  };

  const handleStep = () => {
    if (!algorithm) {
      setStatus("Generate an algorithm first!");
      return;
    }
    if (gameState.gameOver) {
      setStatus("Game is over. Reset to play again.");
      return;
    }

    try {
      const target = algorithm(gameState);
      setCurrentTarget(target);
      const newState = simulateTurn(gameState, target.x, target.y);
      setGameState(newState);
      if (newState.gameOver) {
        setStatus(newState.message);
      }
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

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🧟 Vibe Code vs Zombies 🎮</h1>
      <p style={styles.subtitle}>
        Write natural language instructions and let Claude create your zombie-fighting algorithm!
      </p>

      <div style={styles.gameArea}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={styles.canvas}
        />

        <div style={styles.legend}>
          <span style={styles.legendItem}>
            <span style={{ ...styles.dot, backgroundColor: "#00ffff" }} /> Rich
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.dot, backgroundColor: "#00ff00" }} /> Humans
          </span>
          <span style={styles.legendItem}>
            <span style={{ ...styles.dot, backgroundColor: "#ff4444" }} /> Zombies
          </span>
        </div>
      </div>

      <div style={styles.controls}>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Claude API Key:</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Your Instructions (natural language):</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Describe how Rich should move to defeat zombies and save humans..."
            style={styles.textarea}
            rows={4}
          />
        </div>

        <div style={styles.buttonGroup}>
          <button onClick={handleGenerateAlgorithm} style={styles.button}>
            🤖 Generate Algorithm
          </button>
          <button
            onClick={isRunning ? handlePause : handleRun}
            style={styles.button}
          >
            {isRunning ? "⏸️ Pause" : "▶️ Run"}
          </button>
          <button onClick={handleStep} style={styles.button}>
            ⏭️ Step
          </button>
          <button onClick={handleReset} style={styles.button}>
            🔄 Reset
          </button>
        </div>

        {status && <div style={styles.status}>{status}</div>}

        {generatedCode && (
          <div style={styles.codeSection}>
            <label style={styles.label}>Generated Algorithm (editable):</label>
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
      </div>

      <div style={styles.rules}>
        <h3>📜 Game Rules</h3>
        <ul style={styles.rulesList}>
          <li>Rich moves 1000 units/turn, kills zombies within 2000 units</li>
          <li>Zombies move 400 units/turn towards nearest human</li>
          <li>Win: Kill all zombies with at least 1 human alive</li>
          <li>Score: (humans alive)² × 10 per zombie (Fibonacci bonus for combos!)</li>
        </ul>
      </div>
    </div>
  );
}

// ============= STYLES =============
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
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
    marginBottom: "1.5rem",
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
  },
  dot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    display: "inline-block",
  },
  controls: {
    backgroundColor: "#1a1a2e",
    padding: "20px",
    borderRadius: "8px",
    marginBottom: "1.5rem",
  },
  inputGroup: {
    marginBottom: "15px",
  },
  label: {
    display: "block",
    marginBottom: "5px",
    fontWeight: "bold",
    color: "#ccc",
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
  buttonGroup: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
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
  status: {
    marginTop: "15px",
    padding: "10px",
    backgroundColor: "#2a2a4e",
    borderRadius: "4px",
    color: "#00ffff",
  },
  codeSection: {
    marginTop: "15px",
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
  rules: {
    backgroundColor: "#1a1a2e",
    padding: "20px",
    borderRadius: "8px",
  },
  rulesList: {
    color: "#aaa",
    lineHeight: "1.8",
    paddingLeft: "20px",
  },
};
