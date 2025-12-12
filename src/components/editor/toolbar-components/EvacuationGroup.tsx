/**
 * Evacuation Simulation Toolbar Group
 *
 * Controls for the evacuation/egress simulation using Yuka steering behaviors.
 */

import { useState } from 'react';
import { Users, Play, Square, RotateCcw, Settings } from 'lucide-react';
import { ActionButton } from './ToolbarButtons';
import { useEvacuationStore } from '@/store/useEvacuationStore';
import { useElementStore } from '@/store/useElementStore';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';

export function EvacuationGroup() {
  const [showSettings, setShowSettings] = useState(false);

  const {
    isRunning,
    startSimulation,
    stopSimulation,
    reset,
    agentsPerSpace,
    setAgentsPerSpace,
    agentSpeed,
    setAgentSpeed,
    stats,
  } = useEvacuationStore();

  const { getElementsByType } = useElementStore();

  const handleStart = () => {
    const spaces = getElementsByType('space');
    const doors = getElementsByType('door');
    const walls = getElementsByType('wall');
    const columns = getElementsByType('column');
    const furniture = getElementsByType('furniture');
    const counters = getElementsByType('counter');
    const stairs = getElementsByType('stair');

    if (spaces.length === 0) {
      alert('Keine Räume gefunden! Erstellen Sie zuerst Räume (Spaces) für die Simulation.');
      return;
    }

    if (doors.length === 0) {
      alert('Keine Türen gefunden! Erstellen Sie zuerst Türen als Ausgänge.');
      return;
    }

    startSimulation(spaces, doors, walls, columns, furniture, counters, stairs);
  };

  return (
    <div className="flex items-center gap-1 border-l pl-2 ml-2">
      {/* Simulation Controls */}
      {!isRunning ? (
        <ActionButton
          icon={<Play size={20} className="text-green-500" />}
          label="Flucht starten"
          shortcut="F9"
          onClick={handleStart}
        />
      ) : (
        <ActionButton
          icon={<Square size={20} className="text-yellow-500" />}
          label="Stoppen"
          onClick={stopSimulation}
        />
      )}

      <ActionButton
        icon={<RotateCcw size={20} />}
        label="Reset"
        onClick={reset}
        disabled={stats.totalAgents === 0}
      />

      {/* Settings Popover */}
      <Popover open={showSettings} onOpenChange={setShowSettings}>
        <PopoverTrigger asChild>
          <button
            className="p-2 rounded hover:bg-accent transition-colors"
            title="Einstellungen"
          >
            <Settings size={20} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-sm flex items-center gap-2">
              <Users size={16} />
              Fluchtsimulation
            </div>

            {/* Agents per space */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                Personen pro Raum
              </label>
              <input
                type="range"
                min={1}
                max={20}
                value={agentsPerSpace}
                onChange={(e) => setAgentsPerSpace(parseInt(e.target.value))}
                disabled={isRunning}
                className="w-full"
              />
              <div className="text-xs text-right">{agentsPerSpace}</div>
            </div>

            {/* Agent speed */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                Gehgeschwindigkeit (m/s)
              </label>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={agentSpeed}
                onChange={(e) => setAgentSpeed(parseFloat(e.target.value))}
                disabled={isRunning}
                className="w-full"
              />
              <div className="text-xs text-right">{agentSpeed.toFixed(1)} m/s</div>
            </div>

            {/* Stats */}
            {stats.totalAgents > 0 && (
              <div className="border-t pt-2 mt-2">
                <div className="text-xs font-medium mb-1">Statistik</div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex justify-between">
                    <span>Evakuiert:</span>
                    <span>{stats.exitedAgents} / {stats.totalAgents}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Zeit:</span>
                    <span>{stats.elapsedTime.toFixed(1)}s</span>
                  </div>
                  {stats.exitedAgents > 0 && stats.totalAgents > 0 && (
                    <div className="flex justify-between">
                      <span>Fortschritt:</span>
                      <span>{((stats.exitedAgents / stats.totalAgents) * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="border-t pt-2 mt-1 text-xs text-muted-foreground">
              <p>
                Die Simulation spawnt Personen in allen Räumen und navigiert sie
                zum nächsten Ausgang (externe Tür).
              </p>
              <p className="mt-1">
                <strong>Tipp:</strong> Markieren Sie Türen als "Extern" im
                Property-Panel für präzise Ausgangserkennung.
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Live Stats Display */}
      {stats.totalAgents > 0 && (
        <div className="flex items-center gap-2 ml-2 px-2 py-1 bg-muted rounded text-xs">
          <Users size={14} />
          <span>
            {stats.exitedAgents}/{stats.totalAgents}
          </span>
          {isRunning && (
            <span className="text-muted-foreground">
              {stats.elapsedTime.toFixed(1)}s
            </span>
          )}
        </div>
      )}
    </div>
  );
}
