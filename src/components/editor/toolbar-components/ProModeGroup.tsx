/**
 * PRO Mode Toolbar Group
 *
 * Controls for activating PRO mode and toggling modules.
 * Includes evacuation simulation when fire-safety module is active.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import {
  Flame,
  ShieldCheck,
  Play,
  Square,
  RotateCcw,
  Settings,
  Users,
  Brush,
  ClipboardList,
} from 'lucide-react';
import { CleaningPlanOverview } from '@/components/panels/CleaningPlanOverview';
import { useProModeStore, useElementStore, useProjectStore } from '@/store';
import { useEvacuationStore } from '@/store/useEvacuationStore';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/Popover';
import { ActionButton } from './ToolbarButtons';

export const ProModeGroup: React.FC = () => {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [showCleaningPlan, setShowCleaningPlan] = useState(false);

  // PRO Mode state
  const isProMode = useProModeStore((state) => state.isProMode);
  const modules = useProModeStore((state) => state.modules);
  const activeModule = useProModeStore((state) => state.activeModule);
  const enableProMode = useProModeStore((state) => state.enableProMode);
  const disableProMode = useProModeStore((state) => state.disableProMode);
  const toggleModule = useProModeStore((state) => state.toggleModule);
  const setActiveModule = useProModeStore((state) => state.setActiveModule);
  const isModuleEnabled = useProModeStore((state) => state.isModuleEnabled);

  // Evacuation state
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

  const handleStartSimulation = () => {
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

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Flame':
        return <Flame className="w-4 h-4" />;
      case 'Brush':
        return <Brush className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const isFireSafetyActive = isModuleEnabled('fire-safety') && activeModule === 'fire-safety';
  const isCleaningActive = isModuleEnabled('cleaning') && activeModule === 'cleaning';

  return (
    <div className="flex items-center gap-2 border-l pl-2 ml-2">
      {/* PRO Mode Toggle - Golden with glow effect */}
      <Button
        variant={isProMode ? 'default' : 'outline'}
        size="sm"
        onClick={() => (isProMode ? disableProMode() : enableProMode())}
        title={t('proMode.tooltip')}
        className={cn(
          'font-bold transition-all duration-300 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 text-black animate-golden-glow hover:scale-105',
          isProMode
            ? 'ring-4 ring-yellow-300 ring-offset-2 ring-offset-background'
            : ''
        )}
      >
        <ShieldCheck className="w-4 h-4 mr-2" />
        PRO
      </Button>

      {/* Module Buttons */}
      {isProMode &&
        modules.map((module) => (
          <Button
            key={module.id}
            variant={module.enabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              toggleModule(module.id);
              if (!module.enabled) {
                setActiveModule(module.id);
              } else {
                if (activeModule === module.id) {
                  setActiveModule(null);
                }
              }
            }}
            className={cn(
              'flex items-center gap-2 transition-all',
              activeModule === module.id && 'ring-2 ring-offset-2',
              module.id === 'fire-safety' && activeModule === module.id && 'ring-orange-500',
              module.id === 'cleaning' && activeModule === module.id && 'ring-blue-500'
            )}
            title={module.description}
          >
            {getIcon(module.icon)}
            {module.name}
          </Button>
        ))}

      {/* Evacuation Simulation Controls - only visible when fire-safety is active */}
      {isFireSafetyActive && (
        <>
          <div className="border-l pl-2 ml-1 flex items-center gap-1">
            {!isRunning ? (
              <ActionButton
                icon={<Play size={20} className="text-green-500" />}
                label={t('evacuation.startSimulation')}
                shortcut="F9"
                onClick={handleStartSimulation}
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

            {/* Simulation Settings Popover */}
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

                  <div className="border-t pt-2 mt-1 text-xs text-muted-foreground">
                    <p>{t('evacuation.infoText')}</p>
                    <p className="mt-1">{t('evacuation.tipText')}</p>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Live Stats Display */}
          {stats.totalAgents > 0 && (
            <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded text-xs">
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
        </>
      )}

      {/* Cleaning & FM Module Controls */}
      {isCleaningActive && (
        <div className="border-l pl-2 ml-1 flex items-center gap-1">
          <Popover open={showCleaningPlan} onOpenChange={setShowCleaningPlan}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <ClipboardList size={16} />
                Reinigungsplan
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[600px] max-h-[500px] overflow-y-auto" align="end">
              <div className="space-y-3">
                <div className="font-semibold text-sm flex items-center gap-2 sticky top-0 bg-popover pb-2 border-b">
                  <ClipboardList size={16} className="text-blue-500" />
                  Reinigungsplan - Übersicht aller Räume
                </div>
                <CleaningPlanOverview />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
};
