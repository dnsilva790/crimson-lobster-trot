"use client";

import { useState, useEffect, useCallback } from "react";
import { EisenhowerTask, Quadrant } from "@/lib/types";
import { toast } from "sonner";

const EISENHOWER_STORAGE_KEY = "eisenhowerMatrixState";

interface EisenhowerState {
  tasksToProcess: EisenhowerTask[];
  currentView: string;
}

export const useEisenhowerTasks = () => {
  const [eisenhowerTasks, setEisenhowerTasks] = useState<EisenhowerTask[]>([]);
  const [isEisenhowerLoaded, setIsEisenhowerLoaded] = useState(false);

  const loadEisenhowerTasks = useCallback(() => {
    const savedState = localStorage.getItem(EISENHOWER_STORAGE_KEY);
    if (savedState) {
      try {
        const parsedState: EisenhowerState = JSON.parse(savedState);
        const ratedAndCategorizedTasks = (parsedState.tasksToProcess || []).filter(
          t => t.quadrant !== null
        );
        setEisenhowerTasks(ratedAndCategorizedTasks);
        setIsEisenhowerLoaded(true);
      } catch (e) {
        console.error("Failed to load Eisenhower state:", e);
        setEisenhowerTasks([]);
        setIsEisenhowerLoaded(true);
      }
    } else {
      setEisenhowerTasks([]);
      setIsEisenhowerLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadEisenhowerTasks();
    window.addEventListener('storage', loadEisenhowerTasks);
    return () => window.removeEventListener('storage', loadEisenhowerTasks);
  }, [loadEisenhowerTasks]);

  return {
    eisenhowerTasks,
    isEisenhowerLoaded,
  };
};