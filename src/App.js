import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  KeyboardControls,
  Text,
  Stars,
  Environment,
} from "@react-three/drei";
import {
  useState,
  useEffect,
  useReducer,
  useRef,
  createContext,
  useContext,
} from "react";
import "./App.css";

// Create a context for the score
const ScoreContext = createContext(0);

// Create a context for game state
const GameStateContext = createContext({
  isPlaying: false,
  togglePlay: () => {},
});

const BLOCK_SIZE = 1;
const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const WALL_THICKNESS = 0.5;
const POINTS_PER_ROW = 100; // Points earned for each cleared row

// Basic color palette for Tetris pieces
const PIECE_COLORS = [
  "#ff004d", // Red
  "#00e436", // Green
  "#29adff", // Blue
  "#ff77a8", // Pink
  "#ffa300", // Orange
  "#ffec27", // Yellow
  "#73eff7", // Cyan
];

const shapes = [
  [[1, 1, 1, 1]], // I
  [
    [1, 1],
    [1, 1],
  ], // O
  [
    [1, 1, 1],
    [0, 1, 0],
  ], // T
  [
    [1, 1, 1],
    [1, 0, 0],
  ], // L
  [
    [1, 1, 1],
    [0, 0, 1],
  ], // J
  [
    [1, 1, 0],
    [0, 1, 1],
  ], // S
  [
    [0, 1, 1],
    [1, 1, 0],
  ], // Z
];

// Simpler Block component
function Block({ position, color }) {
  return (
    <mesh position={position}>
      <boxGeometry
        args={[BLOCK_SIZE * 0.95, BLOCK_SIZE * 0.95, BLOCK_SIZE * 0.95]}
      />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.2}
      />
    </mesh>
  );
}

// Wall component for game boundaries
function Wall({ position, size, color }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent opacity={0.3} />
    </mesh>
  );
}

// Create a grid floor for better visual reference
function GridFloor() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[GRID_WIDTH / 2 - 0.5, -0.5 - WALL_THICKNESS, 0]}
    >
      <planeGeometry args={[GRID_WIDTH + 6, GRID_WIDTH + 6]} />
      <meshStandardMaterial color="#101020" roughness={0.7} metalness={0.3} />
    </mesh>
  );
}

// Background environment with smooth star movement - remove the flash effect
function GameEnvironment({ onRowClear }) {
  // Add refs to control stars animation
  const starsRef = useRef();
  const [starsEffect, setStarsEffect] = useState(false);
  const animationIdRef = useRef(0);

  // Target position for smooth animation
  const [targetPosition, setTargetPosition] = useState([0, 0, -50]);
  // Current position that will be animated
  const currentPosition = useRef([0, 0, -50]);

  // Apply the effect when onRowClear changes
  useEffect(() => {
    if (onRowClear.count > 0) {
      // Increment animation ID to ensure each effect is unique
      animationIdRef.current += 1;

      // Trigger the stars effect
      setStarsEffect(true);

      // Set new target position based on rows cleared
      const intensity = onRowClear.rows * 5; // Scale based on rows cleared
      setTargetPosition([
        (Math.random() - 0.5) * intensity,
        (Math.random() - 0.5) * intensity,
        -50 + Math.random() * 10,
      ]);

      // Reset after the animation duration
      const timer = setTimeout(() => {
        setStarsEffect(false);
        // Set target back to original position
        setTargetPosition([0, 0, -50]);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [onRowClear]);

  // Animation frame for smooth movement
  useFrame(() => {
    // Smoothly interpolate current position toward target position
    currentPosition.current[0] +=
      (targetPosition[0] - currentPosition.current[0]) * 1;
    currentPosition.current[1] +=
      (targetPosition[1] - currentPosition.current[1]) * 0.05;
    currentPosition.current[2] +=
      (targetPosition[2] - currentPosition.current[2]) * 0.05;

    // If starsRef exists, update its position
    if (starsRef.current) {
      starsRef.current.position.x = currentPosition.current[0];
      starsRef.current.position.y = currentPosition.current[1];
      starsRef.current.position.z = currentPosition.current[2];
    }
  });

  return (
    <>
      <Stars
        ref={starsRef}
        radius={starsEffect ? 60 : 50}
        depth={starsEffect ? 60 : 50}
        count={5000}
        factor={starsEffect ? 8 : 4}
        saturation={starsEffect ? 1 : 0.5}
        speed={starsEffect ? 4 : 1}
        fade
      />
      <Environment preset="night" background blur={0.2} />

      {/* Remove the flash effect entirely */}
    </>
  );
}

// Game state reducer
const initialState = {
  currentPiece: {
    position: [4, 15, 0], // Start in the middle of the grid horizontally
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
  },
  nextPiece: {
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
  },
  grid: Array.from({ length: GRID_HEIGHT }, () =>
    Array.from({ length: GRID_WIDTH }, () => 0)
  ),
  score: 0,
  clearedRows: [],
};

function gameReducer(state, action) {
  switch (action.type) {
    case "MOVE_PIECE":
      return {
        ...state,
        currentPiece: {
          ...state.currentPiece,
          position: action.position,
        },
      };
    case "ROTATE_PIECE":
      return {
        ...state,
        currentPiece: {
          ...state.currentPiece,
          shape: action.shape,
        },
      };
    case "LOCK_PIECE":
      return {
        ...state,
        grid: action.grid,
      };
    case "CLEAR_ROWS":
      return {
        ...state,
        grid: action.grid,
        score: state.score + action.rowsCleared * POINTS_PER_ROW,
        clearedRows: action.rowIndices,
      };
    case "SPAWN_NEW_PIECE":
      return {
        ...state,
        clearedRows: [], // Reset cleared rows after animation
        currentPiece: {
          position: [4, 15, 0],
          shape: state.nextPiece.shape,
          color: state.nextPiece.color,
        },
        nextPiece: {
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
        },
      };
    default:
      return state;
  }
}

function Tetris({ onScoreUpdate }) {
  // Create a clean initialState function to ensure fresh state each time
  const getInitialState = () => ({
    currentPiece: {
      position: [4, 15, 0],
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
    },
    nextPiece: {
      shape: shapes[Math.floor(Math.random() * shapes.length)],
      color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
    },
    grid: Array.from({ length: GRID_HEIGHT }, () =>
      Array.from({ length: GRID_WIDTH }, () => 0)
    ),
    score: 0,
    clearedRows: [],
  });

  // Use the function to get a fresh initial state
  const [state, dispatch] = useReducer(gameReducer, getInitialState());
  const { currentPiece, nextPiece, grid, score, clearedRows } = state;
  const [gameOver, setGameOver] = useState(false);
  const { togglePlay } = useContext(GameStateContext);

  // Watch for score changes and notify parent component
  useEffect(() => {
    onScoreUpdate(score);
  }, [score, onScoreUpdate]);

  // Initialize the game with a first piece on mount
  useEffect(() => {
    // This ensures a piece is visible immediately on game start
    dispatch({ type: "SPAWN_NEW_PIECE" });
  }, []);

  // Use refs to store keyboard state
  const keysPressed = useRef({
    left: false,
    right: false,
    down: false,
    space: false,
  });

  const lastKeyTime = useRef({
    left: 0,
    right: 0,
    down: 0,
    space: 0,
  });

  // Function to check collisions
  const checkCollision = (position, shape) => {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const newX = position[0] + x;
          const newY = position[1] + y;
          // Check if out of bounds or colliding with locked pieces
          if (
            newX < 0 ||
            newX >= GRID_WIDTH ||
            newY < 0 ||
            (newY < GRID_HEIGHT && grid[newY] && grid[newY][newX])
          ) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Function to rotate a piece
  const rotatePiece = (shape) => {
    const newShape = shape[0].map((_, i) =>
      shape.map((row) => row[i]).reverse()
    );
    return newShape;
  };

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          keysPressed.current.left = true;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          keysPressed.current.right = true;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          keysPressed.current.down = true;
          break;
        case " ":
          keysPressed.current.space = true;
          break;
        default:
          break;
      }
    };

    const handleKeyUp = (e) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          keysPressed.current.left = false;
          break;
        case "ArrowRight":
        case "d":
        case "D":
          keysPressed.current.right = false;
          break;
        case "ArrowDown":
        case "s":
        case "S":
          keysPressed.current.down = false;
          break;
        case " ":
          keysPressed.current.space = false;
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Game loops
  useEffect(() => {
    if (gameOver) return; // Don't process input if game over

    // Input handling loop
    const inputInterval = setInterval(() => {
      const now = Date.now();
      // Handle keyboard input for movement
      if (keysPressed.current.left && now - lastKeyTime.current.left > 100) {
        const newPosition = [
          currentPiece.position[0] - 1,
          currentPiece.position[1],
          currentPiece.position[2],
        ];
        if (!checkCollision(newPosition, currentPiece.shape)) {
          dispatch({ type: "MOVE_PIECE", position: newPosition });
        }
        lastKeyTime.current.left = now;
      }

      if (keysPressed.current.right && now - lastKeyTime.current.right > 100) {
        const newPosition = [
          currentPiece.position[0] + 1,
          currentPiece.position[1],
          currentPiece.position[2],
        ];
        if (!checkCollision(newPosition, currentPiece.shape)) {
          dispatch({ type: "MOVE_PIECE", position: newPosition });
        }
        lastKeyTime.current.right = now;
      }

      if (keysPressed.current.down && now - lastKeyTime.current.down > 50) {
        const newPosition = [
          currentPiece.position[0],
          currentPiece.position[1] - 1,
          currentPiece.position[2],
        ];
        if (!checkCollision(newPosition, currentPiece.shape)) {
          dispatch({ type: "MOVE_PIECE", position: newPosition });
        }
        lastKeyTime.current.down = now;
      }

      if (keysPressed.current.space && now - lastKeyTime.current.space > 200) {
        const newShape = rotatePiece(currentPiece.shape);
        const newPosition = currentPiece.position;

        // Check if rotation would cause collision
        if (!checkCollision(newPosition, newShape)) {
          dispatch({ type: "ROTATE_PIECE", shape: newShape });
        }
        lastKeyTime.current.space = now;
      }
    }, 16); // 60fps equivalent

    // Gravity loop
    const gravityInterval = setInterval(() => {
      // Skip gravity during row clearing animation
      if (clearedRows.length > 0) return;

      // Move piece down due to gravity
      const newPosition = [
        currentPiece.position[0],
        currentPiece.position[1] - 1,
        currentPiece.position[2],
      ];

      if (!checkCollision(newPosition, currentPiece.shape)) {
        dispatch({ type: "MOVE_PIECE", position: newPosition });
      } else {
        // Lock piece in place
        lockPiece();
      }
    }, 500); // Gravity every 500ms

    return () => {
      clearInterval(inputInterval);
      clearInterval(gravityInterval);
    };
  }, [currentPiece, grid, clearedRows, gameOver]);

  // Use an object with count to trigger effect for every row clear
  const [rowClearEffect, setRowClearEffect] = useState({ count: 0, rows: 0 });

  // Check for completed rows and clear them
  const checkForCompletedRows = (grid) => {
    const completedRowIndices = [];

    // Find all completed rows
    for (let y = 0; y < GRID_HEIGHT; y++) {
      if (grid[y].every((cell) => cell !== 0)) {
        completedRowIndices.push(y);
      }
    }

    if (completedRowIndices.length === 0) {
      return { grid, rowsCleared: 0, rowIndices: [] };
    }

    // Make a copy of the grid to work with
    const newGrid = [...grid];

    // First mark rows for clearing animation
    completedRowIndices.forEach((rowIndex) => {
      newGrid[rowIndex] = Array(GRID_WIDTH).fill("clearing");
    });

    // Animate and then actually clear rows
    setTimeout(() => {
      // Create a new grid without the cleared rows
      let finalGrid = Array.from({ length: GRID_HEIGHT }, () =>
        Array(GRID_WIDTH).fill(0)
      );

      // We need to start placing blocks at the bottom of the grid (lowest visible row)
      // In our coordinate system, lower means smaller y-value
      let targetRow = 0; // Start filling from the bottom (y=0)

      // Go through original grid from bottom to top
      for (let y = 0; y < GRID_HEIGHT; y++) {
        // Skip rows that are being cleared
        if (!newGrid[y].includes("clearing")) {
          // Copy this row to the target position
          finalGrid[targetRow] = [...newGrid[y]];
          targetRow++; // Move to the next row up
        }
      }

      // For visual effect, mark rows that have moved as "falling"
      const fallingGrid = [...newGrid];
      for (let y = 0; y < GRID_HEIGHT; y++) {
        if (!fallingGrid[y].includes("clearing")) {
          // Mark this row as falling (will be rendered with a different visual effect)
          fallingGrid[y] = fallingGrid[y].map((cell) => (cell ? "falling" : 0));
        }
      }

      // First update to show "falling" animation
      dispatch({
        type: "CLEAR_ROWS",
        grid: fallingGrid,
        rowsCleared: 0,
        rowIndices: [],
      });

      // Then after a short delay, update to final positions
      setTimeout(() => {
        dispatch({
          type: "LOCK_PIECE",
          grid: finalGrid,
        });

        // Check if game is over before spawning a new piece
        if (!gameOver) {
          const nextPiecePosition = [4, 15, 0];
          if (!checkCollision(nextPiecePosition, nextPiece.shape)) {
            dispatch({ type: "SPAWN_NEW_PIECE" });
          }
        }

        // Update with both count and rows to ensure trigger every time
        setRowClearEffect((prev) => ({
          count: prev.count + 1,
          rows: completedRowIndices.length,
        }));
      }, 300);
    }, 300);

    return {
      grid: newGrid,
      rowsCleared: completedRowIndices.length,
      rowIndices: completedRowIndices,
    };
  };

  // Check for game over condition
  const checkGameOver = (position, shape) => {
    // If a piece can't be placed at its starting position, the game is over
    if (checkCollision(position, shape)) {
      console.log("Game Over!");
      setGameOver(true);

      // Show game over message and return to menu after a short delay
      setTimeout(() => {
        togglePlay(); // Return to menu
      }, 2000);

      return true;
    }
    return false;
  };

  // Replace the existing lockPiece function with this updated version
  const lockPiece = () => {
    // Create a new grid with the current piece locked in place
    const newGrid = [...grid];
    currentPiece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          const gridY = y + currentPiece.position[1];
          const gridX = x + currentPiece.position[0];
          // Only update if within grid bounds
          if (
            gridY >= 0 &&
            gridY < GRID_HEIGHT &&
            gridX >= 0 &&
            gridX < GRID_WIDTH
          ) {
            newGrid[gridY][gridX] = currentPiece.color;
          }
        }
      });
    });

    // Check for completed rows
    const {
      grid: updatedGrid,
      rowsCleared,
      rowIndices,
    } = checkForCompletedRows(newGrid);

    // If rows are cleared, handle them with animations first
    if (rowIndices.length > 0) {
      // First dispatch to show clearing animation
      dispatch({
        type: "CLEAR_ROWS",
        grid: updatedGrid,
        rowsCleared,
        rowIndices,
      });

      // The rest is handled in checkForCompletedRows
    } else {
      // If no rows are cleared, just lock the piece
      dispatch({
        type: "LOCK_PIECE",
        grid: newGrid,
      });

      // Then check if we can spawn a new piece (or game over)
      // Check if game over before spawning a new piece
      const nextPiecePosition = [4, 15, 0]; // Starting position for new pieces
      if (!checkGameOver(nextPiecePosition, nextPiece.shape)) {
        dispatch({ type: "SPAWN_NEW_PIECE" });
      }
    }
  };

  // Also explicitly check for game over when a new piece spawns
  useEffect(() => {
    // Check game over each time a new piece appears
    if (state.currentPiece && !gameOver) {
      const { position, shape } = state.currentPiece;
      checkGameOver(position, shape);
    }
  }, [state.currentPiece]);

  // Calculate wall positions and sizes
  const wallProps = {
    left: {
      position: [-WALL_THICKNESS / 2 - 0.5, GRID_HEIGHT / 2 - 0.5, 0],
      size: [WALL_THICKNESS, GRID_HEIGHT, BLOCK_SIZE * 4],
      color: "#3388ff",
    },
    right: {
      position: [
        GRID_WIDTH - 0.5 + WALL_THICKNESS / 2,
        GRID_HEIGHT / 2 - 0.5,
        0,
      ],
      size: [WALL_THICKNESS, GRID_HEIGHT, BLOCK_SIZE * 4],
      color: "#3388ff",
    },
    bottom: {
      position: [GRID_WIDTH / 2 - 0.5, -WALL_THICKNESS / 2 - 0.5, 0],
      size: [GRID_WIDTH, WALL_THICKNESS, BLOCK_SIZE * 4],
      color: "#3388ff",
    },
    back: {
      position: [
        GRID_WIDTH / 2 - 0.5,
        GRID_HEIGHT / 2 - 0.5,
        -1 - WALL_THICKNESS / 2,
      ],
      size: [GRID_WIDTH, GRID_HEIGHT, WALL_THICKNESS],
      color: "#1166cc",
    },
    gridOutline: {
      position: [GRID_WIDTH / 2 - 0.5, GRID_HEIGHT / 2 - 0.5, 0],
      size: [GRID_WIDTH + 0.1, GRID_HEIGHT + 0.1, BLOCK_SIZE + 0.1],
      color: "#2277dd",
    },
  };

  // Game over UI overlay
  const gameOverDisplay = gameOver && (
    <group position={[GRID_WIDTH / 2 - 0.5, GRID_HEIGHT / 2, 1]}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[8, 4, 0.1]} />
        <meshStandardMaterial color="#000000" opacity={0.8} transparent />
      </mesh>
      <Text
        position={[0, 0.5, 0.2]}
        color="#ff0000"
        fontSize={1}
        anchorX="center"
        anchorY="middle"
      >
        GAME OVER
      </Text>
      <Text
        position={[0, -0.5, 0.2]}
        color="#ffffff"
        fontSize={0.5}
        anchorX="center"
        anchorY="middle"
      >
        Final Score: {score}
      </Text>
    </group>
  );

  // Add logging for debugging
  useEffect(() => {
    console.log("Tetris component mounted/reset");
  }, []);

  return (
    <>
      {/* Pass the effect trigger to GameEnvironment */}
      <GameEnvironment onRowClear={rowClearEffect} />
      <GridFloor />

      {/* Walls */}
      <Wall {...wallProps.left} />
      <Wall {...wallProps.right} />
      <Wall {...wallProps.bottom} />
      <Wall {...wallProps.back} />
      <Wall {...wallProps.gridOutline} />

      {/* Grid - locked pieces */}
      {grid.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <Block
              key={`${x}-${y}`}
              position={[x, y, 0]}
              color={
                cell === "clearing"
                  ? "#ffffff"
                  : cell === "falling"
                  ? "#aaaaaa"
                  : cell
              }
            />
          ) : null
        )
      )}

      {/* Current active piece */}
      {currentPiece.shape.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <Block
              key={`c-${x}-${y}`}
              position={[
                x + currentPiece.position[0],
                y + currentPiece.position[1],
                0,
              ]}
              color={currentPiece.color}
            />
          ) : null
        )
      )}

      {/* Next Piece Display */}
      <NextPiece piece={nextPiece} />

      {/* Score Display in 3D */}
      <group position={[GRID_WIDTH + 3, GRID_HEIGHT - 2, 0]}>
        <pointLight position={[0, 0, 5]} intensity={0.7} />
        <mesh>
          <boxGeometry args={[6, 2, 0.3]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
        <Text
          position={[0, 0, 0.2]}
          color="#ffffff"
          fontSize={0.6}
          anchorX="center"
          anchorY="middle"
        >
          SCORE: {score}
        </Text>
      </group>

      {/* Game Over Display */}
      {gameOverDisplay}
    </>
  );
}

// Score display component that uses the context
function ScoreDisplay() {
  const score = useContext(ScoreContext);
  return <div className="score-display">Score: {score}</div>;
}

// Next Piece component
function NextPiece({ piece }) {
  return (
    <group position={[GRID_WIDTH + 3, GRID_HEIGHT - 8, 0]}>
      {/* Background panel */}
      <mesh position={[0, 0, -0.2]}>
        <boxGeometry args={[6, 6, 0.3]} />
        <meshStandardMaterial color="#222222" />
      </mesh>

      {/* Label */}
      <group position={[0, 2, 0]}>
        <mesh>
          <boxGeometry args={[5, 1, 0.3]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
        <Text
          position={[0, 0, 0.2]}
          color="#ffffff"
          fontSize={0.4}
          anchorX="center"
          anchorY="middle"
        >
          NEXT PIECE
        </Text>
      </group>

      {/* Next piece preview */}
      {piece.shape.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <Block
              key={`next-${x}-${y}`}
              position={[
                x - piece.shape[0].length / 2 + 0.5,
                y - piece.shape.length / 2 + 0.5,
                0,
              ]}
              color={piece.color}
            />
          ) : null
        )
      )}
    </group>
  );
}

// Menu component (keep this as is)
function GameMenu() {
  const { isPlaying, togglePlay } = useContext(GameStateContext);
  const [menuSection, setMenuSection] = useState("main");

  if (isPlaying) return null;

  const renderMainMenu = () => (
    <div className="menu-container">
      <h1>3D TETRIS</h1>
      <button onClick={togglePlay}>Start Game</button>
      <button onClick={() => setMenuSection("guide")}>How to Play</button>
      <button onClick={() => setMenuSection("details")}>Game Details</button>
    </div>
  );

  const renderGuide = () => (
    <div className="menu-container guide">
      <h2>How to Play</h2>
      <div className="guide-content">
        <p>Controls:</p>
        <ul>
          <li>
            <strong>Left/Right Arrow Keys:</strong> Move piece horizontally
          </li>
          <li>
            <strong>Down Arrow Key:</strong> Move piece down faster
          </li>
          <li>
            <strong>Space Bar:</strong> Rotate piece
          </li>
        </ul>
        <p>Objective:</p>
        <p>
          Fill entire rows with blocks to clear them and earn points. The game
          ends when pieces reach the top of the grid.
        </p>
      </div>
      <button onClick={() => setMenuSection("main")}>Back to Menu</button>
    </div>
  );

  const renderDetails = () => (
    <div className="menu-container details">
      <h2>Game Details</h2>
      <div className="details-content">
        <p>Game Features:</p>
        <ul>
          <li>3D rendered Tetris game</li>
          <li>Classic Tetris mechanics with modern visuals</li>
          <li>Row clearing animations</li>
          <li>Next piece preview</li>
          <li>Score tracking</li>
        </ul>
        <p>Scoring:</p>
        <p>
          Each cleared row is worth 100 points. Clear multiple rows at once for
          more points!
        </p>
      </div>
      <button onClick={() => setMenuSection("main")}>Back to Menu</button>
    </div>
  );

  return (
    <div className="menu-overlay">
      {menuSection === "main" && renderMainMenu()}
      {menuSection === "guide" && renderGuide()}
      {menuSection === "details" && renderDetails()}
    </div>
  );
}

// App component (keep the menu functionality)
function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  // Add a gameReset state to force Tetris component to fully reset
  const [gameReset, setGameReset] = useState(0);

  const togglePlay = () => {
    if (isPlaying) {
      // Going back to menu
      setIsPlaying(false);
    } else {
      // Starting new game - reset everything
      setScore(0);
      setGameReset((prev) => prev + 1); // Increment to force complete reset
      setIsPlaying(true);
    }
  };

  const gameStateValue = {
    isPlaying,
    togglePlay,
  };

  // Function to update score from Tetris component
  const updateScore = (newScore) => {
    setScore(newScore);
  };

  // No need for separate tetrisKey as gameReset serves the same purpose

  return (
    <GameStateContext.Provider value={gameStateValue}>
      <ScoreContext.Provider value={score}>
        <div style={{ width: "100vw", height: "100vh" }}>
          <Canvas
            camera={{ position: [5, 20, 50], fov: 80 }}
            gl={{ alpha: false }}
          >
            <color attach="background" args={["#0a0a2c"]} />

            <KeyboardControls
              map={[
                { name: "left", keys: ["ArrowLeft", "KeyA"] },
                { name: "right", keys: ["ArrowRight", "KeyD"] },
                { name: "down", keys: ["ArrowDown", "KeyS"] },
                { name: "space", keys: ["Space"] },
              ]}
            >
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} />

              {isPlaying && (
                <Tetris key={gameReset} onScoreUpdate={updateScore} />
              )}
              <OrbitControls
                enablePan={false}
                minDistance={10}
                maxDistance={35}
              />
            </KeyboardControls>
          </Canvas>

          {isPlaying && (
            <div className="game-ui">
              <div className="controls-hint">
                Use arrow keys to move | Space to rotate
              </div>
              <button className="menu-button" onClick={togglePlay}>
                Menu
              </button>
              <ScoreDisplay />
            </div>
          )}

          <GameMenu />
        </div>
      </ScoreContext.Provider>
    </GameStateContext.Provider>
  );
}

export default App;
