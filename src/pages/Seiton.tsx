import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TournamentState = "initial" | "comparing" | "finished";

// Define a interface para o estado que será salvo no histórico
interface SeitonStateSnapshot {
  tasksToProcess: TodoistTask[];
  rankedTasks: TodoistTask[];
  currentTaskToPlace: TodoistTask | null;
  comparisonCandidate: TodoistTask | null;
  comparisonIndex: number;
  tournamentState: TournamentState;
}

const Seiton = () => {
  const { fetchTasks, isLoading } = useTodoist();
  const [tournamentState, setTournamentState] = useState<TournamentState>("initial");
  const [tasksToProcess, setTasksToProcess] = useState<TodoistTask[]>([]); // Tarefas aguardando para serem classificadas
  const [rankedTasks, setRankedTasks] = useState<TodoistTask[]>([]); // Tarefas já classificadas (mais importantes primeiro)
  const [currentTaskToPlace, setCurrentTaskToPlace] = useState<TodoistTask | null>(null); // A tarefa que está sendo inserida no ranking
  const [comparisonCandidate, setComparisonCandidate] = useState<TodoistTask | null>(null); // A tarefa do rankedTasks com a qual currentTaskToPlace está sendo comparada
  const [comparisonIndex, setComparisonIndex] = useState<number>(0); // Índice em rankedTasks para a comparação
  const [history, setHistory] = useState<SeitonStateSnapshot[]>([]); // Histórico de estados para a função desfazer

  const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
    4: "bg-red-500", // P1 - Urgente
    3: "bg-orange-500", // P2 - Alto
    2: "bg-yellow-500", // P3 - Médio
    1: "bg-gray-400", // P4 - Baixo
  };

  const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
    4: "P1 - Urgente",
    3: "P2 - Alto",
    2: "P3 - Médio",
    1: "P4 - Baixo",
  };

  // Função para ordenar as tarefas com base nos critérios combinados
  const sortTasks = useCallback((tasks: TodoistTask[]): TodoistTask[] => {
    return [...tasks].sort((a, b) => {
      // 1. Tarefas iniciadas com "*" primeiro
      const isAStarred = a.content.startsWith("*");
      const isBStarred = b.content.startsWith("*");
      if (isAStarred && !isBStarred) return -1;
      if (!isAStarred && isBStarred) return 1;

      // 2. Em seguida, por prioridade (P1 > P4)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }

      // 3. Depois, por prazo (mais próximo primeiro)
      const dateA = a.due?.datetime || a.due?.date;
      const dateB = b.due?.datetime || b.due?.date;

      if (dateA && dateB) {
        const timeA = new Date(dateA).getTime();
        const timeB = new Date(dateB).getTime();
        if (timeA !== timeB) {
          return timeA - timeB;
        }
      }
      if (dateA && !dateB) return -1; // A tem prazo, B não
      if (!dateA && dateB) return 1; // B tem prazo, A não

      // 4. Desempate final: por data de criação (mais antiga primeiro)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, []);

  // Salva o estado atual no histórico
  const saveStateToHistory = useCallback(() => {
    setHistory((prev) => [
      ...prev,
      {
        tasksToProcess,
        rankedTasks,
        currentTaskToPlace,
        comparisonCandidate,
        comparisonIndex,
        tournamentState,
      },
    ]);
  }, [tasksToProcess, rankedTasks, currentTaskToPlace, comparisonCandidate, comparisonIndex, tournamentState]);

  // Desfaz a última ação
  const undoLastAction = useCallback(() => {
    if (history.length > 0) {
      const lastState = history[history.length - 1];
      setTasksToProcess(lastState.tasksToProcess);
      setRankedTasks(lastState.rankedTasks);
      setCurrentTaskToPlace(lastState.currentTaskToPlace);
      setComparisonCandidate(lastState.comparisonCandidate);
      setComparisonIndex(lastState.comparisonIndex);
      setTournamentState(lastState.tournamentState);
      setHistory((prev) => prev.slice(0, prev.length - 1));
      toast.info("Última ação desfeita.");
    } else {
      toast.info("Não há ações para desfazer.");
    }
  }, [history]);

  const startTournament = useCallback(async () => {
    setTournamentState("initial");
    setTasksToProcess([]);
    setRankedTasks([]);
    setCurrentTaskToPlace(null);
    setComparisonCandidate(null);
    setComparisonIndex(0);
    setHistory([]); // Limpar histórico ao iniciar novo torneio

    const allTasks = await fetchTasks();
    if (allTasks && allTasks.length > 0) {
      const sortedTasks = sortTasks(allTasks); // Aplicar ordenação combinada
      setTasksToProcess(sortedTasks);
      setTournamentState("comparing");
    } else {
      toast.info("Nenhuma tarefa encontrada para o torneio. Adicione tarefas ao Todoist!");
      setTournamentState("finished");
    }
  }, [fetchTasks, sortTasks]);

  const startNextPlacement = useCallback(() => {
    if (tasksToProcess.length === 0) {
      setTournamentState("finished");
      setCurrentTaskToPlace(null);
      setComparisonCandidate(null);
      return;
    }

    saveStateToHistory();

    const nextTask = tasksToProcess[0];
    setCurrentTaskToPlace(nextTask);
    setTasksToProcess((prev) => prev.slice(1));

    if (rankedTasks.length === 0) {
      setRankedTasks([nextTask]);
      setCurrentTaskToPlace(null);
      setComparisonCandidate(null);
      setComparisonIndex(0);
    } else {
      setComparisonIndex(0);
      setComparisonCandidate(rankedTasks[0]);
    }
  }, [tasksToProcess, rankedTasks, saveStateToHistory]);

  useEffect(() => {
    if (tournamentState === "comparing" && !currentTaskToPlace) {
      startNextPlacement();
    }
  }, [tournamentState, currentTaskToPlace, startNextPlacement]);

  const handleSelection = useCallback(
    (winner: TodoistTask) => {
      if (!currentTaskToPlace || !comparisonCandidate) return;

      saveStateToHistory();

      const isCurrentTaskToPlaceWinner = winner.id === currentTaskToPlace.id;

      if (isCurrentTaskToPlaceWinner) {
        const nextComparisonIndex = comparisonIndex + 1;
        if (nextComparisonIndex >= rankedTasks.length) {
          if (rankedTasks.length < 24) {
            setRankedTasks((prev) => [...prev, currentTaskToPlace]);
          } else {
            setRankedTasks((prev) => [currentTaskToPlace, ...prev.slice(0, 23)]);
          }
          setCurrentTaskToPlace(null);
          setComparisonCandidate(null);
          setComparisonIndex(0);
        } else {
          setComparisonIndex(nextComparisonIndex);
          setComparisonCandidate(rankedTasks[nextComparisonIndex]);
        }
      } else {
        if (rankedTasks.length < 24 || comparisonIndex < 24) {
          setRankedTasks((prev) => {
            const newRanked = [...prev];
            newRanked.splice(comparisonIndex, 0, currentTaskToPlace);
            if (newRanked.length > 24) {
              newRanked.pop();
            }
            return newRanked;
          });
        } else {
          toast.info(`Tarefa "${currentTaskToPlace.content}" descartada pois o ranking já está cheio e ela não é mais prioritária.`);
        }
        setCurrentTaskToPlace(null);
        setComparisonCandidate(null);
        setComparisonIndex(0);
      }
    },
    [currentTaskToPlace, comparisonCandidate, comparisonIndex, rankedTasks, saveStateToHistory],
  );

  const renderTaskCard = (task: TodoistTask, isClickable: boolean = false) => (
    <Card
      key={task.id}
      className={cn(
        "p-4 rounded-lg shadow-md flex flex-col justify-between h-full",
        isClickable && "cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all duration-200",
        task.priority === 4 && "border-l-4 border-red-500",
        task.priority === 3 && "border-l-4 border-orange-500",
        task.priority === 2 && "border-l-4 border-yellow-500",
        task.priority === 1 && "border-l-4 border-gray-400",
      )}
      onClick={isClickable ? () => handleSelection(task) : undefined}
    >
      <div>
        <h3 className="text-xl font-semibold mb-2 text-gray-800">{task.content}</h3>
        {task.description && (
          <p className="text-sm text-gray-600 mb-2 line-clamp-3">{task.description}</p>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-2">
        {task.due?.datetime ? (
          <span>Vencimento: {format(new Date(task.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
        ) : task.due?.date ? (
          <span>Vencimento: {format(new Date(task.due.date), "dd/MM/yyyy", { locale: ptBR })}</span>
        ) : (
          <span>Sem prazo</span>
        )}
        <span
          className={cn(
            "px-2 py-1 rounded-full text-white text-xs font-medium",
            PRIORITY_COLORS[task.priority],
          )}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>
    </Card>
  );

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">🏆 SEITON - Torneio de Priorização</h2>
      <p className="text-lg text-gray-600 mb-6">
        Compare 2 tarefas por vez. Qual é mais importante agora?
      </p>

      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <LoadingSpinner size={40} />
        </div>
      )}

      {!isLoading && tournamentState === "initial" && (
        <div className="text-center mt-10">
          <Button
            onClick={startTournament}
            className="px-8 py-4 text-xl bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          >
            Iniciar Torneio
          </Button>
        </div>
      )}

      {!isLoading && tournamentState === "comparing" && currentTaskToPlace && comparisonCandidate && (
        <div className="mt-8">
          <p className="text-center text-xl font-medium mb-6 text-gray-700">
            Tarefas restantes para classificar: {tasksToProcess.length + 1}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderTaskCard(currentTaskToPlace, true)}
            {renderTaskCard(comparisonCandidate, true)}
          </div>
          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={() => handleSelection(currentTaskToPlace)}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 text-lg"
            >
              Escolher Esquerda
            </Button>
            <Button
              onClick={() => handleSelection(comparisonCandidate)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 text-lg"
            >
              Escolher Direita
            </Button>
          </div>
          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={undoLastAction}
              disabled={history.length === 0}
              className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-3 text-lg"
            >
              Desfazer
            </Button>
            <Button
              onClick={startTournament}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 text-lg"
            >
              Resetar Ranking
            </Button>
          </div>
        </div>
      )}

      {!isLoading && tournamentState === "finished" && (
        <div className="mt-8">
          <h3 className="text-3xl font-bold mb-6 text-center text-indigo-800">
            🎯 Ranking de Prioridades
          </h3>
          {rankedTasks.length > 0 ? (
            <div className="space-y-4">
              {rankedTasks.map((task, index) => (
                <Card
                  key={task.id}
                  className={cn(
                    "p-4 rounded-lg shadow-md flex items-center gap-4",
                    index === 0 && "bg-gradient-to-r from-yellow-100 to-yellow-200 border-yellow-500",
                    index === 1 && "bg-gradient-to-r from-gray-100 to-gray-200 border-gray-400",
                    index === 2 && "bg-gradient-to-r from-amber-100 to-amber-200 border-amber-500",
                    "border-l-4",
                  )}
                >
                  <span className="text-2xl font-bold text-gray-700 w-8 text-center">
                    {index + 1}º
                  </span>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-800">{task.content}</h4>
                    {task.description && (
                      <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                    )}
                  </div>
                  {index < 3 && (
                    <span className="ml-auto text-3xl">
                      {index === 0 && "🥇"}
                      {index === 1 && "🥈"}
                      {index === 2 && "🥉"}
                    </span>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600 text-lg">
              Nenhuma tarefa foi classificada neste torneio.
            </p>
          )}
          <div className="flex justify-center gap-4 mt-8">
            <Button
              onClick={startTournament}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 text-lg"
            >
              Refazer Torneio
            </Button>
            <Button
              onClick={undoLastAction}
              disabled={history.length === 0}
              className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-3 text-lg"
            >
              Desfazer Última Ação
            </Button>
            {/* O botão "Aplicar ao Todoist" está comentado pois requer a implementação de um endpoint de atualização de tarefa na API do Todoist, que não está disponível no serviço atual. */}
            {/* <Button
              onClick={() => toast.info("Funcionalidade 'Aplicar ao Todoist' em desenvolvimento.")}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 text-lg"
            >
              Aplicar ao Todoist
            </Button> */}
          </div>
        </div>
      )}
    </div>
  );
};

export default Seiton;