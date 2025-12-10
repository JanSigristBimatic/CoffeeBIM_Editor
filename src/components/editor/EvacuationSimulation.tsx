/**
 * Evacuation Simulation Component
 *
 * Renders evacuation agents in the 3D scene and manages the simulation loop.
 * Uses Yuka for steering behaviors to simulate crowd evacuation to exits.
 */

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { useEvacuationStore, type EvacuationAgent } from '@/store/useEvacuationStore';

// ============================================================================
// Constants
// ============================================================================

const PERSON_MODEL_PATH = '/assets/people/Mann.obj';
const PERSON_SCALE = 0.1;

// ============================================================================
// Agent Mesh Component
// ============================================================================

interface AgentMeshProps {
  agent: EvacuationAgent;
  geometry: THREE.BufferGeometry | null;
}

function AgentMesh({ agent, geometry }: AgentMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Update mesh position and rotation every frame
  useFrame(() => {
    if (!groupRef.current) return;

    groupRef.current.position.set(
      agent.position.x,
      agent.position.y,
      agent.position.z
    );

    // Apply agent rotation around Z axis (Z-up coordinate system)
    // The model is Y-up, so we rotate -90° around X to make it Z-up
    groupRef.current.rotation.set(0, 0, agent.rotation);
  });

  // Don't render if agent has exited
  if (agent.hasExited) return null;

  // Fallback to capsule if geometry not loaded
  if (!geometry) {
    return (
      <group
        position={[agent.position.x, agent.position.y, agent.position.z]}
        rotation={[0, 0, agent.rotation]}
      >
        {/* Capsule standing upright (Z-up) */}
        <mesh position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.2, 0.6, 4, 8]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.8} />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      {/* Inner group: rotate Y-up model to Z-up and scale */}
      <group rotation={[Math.PI / 2, 0, 0]} scale={[PERSON_SCALE, PERSON_SCALE, PERSON_SCALE]}>
        <mesh geometry={geometry}>
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
      </group>
    </group>
  );
}

// ============================================================================
// Person Model Loader
// ============================================================================

function usePersonGeometry(): THREE.BufferGeometry | null {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [loadAttempted, setLoadAttempted] = useState(false);

  useEffect(() => {
    if (loadAttempted) return;

    const loader = new OBJLoader();

    loader.load(
      PERSON_MODEL_PATH,
      (obj) => {
        // Success: extract geometry from loaded OBJ
        let extractedGeometry: THREE.BufferGeometry | null = null;

        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry && !extractedGeometry) {
            extractedGeometry = child.geometry.clone();
          }
        });

        if (extractedGeometry) {
          setGeometry(extractedGeometry);
        } else {
          console.warn('[CoffeeBIM] Person model loaded but no geometry found, using fallback');
        }
        setLoadAttempted(true);
      },
      undefined, // onProgress
      (error) => {
        // Error: log and use fallback
        console.warn('[CoffeeBIM] Could not load person model, using fallback:', error);
        setLoadAttempted(true);
      }
    );
  }, [loadAttempted]);

  return geometry;
}

// ============================================================================
// Exit Marker Component
// ============================================================================

interface ExitMarkerProps {
  position: { x: number; y: number; z: number };
}

function ExitMarker({ position }: ExitMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Pulsing animation for exit markers
  useFrame(({ clock }) => {
    if (ringRef.current) {
      const scale = 1 + Math.sin(clock.elapsedTime * 3) * 0.2;
      ringRef.current.scale.set(scale, scale, 1);
    }
  });

  return (
    <group position={[position.x, position.y, position.z + 0.05]}>
      {/* Base circle */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 32]} />
        <meshStandardMaterial color="#22c55e" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Pulsing ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.01]}>
        <ringGeometry args={[0.5, 0.7, 32]} />
        <meshStandardMaterial color="#22c55e" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>

      {/* Arrow pointing up (rotated from Y-up to Z-up) */}
      <mesh position={[0, 0, 1.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.3, 0.6, 4]} />
        <meshStandardMaterial color="#22c55e" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// ============================================================================
// Main Simulation Component
// ============================================================================

export function EvacuationSimulation() {
  const { isRunning, agents, exitDoors, update } = useEvacuationStore();
  const personGeometry = usePersonGeometry();

  // Update simulation every frame
  useFrame((_, delta) => {
    if (isRunning) {
      update(delta);
    }
  });

  // Don't render if simulation not active
  if (!isRunning && agents.size === 0) return null;

  return (
    <group name="evacuation-simulation">
      {/* Render exit markers */}
      {exitDoors.map((exit) => (
        <ExitMarker key={exit.id} position={exit.position} />
      ))}

      {/* Render agents */}
      {Array.from(agents.values()).map((agent) => (
        <AgentMesh key={agent.id} agent={agent} geometry={personGeometry} />
      ))}
    </group>
  );
}

// ============================================================================
// Simulation Control Panel (for Toolbar)
// ============================================================================

export function EvacuationControlPanel() {
  const {
    isRunning,
    stopSimulation,
    reset,
    agentsPerSpace,
    setAgentsPerSpace,
    agentSpeed,
    setAgentSpeed,
    stats,
  } = useEvacuationStore();

  // These need to be passed from the parent when starting
  // For now, this is just the UI controls

  return (
    <div className="flex flex-col gap-2 p-2 bg-background border rounded-lg shadow-lg">
      <div className="text-sm font-semibold">Fluchtsimulation</div>

      {/* Settings */}
      <div className="flex items-center gap-2 text-xs">
        <label>Personen/Raum:</label>
        <input
          type="number"
          min={1}
          max={50}
          value={agentsPerSpace}
          onChange={(e) => setAgentsPerSpace(parseInt(e.target.value) || 1)}
          className="w-16 px-1 py-0.5 border rounded"
          disabled={isRunning}
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <label>Geschwindigkeit (m/s):</label>
        <input
          type="number"
          min={0.5}
          max={5}
          step={0.1}
          value={agentSpeed}
          onChange={(e) => setAgentSpeed(parseFloat(e.target.value) || 1.5)}
          className="w-16 px-1 py-0.5 border rounded"
          disabled={isRunning}
        />
      </div>

      {/* Stats */}
      {stats.totalAgents > 0 && (
        <div className="text-xs text-muted-foreground">
          <div>Evakuiert: {stats.exitedAgents} / {stats.totalAgents}</div>
          <div>Zeit: {stats.elapsedTime.toFixed(1)}s</div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-1">
        {!isRunning ? (
          <button
            onClick={() => {
              // Note: startSimulation needs spaces, doors, walls from parent
              // This button is a placeholder - actual trigger from toolbar
            }}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
            disabled
          >
            Start (via Toolbar)
          </button>
        ) : (
          <button
            onClick={stopSimulation}
            className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Pause
          </button>
        )}

        <button
          onClick={reset}
          className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

export default EvacuationSimulation;
