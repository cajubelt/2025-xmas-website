import { useState, useMemo } from "react";

interface Group {
  name: string;
  words: string[];
  color: string;
  bgColor: string;
}

const GROUPS: Group[] = [
  {
    name: "Reindeer Names",
    words: ["comet", "cupid", "donner", "blitzen"],
    color: "#000",
    bgColor: "#f9df6d", // yellow
  },
  {
    name: "Christmas Song Titles",
    words: ["bells", "night", "joy", "frosty"],
    color: "#000",
    bgColor: "#a0c35a", // green
  },
  {
    name: "Winter Clothing",
    words: ["scarf", "gloves", "boots", "sweater"],
    color: "#fff",
    bgColor: "#b0c4ef", // blue
  },
  {
    name: "Tammy's Gifts",
    words: ["mug", "cap", "prints", "bag"],
    color: "#fff",
    bgColor: "#ba81c5", // purple
  },
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function Tammy() {
  const initialWords = useMemo(
    () => shuffleArray(GROUPS.flatMap((g) => g.words)),
    []
  );

  const [remainingWords, setRemainingWords] = useState<string[]>(initialWords);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [solvedGroups, setSolvedGroups] = useState<Group[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [shakeWords, setShakeWords] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const maxMistakes = 4;
  const isGameOver = mistakes >= maxMistakes;
  const isWinner = solvedGroups.length === GROUPS.length;

  const handleWordClick = (word: string) => {
    if (isGameOver || isWinner) return;

    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter((w) => w !== word));
    } else if (selectedWords.length < 4) {
      setSelectedWords([...selectedWords, word]);
    }
    setMessage(null);
  };

  const handleSubmit = () => {
    if (selectedWords.length !== 4) return;

    const matchingGroup = GROUPS.find(
      (group) =>
        !solvedGroups.includes(group) &&
        selectedWords.every((word) => group.words.includes(word))
    );

    if (matchingGroup) {
      setSolvedGroups([...solvedGroups, matchingGroup]);
      setRemainingWords(
        remainingWords.filter((w) => !selectedWords.includes(w))
      );
      setSelectedWords([]);
      setMessage(null);
    } else {
      // Check if 3 out of 4 are correct
      const almostGroup = GROUPS.find(
        (group) =>
          !solvedGroups.includes(group) &&
          selectedWords.filter((word) => group.words.includes(word)).length ===
            3
      );

      setMistakes(mistakes + 1);
      setShakeWords(true);
      setTimeout(() => setShakeWords(false), 500);

      if (almostGroup) {
        setMessage("One away...");
      } else {
        setMessage("Incorrect!");
      }
    }
  };

  const handleDeselectAll = () => {
    setSelectedWords([]);
    setMessage(null);
  };

  const handleShuffle = () => {
    setRemainingWords(shuffleArray(remainingWords));
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Connections</h1>
      <p style={styles.subtitle}>Find groups of four related words</p>

      {/* Mistakes indicator */}
      <div style={styles.mistakesContainer}>
        <span>Mistakes remaining: </span>
        {Array.from({ length: maxMistakes }).map((_, i) => (
          <span
            key={i}
            style={{
              ...styles.mistakeDot,
              opacity: i < maxMistakes - mistakes ? 1 : 0.2,
            }}
          >
            ●
          </span>
        ))}
      </div>

      {/* Solved groups */}
      <div style={styles.solvedContainer}>
        {solvedGroups.map((group) => (
          <div
            key={group.name}
            style={{
              ...styles.solvedGroup,
              backgroundColor: group.bgColor,
              color: group.color,
            }}
          >
            <div style={styles.groupName}>{group.name}</div>
            <div style={styles.groupWords}>{group.words.join(", ")}</div>
          </div>
        ))}
      </div>

      {/* Word grid */}
      {!isWinner && !isGameOver && (
        <div style={styles.grid}>
          {remainingWords.map((word) => {
            const isSelected = selectedWords.includes(word);
            return (
              <button
                key={word}
                onClick={() => handleWordClick(word)}
                style={{
                  ...styles.wordButton,
                  ...(isSelected ? styles.wordButtonSelected : {}),
                  ...(shakeWords && isSelected ? styles.shake : {}),
                }}
              >
                {word.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}

      {/* Message */}
      {message && <div style={styles.message}>{message}</div>}

      {/* Game over states */}
      {isWinner && (
        <div style={styles.gameOverMessage}>
          🎉 Congratulations! You found all the connections!
        </div>
      )}

      {isGameOver && !isWinner && (
        <div style={styles.gameOverContainer}>
          <div style={styles.gameOverMessage}>Game Over! The answers were:</div>
          {GROUPS.filter((g) => !solvedGroups.includes(g)).map((group) => (
            <div
              key={group.name}
              style={{
                ...styles.solvedGroup,
                backgroundColor: group.bgColor,
                color: group.color,
              }}
            >
              <div style={styles.groupName}>{group.name}</div>
              <div style={styles.groupWords}>{group.words.join(", ")}</div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      {!isWinner && !isGameOver && (
        <div style={styles.controls}>
          <button
            onClick={handleShuffle}
            style={styles.controlButton}
          >
            Shuffle
          </button>
          <button
            onClick={handleDeselectAll}
            style={styles.controlButton}
            disabled={selectedWords.length === 0}
          >
            Deselect All
          </button>
          <button
            onClick={handleSubmit}
            style={{
              ...styles.controlButton,
              ...styles.submitButton,
              opacity: selectedWords.length === 4 ? 1 : 0.5,
            }}
            disabled={selectedWords.length !== 4}
          >
            Submit
          </button>
        </div>
      )}

      {/* Play again button */}
      {(isWinner || isGameOver) && (
        <button
          onClick={() => window.location.reload()}
          style={{ ...styles.controlButton, ...styles.submitButton, marginTop: 20 }}
        >
          Play Again
        </button>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    maxWidth: "600px",
    margin: "0 auto",
    minHeight: "100vh",
  },
  title: {
    fontSize: "2.5rem",
    marginBottom: "0.25rem",
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: "1rem",
    opacity: 0.7,
    marginTop: 0,
    marginBottom: "1.5rem",
  },
  mistakesContainer: {
    marginBottom: "1rem",
    fontSize: "0.9rem",
  },
  mistakeDot: {
    marginLeft: "4px",
    fontSize: "1.2rem",
  },
  solvedContainer: {
    width: "100%",
    marginBottom: "8px",
  },
  solvedGroup: {
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "8px",
    textAlign: "center",
  },
  groupName: {
    fontWeight: "bold",
    fontSize: "1rem",
    textTransform: "uppercase",
    marginBottom: "4px",
  },
  groupWords: {
    fontSize: "0.9rem",
    textTransform: "uppercase",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
    width: "100%",
    marginBottom: "1rem",
  },
  wordButton: {
    padding: "20px 8px",
    fontSize: "0.85rem",
    fontWeight: "bold",
    textTransform: "uppercase",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    backgroundColor: "#e0e0e0",
    color: "#000",
    transition: "all 0.15s ease",
    minHeight: "60px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  wordButtonSelected: {
    backgroundColor: "#5a5a5a",
    color: "#fff",
  },
  shake: {
    animation: "shake 0.5s ease-in-out",
  },
  message: {
    fontSize: "1rem",
    fontWeight: "bold",
    marginBottom: "1rem",
    padding: "8px 16px",
    borderRadius: "4px",
    backgroundColor: "rgba(255, 200, 100, 0.2)",
  },
  gameOverMessage: {
    fontSize: "1.25rem",
    fontWeight: "bold",
    marginBottom: "1rem",
    textAlign: "center",
  },
  gameOverContainer: {
    width: "100%",
    textAlign: "center",
  },
  controls: {
    display: "flex",
    gap: "12px",
    marginTop: "8px",
  },
  controlButton: {
    padding: "12px 24px",
    fontSize: "1rem",
    fontWeight: "600",
    borderRadius: "24px",
    border: "1px solid #333",
    cursor: "pointer",
    backgroundColor: "transparent",
    color: "inherit",
    transition: "all 0.15s ease",
  },
  submitButton: {
    backgroundColor: "#000",
    color: "#fff",
    border: "none",
  },
};

// Add keyframe animation for shake
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
`;
document.head.appendChild(styleSheet);
