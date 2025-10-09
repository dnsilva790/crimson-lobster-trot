"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, Pause, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface TaskTimerProps {
  initialMaxTime?: number; // Tempo máximo em minutos
  onTimerEnd?: () => void;
}

const TaskTimer: React.FC<TaskTimerProps> = ({ initialMaxTime = 25, onTimerEnd }) => {
  const [maxTime, setMaxTime] = useState(initialMaxTime);
  const [timeLeft, setTimeLeft] = useState(initialMaxTime * 60); // Tempo em segundos
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const startTimer = useCallback(() => {
    if (timeLeft > 0) {
      setIsRunning(true);
      toast.info("Contador iniciado!");
    } else {
      toast.error("Defina um tempo máximo antes de iniciar.");
    }
  }, [timeLeft]);

  const pauseTimer = useCallback(() => {
    setIsRunning(false);
    toast.info("Contador pausado.");
  }, []);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRunning(false);
    setTimeLeft(maxTime * 60);
    toast.info("Contador resetado.");
  }, [maxTime]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsRunning(false);
      toast.success("Tempo esgotado! Hora de uma pausa ou próxima tarefa.");
      onTimerEnd?.();
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, timeLeft, onTimerEnd]);

  const handleMaxTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    if (!isNaN(value) && value > 0) {
      setMaxTime(value);
      if (!isRunning) { // Only reset timeLeft if timer is not running
        setTimeLeft(value * 60);
      }
    } else if (e.target.value === "") {
      setMaxTime(0);
      if (!isRunning) {
        setTimeLeft(0);
      }
    }
  };

  return (
    <div className="bg-red-50 p-6 rounded-lg shadow-inner text-center border border-red-200">
      <h3 className="text-xl font-bold mb-4 text-red-700">Contador de Tempo</h3>
      <div className="flex items-center justify-center gap-2 mb-4">
        <Label htmlFor="max-time" className="text-lg text-gray-700">Tempo Máximo (min):</Label>
        <Input
          id="max-time"
          type="number"
          value={maxTime === 0 ? "" : maxTime}
          onChange={handleMaxTimeChange}
          className="w-24 text-center text-lg"
          min="1"
          disabled={isRunning}
        />
      </div>
      <div className="text-6xl font-extrabold text-red-800 mb-6">
        {formatTime(timeLeft)}
      </div>
      <div className="flex justify-center gap-4">
        <Button
          onClick={isRunning ? pauseTimer : startTimer}
          className={isRunning ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700"}
          size="lg"
        >
          {isRunning ? <Pause className="mr-2 h-6 w-6" /> : <Play className="mr-2 h-6 w-6" />}
          {isRunning ? "Pausar" : "Iniciar"}
        </Button>
        <Button
          onClick={resetTimer}
          className="bg-gray-600 hover:bg-gray-700"
          size="lg"
        >
          <RotateCcw className="mr-2 h-6 w-6" /> Resetar
        </Button>
      </div>
    </div>
  );
};

export default TaskTimer;