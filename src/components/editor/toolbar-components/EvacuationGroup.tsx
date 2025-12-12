/**
 * Evacuation Simulation Toolbar Group
 *
 * Controls for the evacuation/egress simulation using Yuka steering behaviors.
 */

import { useState } from 'react';
import { Users, Play, Square, RotateCcw, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from './ToolbarButtons';
import { useEvacuationStore } from '@/store/useEvacuationStore';
import { useElementStore } from '@/store/useElementStore';
import { useProjectStore } from '@/store/useProjectStore';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';

export function EvacuationGroup() {
  const { t } = useTranslation();
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
  const { storeys } = useProjectStore();

  const handleStart = () => {
    const spaces = getElementsByType('space');
    const doors = getElementsByType('door');
    const walls = getElementsByType('wall');
    const columns = getElementsByType('column');
    const furniture = getElementsByType('furniture');
    const counters = getElementsByType('counter');
    const stairs = getElementsByType('stair');

    if (spaces.length === 0) {
      alert(t('evacuation.noSpacesAlert'));
      return;
    }

    if (doors.length === 0) {
      alert(t('evacuation.noDoorsAlert'));
      return;
    }

    startSimulation(spaces, doors, walls, columns, furniture, counters, stairs, storeys);
  };

  return (
    <div className="flex items-center gap-1 border-l pl-2 ml-2">
      {/* Simulation Controls */}
      {!isRunning ? (
        <ActionButton
          icon={<Play size={20} className="text-green-500" />}
          label={t('evacuation.startSimulation')}
          shortcut="F9"
          onClick={handleStart}
        />
      ) : (
        <ActionButton
          icon={<Square size={20} className="text-yellow-500" />}
          label={t('evacuation.stopSimulation')}
          onClick={stopSimulation}
        />
      )}

      <ActionButton
        icon={<RotateCcw size={20} />}
        label={t('evacuation.reset')}
        onClick={reset}
        disabled={stats.totalAgents === 0}
      />

      {/* Settings Popover */}
      <Popover open={showSettings} onOpenChange={setShowSettings}>
        <PopoverTrigger asChild>
          <button
            className="p-2 rounded hover:bg-accent transition-colors"
            title={t('evacuation.settings')}
          >
            <Settings size={20} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-sm flex items-center gap-2">
              <Users size={16} />
              {t('evacuation.title')}
            </div>

            {/* Agents per space */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">
                {t('evacuation.agentsPerSpace')}
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
                {t('evacuation.walkingSpeed')}
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
                <div className="text-xs font-medium mb-1">{t('evacuation.statistics')}</div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div className="flex justify-between">
                    <span>{t('evacuation.evacuated')}</span>
                    <span>{stats.exitedAgents} / {stats.totalAgents}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('evacuation.time')}</span>
                    <span>{stats.elapsedTime.toFixed(1)}s</span>
                  </div>
                  {stats.exitedAgents > 0 && stats.totalAgents > 0 && (
                    <div className="flex justify-between">
                      <span>{t('evacuation.progress')}</span>
                      <span>{((stats.exitedAgents / stats.totalAgents) * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info */}
            <div className="border-t pt-2 mt-1 text-xs text-muted-foreground">
              <p>{t('evacuation.infoText')}</p>
              <p className="mt-1">{t('evacuation.tipText')}</p>
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
