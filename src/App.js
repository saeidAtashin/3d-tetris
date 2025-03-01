import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  KeyboardControls,
} from "@react-three/drei";
import { useState, useEffect, useReducer, useRef } from "react";

const BLOCK_SIZE = 1;
const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;

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

// Game state reducer
const initialState = {
  currentPiece: {
    position: [0, 15, 0],
    shape: shapes[0],
    color: "red",
  },
  grid: Array.from({ length: GRID_HEIGHT }, () =>
    Array.from({ length: GRID_WIDTH }, () => 0)
  ),
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'MOVE_PIECE':
      return {
        ...state,
        currentPiece: {
          ...state.currentPiece,
          position: action.position,
        },
      };
    case 'ROTATE_PIECE':
      return {
        ...state,
        currentPiece: {
          ...state.currentPiece,
          shape: action.shape,
        },
      };
    case 'LOCK_PIECE':
      return {
        ...state,
        grid: action.grid,
        currentPiece: {
          position: [0, 15, 0],
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
  const { currentPiece, grid } = state;
  
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
  
  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') keysPressed.current.left = true;
      if (e.key === 'ArrowRight') keysPressed.current.right = true;
      if (e.key === 'ArrowDown') keysPressed.current.down = true;
      if (e.key === ' ') keysPressed.current.space = true;
    };
    
    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft') keysPressed.current.left = false;
      if (e.key === 'ArrowRight') keysPressed.current.right = false;
      if (e.key === 'ArrowDown') keysPressed.current.down = false;
      if (e.key === ' ') keysPressed.current.space = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  // Game loop
  useEffect(() => {
    const gameLoop = () => {
      // Handle movement
      let newPosition = [...currentPiece.position];
      
      if (keysPressed.current.left) newPosition[0] -= 1;
      if (keysPressed.current.right) newPosition[0] += 1;
      if (keysPressed.current.down) newPosition[1] -= 1;
      
      // Check if movement is valid
      if (!checkCollision(newPosition, currentPiece.shape) &&
          (newPosition[0] !== currentPiece.position[0] ||
           newPosition[1] !== currentPiece.position[1])) {
        dispatch({ type: 'MOVE_PIECE', position: newPosition });
      }
      
      // Handle rotation
      if (keysPressed.current.space) {
        keysPressed.current.space = false; // Reset space to prevent continuous rotation
        const rotatedShape = rotatePiece(currentPiece.shape);
        if (!checkCollision(currentPiece.position, rotatedShape)) {
          dispatch({ type: 'ROTATE_PIECE', shape: rotatedShape });
        }
      }
    };
    
    const gravityLoop = () => {
      // Move piece down due to gravity
      const newPosition = [
        currentPiece.position[0],
        currentPiece.position[1] - 1,
        currentPiece.position[2],
      ];
      
      if (!checkCollision(newPosition, currentPiece.shape)) {
        dispatch({ type: 'MOVE_PIECE', position: newPosition });
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
        
        dispatch({ type: 'LOCK_PIECE', grid: newGrid });
      }
    };
    
    const gameInterval = setInterval(gameLoop, 100);
    const gravityInterval = setInterval(gravityLoop, 1000);
    
    return () => {
      clearInterval(gameInterval);
      clearInterval(gravityInterval);
    };
  }, [currentPiece, grid]);
  
  return (
    <>
      {grid.map((row, y) =>
        row.map((cell, x) =>
          cell ? (
            <Block key={`${x}-${y}`} position={[x, y, 0]} color={cell} />
          ) : null
        )
      )}

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
    </>
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
    </div>
  );
}

export default App;
