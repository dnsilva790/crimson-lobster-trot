"use client";

import { useEffect } from "react";
import { TodoistTask } from "@/lib/types";

interface UseKeyboardShortcutsProps {
  execucaoState: "initial" | "focusing" | "finished";
  isLoading: boolean;
  currentTask: TodoistTask | null;
  onComplete: (taskId: string) => Promise<void>;
  onSkip: () => Promise<void>;
  onOpenReschedulePopover: () => void;
}

export const useKeyboardShortcuts = ({
  execucaoState,
  isLoading,
  currentTask,
  onComplete,
  onSkip,
  onOpenReschedulePopover,
}: UseKeyboardShortcutsProps) => {
  // Removendo o useEffect que adicionava os listeners de teclado.
  // Isso desativa os atalhos de teclado para as ações de tarefa.
  // useEffect(() => {
  //   const handleKeyDown = (event: KeyboardEvent) => {
  //     if (isLoading || execucaoState !== "focusing" || !currentTask) {
  //       return;
  //     }

  //     switch (event.key) {
  //       case "c":
  //       case "C":
  //         event.preventDefault();
  //         onComplete(currentTask.id);
  //         break;
  //       case "r":
  //       case "R":
  //         event.preventDefault();
  //         onOpenReschedulePopover();
  //         break;
  //       case "p":
  //       case "P":
  //         event.preventDefault();
  //         onSkip();
  //         break;
  //       default:
  //         break;
  //     }
  //   };

  //   window.addEventListener("keydown", handleKeyDown);

  //   return () => {
  //     window.removeEventListener("keydown", handleKeyDown);
  //   };
  // }, [execucaoState, isLoading, currentTask, onComplete, onSkip, onOpenReschedulePopover]);
};