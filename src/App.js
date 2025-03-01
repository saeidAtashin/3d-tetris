import { Canvas } from "@react-three/fiber";
import { OrbitControls, KeyboardControls, Text } from "@react-three/drei";
import {
  useState,
  useEffect,
  useReducer,
  useRef,
  createContext,
  useContext,
} from "react";

// Create a context for the score
const ScoreContext = createContext(0);

const BLOCK_SIZE = 1;
const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const WALL_THICKNESS = 0.5;
const POINTS_PER_ROW = 100; // Points earned for each cleared row

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

function Block({ position, color }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
      <meshStandardMaterial color={color} />
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

// Game state reducer
const initialState = {
  currentPiece: {
    position: [0, 15, 0],
    shape: shapes[0],
    color: "red",
  },
  nextPiece: {
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    color: `hsl(${Math.random() * 360}, 50%, 50%)`,
  },
  grid: Array.from({ length: GRID_HEIGHT }, () =>
    Array.from({ length: GRID_WIDTH }, () => 0)
  ),
  score: 0,
  clearedRows: [], // Track rows that are being cleared for animation
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
          position: [0, 15, 0],
          shape: state.nextPiece.shape,
          color: state.nextPiece.color,
        },
        nextPiece: {
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          color: `hsl(${Math.random() * 360}, 50%, 50%)`,
        },
      };
    default:
      return state;
  }
}

function Tetris() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { currentPiece, nextPiece, grid, score, clearedRows } = state;

  // Make the score available through context
  const scoreContextValue = score;

  // Use refs to store keyboard state
  const keysPressed = useRef({
    left: false,
    right: false,
    down: false,
    space: false,
  });

  // Function to check collisions
  const checkCollision = (position, shape) => {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const newX = position[0] + x;
          const newY = position[1] + y;
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
    return shape[0].map((_, i) => shape.map((row) => row[i]).reverse());
  };

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
        dispatch({ type: "SPAWN_NEW_PIECE" });
      }, 150);
    }, 300);

    return {
      grid: newGrid,
      rowsCleared: completedRowIndices.length,
      rowIndices: completedRowIndices,
    };
  };

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") keysPressed.current.left = true;
      if (e.key === "ArrowRight") keysPressed.current.right = true;
      if (e.key === "ArrowDown") keysPressed.current.down = true;
      if (e.key === " ") keysPressed.current.space = true;
    };

    const handleKeyUp = (e) => {
      if (e.key === "ArrowLeft") keysPressed.current.left = false;
      if (e.key === "ArrowRight") keysPressed.current.right = false;
      if (e.key === "ArrowDown") keysPressed.current.down = false;
      if (e.key === " ") keysPressed.current.space = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const gameLoop = () => {
      // Skip game updates during row clearing animation
      if (clearedRows.length > 0) return;

      // Handle movement
      let newPosition = [...currentPiece.position];

      if (keysPressed.current.left) newPosition[0] -= 1;
      if (keysPressed.current.right) newPosition[0] += 1;
      if (keysPressed.current.down) newPosition[1] -= 1;

      // Check if movement is valid
      if (
        !checkCollision(newPosition, currentPiece.shape) &&
        (newPosition[0] !== currentPiece.position[0] ||
          newPosition[1] !== currentPiece.position[1])
      ) {
        dispatch({ type: "MOVE_PIECE", position: newPosition });
      }

      // Handle rotation
      if (keysPressed.current.space) {
        keysPressed.current.space = false; // Reset space to prevent continuous rotation
        const rotatedShape = rotatePiece(currentPiece.shape);
        if (!checkCollision(currentPiece.position, rotatedShape)) {
          dispatch({ type: "ROTATE_PIECE", shape: rotatedShape });
        }
      }
    };

    const gravityLoop = () => {
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
        const newGrid = [...grid];
        currentPiece.shape.forEach((row, y) => {
          row.forEach((cell, x) => {
            if (cell) {
              const gridY = currentPiece.position[1] + y;
              const gridX = currentPiece.position[0] + x;
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

        // Check for completed rows before spawning new piece
        const {
          grid: updatedGrid,
          rowsCleared,
          rowIndices,
        } = checkForCompletedRows(newGrid);

        if (rowsCleared > 0) {
          // If rows are cleared, update the grid and score
          dispatch({
            type: "CLEAR_ROWS",
            grid: updatedGrid,
            rowsCleared,
            rowIndices,
          });
        } else {
          // If no rows are cleared, just lock the piece and spawn a new one
          dispatch({ type: "LOCK_PIECE", grid: newGrid });
          dispatch({ type: "SPAWN_NEW_PIECE" });
        }
      }
    };

    const gameInterval = setInterval(gameLoop, 100);
    const gravityInterval = setInterval(gravityLoop, 1000);

    return () => {
      clearInterval(gameInterval);
      clearInterval(gravityInterval);
    };
  }, [currentPiece, grid, clearedRows]);

  // Calculate wall positions and sizes
  const wallProps = {
    left: {
      position: [-WALL_THICKNESS / 2 - 0.5, GRID_HEIGHT / 2 - 0.5, 0],
      size: [WALL_THICKNESS, GRID_HEIGHT, BLOCK_SIZE * 2],
      color: "#555555",
    },
    right: {
      position: [
        GRID_WIDTH - 0.5 + WALL_THICKNESS / 2,
        GRID_HEIGHT / 2 - 0.5,
        0,
      ],
      size: [WALL_THICKNESS, GRID_HEIGHT, BLOCK_SIZE * 2],
      color: "#555555",
    },
    bottom: {
      position: [GRID_WIDTH / 2 - 0.5, -WALL_THICKNESS / 2 - 0.5, 0],
      size: [GRID_WIDTH, WALL_THICKNESS, BLOCK_SIZE * 2],
      color: "#555555",
    },
    back: {
      position: [
        GRID_WIDTH / 2 - 0.5,
        GRID_HEIGHT / 2 - 0.5,
        -WALL_THICKNESS / 2 - 0.5,
      ],
      size: [GRID_WIDTH, GRID_HEIGHT, WALL_THICKNESS],
      color: "#333333",
    },
    gridOutline: {
      position: [GRID_WIDTH / 2 - 0.5, GRID_HEIGHT / 2 - 0.5, 0],
      size: [GRID_WIDTH + 0.1, GRID_HEIGHT + 0.1, 0.05],
      color: "#888888",
    },
  };

  return (
    <ScoreContext.Provider value={scoreContextValue}>
      <>
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
        <group position={[GRID_WIDTH + 2, GRID_HEIGHT - 2, 0]}>
          <pointLight position={[0, 0, 5]} intensity={0.5} />
          <mesh>
            <boxGeometry args={[5, 2, 0.2]} />
            <meshStandardMaterial color="#222222" />
          </mesh>
          <Text 
            position={[0, 0, 0.2]} 
            color="white" 
            fontSize={0.5}
            anchorX="center"
            anchorY="middle"
          >
            Score: {score}
          </Text>
        </group>
      </>
    </ScoreContext.Provider>
  );
}

// Score display component that uses the context
function ScoreDisplay() {
  const score = useContext(ScoreContext);
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        color: "white",
        fontSize: "24px",
      }}
    >
      Score: {score}
    </div>
  );
}

// Now add the NextPiece component to display the next piece
function NextPiece({ piece }) {
  return (
    <group position={[GRID_WIDTH + 3, GRID_HEIGHT - 8, 0]}>
      {/* Background panel */}
      <mesh position={[0, 0, -0.1]}>
        <boxGeometry args={[6, 6, 0.2]} />
        <meshStandardMaterial color="#222222" />
      </mesh>

      {/* Label */}
      <group position={[0, 2, 0]}>
        <mesh>
          <boxGeometry args={[5, 1, 0.2]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
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

function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [15, 15, 15], fov: 50 }}>
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
          <Tetris />
          <OrbitControls />
        </KeyboardControls>
      </Canvas>
      <div style={{ position: "absolute", top: 20, left: 20, color: "white" }}>
        Use arrow keys to move | Space to rotate
      </div>
      <ScoreDisplay />
    </div>
  );
}

export default App;
