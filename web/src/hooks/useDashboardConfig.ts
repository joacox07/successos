import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'successos_dashboard_config';

export interface DashboardConfig {
  goalOrder: number[];       // goal IDs in desired display order
  hiddenGoalIds: number[];   // goal IDs to hide from dashboard
  pinnedHabitIds: number[];  // habit IDs shown as streak widgets
}

const DEFAULT_CONFIG: DashboardConfig = {
  goalOrder: [],
  hiddenGoalIds: [],
  pinnedHabitIds: [],
};

function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      goalOrder: Array.isArray(parsed.goalOrder) ? parsed.goalOrder : [],
      hiddenGoalIds: Array.isArray(parsed.hiddenGoalIds) ? parsed.hiddenGoalIds : [],
      pinnedHabitIds: Array.isArray(parsed.pinnedHabitIds) ? parsed.pinnedHabitIds : [],
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: DashboardConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function useDashboardConfig() {
  const [config, setConfig] = useState<DashboardConfig>(loadConfig);

  const updateConfig = useCallback((updater: (prev: DashboardConfig) => DashboardConfig) => {
    setConfig(prev => {
      const next = updater(prev);
      saveConfig(next);
      return next;
    });
  }, []);

  const setGoalOrder = useCallback((ids: number[]) => {
    updateConfig(prev => ({ ...prev, goalOrder: ids }));
  }, [updateConfig]);

  const toggleGoalVisibility = useCallback((id: number) => {
    updateConfig(prev => ({
      ...prev,
      hiddenGoalIds: prev.hiddenGoalIds.includes(id)
        ? prev.hiddenGoalIds.filter(x => x !== id)
        : [...prev.hiddenGoalIds, id],
    }));
  }, [updateConfig]);

  const toggleHabitPin = useCallback((id: number) => {
    updateConfig(prev => ({
      ...prev,
      pinnedHabitIds: prev.pinnedHabitIds.includes(id)
        ? prev.pinnedHabitIds.filter(x => x !== id)
        : [...prev.pinnedHabitIds, id],
    }));
  }, [updateConfig]);

  const isGoalHidden = useCallback((id: number) => config.hiddenGoalIds.includes(id), [config.hiddenGoalIds]);
  const isHabitPinned = useCallback((id: number) => config.pinnedHabitIds.includes(id), [config.pinnedHabitIds]);

  return {
    config,
    setGoalOrder,
    toggleGoalVisibility,
    toggleHabitPin,
    isGoalHidden,
    isHabitPinned,
  };
}
