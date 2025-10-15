"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User, ClipboardCopy } from "lucide-react";
import { TodoistTask } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, isToday, isTomorrow, isPast, addHours, getHours, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTodoist } from "@/context/TodoistContext";

interface AIAgentAssistantProps {
  aiPrompt: string;
  currentTask: TodoistTask | null; // Tarefa selecionada no dropdown
  allTasks: TodoistTask[]; // Todas as tarefas para o Radar de Produtividade
  updateTask: (taskId: string, data: {
    content?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    labels?: string[];
    duration?: number;
    duration_unit?: "minute" | "day";
    deadline?: string | null;
  }) => Promise<TodoistTask | undefined>;
  closeTask: (taskId: string) => Promise<void>;
  onTaskSuggested: (task: TodoistTask) => void; // Nova prop para sugerir tarefa
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

interface DelegateInfo {
  name: string;
  responsibilities: string;
}

const AI_CHAT_HISTORY_KEY_PREFIX = "ai_agent_chat_history_task_";

const AIAgentAssistant: React.FC<AIAgentAssistantProps> = ({
  aiPrompt,
  currentTask, // Tarefa selecionada no dropdown
  allTasks, // Recebido como prop
  updateTask,
  closeTask,
  onTaskSuggested, // Nova prop
}) => {
  const { isLoading: isLoadingTodoist } = useTodoist(); // Use isLoading from context
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [lastGeneratedReport, setLastGeneratedReport] = useState<string | null>(null);
  const [suggestedTaskForGuidance, setSuggestedTaskForGuidance] = useState<TodoistTask | null>(null); // Nova tarefa sugerida pelo IA
  const scrollAreaRef = useRef<HTMLDivElement>(null); // Corrigido o tipo para HTMLDivElement

  // Determine the task context: explicit selection first, then AI suggestion
  const taskContext = currentTask || suggestedTaskForGuidance;

  const getTaskHistoryKey = useCallback((taskId: string) => {
    return `${AI_CHAT_HISTORY_KEY_PREFIX}${taskId}`;
  }, []);

  // Load messages for the current task (from dropdown) or clear if none selected
  useEffect(() => {
    if (taskContext) {
      const savedHistory = localStorage.getItem(getTaskHistoryKey(taskContext.id));
      if (savedHistory) {
        setMessages(JSON.parse(savedHistory));
      } else {
        setMessages([]);
        addMessage("ai", `Olá! Sou o Tutor IA SEISO. Como posso te ajudar a focar e executar a tarefa "${taskContext.content}" hoje?`);
      }
    } else {
      setMessages([]); // Clear messages if no task is in focus
      addMessage("ai", "Olá! Sou o Tutor IA SEISO. Estou pronto para te ajudar a organizar suas tarefas. Qual a próxima tarefa que devo executar?");
    }
    setLastGeneratedReport(null); // Clear last generated report when task changes
  }, [taskContext, getTaskHistoryKey]);

  // Save messages whenever they change for the current task (from dropdown) or suggested task
  useEffect(() => {
    const taskIdToSave = taskContext?.id; // Usar taskContext aqui
    if (taskIdToSave && messages.length > 0) {
      localStorage.setItem(getTaskHistoryKey(taskIdToSave), JSON.stringify(messages));
    }
  }, [messages, taskContext, getTaskHistoryKey]); // Depender de taskContext

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = useCallback((sender: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender, text }]);
  }, []);

  const parseDelegateInfo = useCallback((): DelegateInfo[] => {
    const delegateSectionMatch = aiPrompt.match(/MINHA EQUIPE \(PARA DELEGAÇÃO\)\n([\s\S]*?)(?=\n\n[A-Z]|$)/);
    if (!delegateSectionMatch) return [];

    const delegateLines = delegateSectionMatch[1].split('\n').filter(line => line.trim().startsWith('Ingrid:') || line.trim().startsWith('João:') || line.trim().startsWith('Samara:') || line.trim().startsWith('Francisco:') || line.trim().startsWith('David:') || line.trim().startsWith('Cazé/Ana Julia:'));
    
    return delegateLines.map(line => {
      const match = line.match(/([A-Za-z\s\/]+):\s*(.*)/);
      if (match) {
        return { name: match[1].trim(), responsibilities: match[2].trim() };
      }
      return null;
    }).filter(Boolean) as DelegateInfo[];
  }, [aiPrompt]);

  const parseCriticalStakeholders = useCallback((): string[] => {
    const stakeholdersMatch = aiPrompt.match(/Stakeholders Críticos:\s*(.*)/);
    if (stakeholdersMatch && stakeholdersMatch[1]) {
      return stakeholdersMatch[1].split(',').map(s => s.trim());
    }
    return [];
  }, [aiPrompt]);

  const generateTodoistUpdateSuggestion = useCallback((progress: string, nextStep: string) => {
    return `\`\`\`
[PROGRESSO]: ${progress}
[PRÓXIMO PASSO]: _${nextStep}_
\`\`\``;
  }, []);

  const simulateAIResponse = useCallback(async (userMessage: string) => {
    setIsThinking(true);
    let responseText = "Não entendi sua solicitação. Por favor, tente novamente.";

    if (!taskContext && !userMessage.toLowerCase().includes("radar") && !userMessage.toLowerCase().includes("sugerir próxima tarefa")) {
      responseText = "Por favor, selecione uma tarefa ou me peça para sugerir a próxima tarefa com o 'Radar de Produtividade'.";
      addMessage("ai", responseText);
      setIsThinking(false);
      return;
    }

    const taskContent = taskContext?.content || "a tarefa atual";
    const taskDescription = taskContext?.description;
    const taskPriority = taskContext?.priority || 1;
    const delegates = parseDelegateInfo();
    const criticalStakeholders = parseCriticalStakeholders();

    const lowerCaseMessage = userMessage.toLowerCase();

    if (lowerCaseMessage.includes("próximo passo") || lowerCaseMessage.includes("o que fazer")) {
      let nextStepSuggestion = "";
      if (taskDescription && taskDescription.trim().length > 0) {
        nextStepSuggestion = `Para a tarefa "${taskContent}", vamos quebrar a descrição em micro-ações. Qual é a primeira ação concreta que você pode tirar da descrição?`;
        responseText = `${nextStepSuggestion}\n\nDescrição da Tarefa:\n\`\`\`\n${taskDescription}\n\`\`\``;
      } else {
        nextStepSuggestion = `Para a tarefa "${taskContent}", o próximo passo é: **Definir a primeira micro-ação clara e sob seu controle.**`;
        responseText = `${nextStepSuggestion}\n\n${generateTodoistUpdateSuggestion("Nenhum progresso registrado ainda.", nextStepSuggestion.replace('Para a tarefa "' + taskContent + '", o próximo passo é: ', ''))}`;
      }
    } else if (lowerCaseMessage.includes("delegar")) {
      if (delegates.length > 0) {
        const delegateList = delegates.map(d => `* **${d.name}**: ${d.responsibilities}`).join('\n');
        responseText = `Para quem você gostaria de delegar a tarefa "${taskContent}"? Minha equipe disponível é:\n\n${delegateList}\n\nPor favor, me diga o nome do responsável.`;
      } else {
        responseText = `Para delegar "${taskContent}", preciso saber: **Para quem você gostaria de delegar esta tarefa?** (Não encontrei informações de equipe no seu prompt de IA.)`;
      }
    } else if (lowerCaseMessage.includes("status")) {
      const dueDate = taskContext?.due?.datetime 
        ? format(parseISO(taskContext.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : taskContext?.due?.date
        ? format(parseISO(taskContext.due.date), "dd/MM/yyyy", { locale: ptBR })
        : "sem prazo definido";
      
      const deadline = taskContext?.deadline 
        ? format(parseISO(taskContext.deadline), "dd/MM/yyyy", { locale: ptBR })
        : "não definido";

      responseText = `O status atual da tarefa "${taskContent}" é P${taskPriority}. Vencimento: ${dueDate}. Deadline: ${deadline}.`;
      responseText += `\n\nSe precisar de um relatório formatado para o Todoist, use os botões "Gerar Status" ou "Gerar Próximo Passo" abaixo.`;
    } else if (lowerCaseMessage.includes("ajuda") || lowerCaseMessage.includes("coach")) {
      responseText = `Estou aqui para te ajudar a quebrar a tarefa "${taskContent}" em micro-ações e manter o foco. Qual é a sua maior dificuldade com ela agora? Ou podemos definir o próximo passo?`;
    } else if (lowerCaseMessage.includes("concluir")) {
      if (taskContext) {
        await closeTask(taskContext.id);
        responseText = `Excelente! Tarefa "${taskContent}" concluída. Parabéns!`;
        setSuggestedTaskForGuidance(null); // Clear suggested task after completion
      } else {
        responseText = "Não há uma tarefa em foco para concluir.";
      }
    } else if (lowerCaseMessage.includes("gerar status") || lowerCaseMessage.includes("gerar próximo passo")) {
      responseText = `Para gerar um relatório formatado para o Todoist, por favor, use os botões dedicados "Gerar Status" ou "Gerar Próximo Passo" abaixo do campo de texto.`;
    } else if (lowerCaseMessage.includes("radar") || lowerCaseMessage.includes("sugerir próxima tarefa") || lowerCaseMessage.includes("qual a próxima tarefa")) {
      const now = new Date();
      const startOfToday = startOfDay(now);

      // 1. PRIORIDADE ZERO: Deadlines hoje ou amanhã
      const priorityZeroTasks = allTasks.filter(task => 
        task.deadline && isValid(parseISO(task.deadline)) && 
        (isToday(parseISO(task.deadline)) || isTomorrow(parseISO(task.deadline))) &&
        !task.is_completed
      ).sort((a, b) => {
        const deadlineA = a.deadline ? parseISO(a.deadline).getTime() : Infinity;
        const deadlineB = b.deadline ? parseISO(b.deadline).getTime() : Infinity;
        return deadlineA - deadlineB;
      });

      if (priorityZeroTasks.length > 0) {
        const nextPriorityZeroTask = priorityZeroTasks[0];
        setSuggestedTaskForGuidance(nextPriorityZeroTask);
        onTaskSuggested(nextPriorityZeroTask); // Emit suggested task
        responseText = `PRIORIDADE ZERO: A tarefa "${nextPriorityZeroTask.content}" tem um deadline para ${format(parseISO(nextPriorityZeroTask.deadline!), "dd/MM/yyyy", { locale: ptBR })}. Recomendo focar nela para zerar pendências.`;
      } else {
        // 2. LÓGICA DE SUGESTÃO INTEGRADA (RADAR DE PRODUTIVIDADE)
        let bestTaskA: TodoistTask | null = null;
        let bestScoreA = -Infinity;

        // Score tasks for "Próxima Ação Urgente (A)"
        allTasks.filter(task => !task.is_completed).forEach(task => {
          let score = 0;
          const isCriticalStakeholder = criticalStakeholders.some(cs => task.content.toLowerCase().includes(cs.toLowerCase()) || task.description.toLowerCase().includes(cs.toLowerCase()));
          
          if (isCriticalStakeholder) score += 500; // High impact for critical stakeholders

          // Priority scoring
          switch (task.priority) {
            case 4: score += 100; break; // P1
            case 3: score += 70; break; // P2
            case 2: score += 40; break; // P3
            case 1: score += 10; break; // P4
          }

          // Deadline proximity
          if (task.deadline && isValid(parseISO(task.deadline))) {
            const daysUntilDeadline = differenceInDays(parseISO(task.deadline), startOfToday);
            if (daysUntilDeadline <= 0) score += 200; // Overdue or today
            else if (daysUntilDeadline <= 3) score += 150 - (daysUntilDeadline * 10); // Very close
            else if (daysUntilDeadline <= 7) score += 50 - (daysUntilDeadline * 5); // Close
          }

          // Due date/time proximity
          let effectiveDueDate: Date | null = null;
          if (task.due?.datetime && isValid(parseISO(task.due.datetime))) {
            effectiveDueDate = parseISO(task.due.datetime);
          } else if (task.due?.date && isValid(parseISO(task.due.date))) {
            effectiveDueDate = parseISO(task.due.date);
          }

          if (effectiveDueDate) {
            const daysUntilDue = differenceInDays(effectiveDueDate, startOfToday);
            if (daysUntilDue <= 0) score += 100; // Overdue or today
            else if (daysUntilDue <= 3) score += 70 - (daysUntilDue * 5);
            else if (daysUntilDue <= 7) score += 30 - (daysUntilDue * 2);
          }

          if (score > bestScoreA) {
            bestScoreA = score;
            bestTaskA = task;
          }
        });

        // Simplified "Tarefa de Preparação Candidata (B)" and "Compare A e B"
        // For simulation, we'll just suggest the bestTaskA, and add a note about preparation if relevant.
        if (bestTaskA) {
          setSuggestedTaskForGuidance(bestTaskA);
          onTaskSuggested(bestTaskA); // Emit suggested task
          responseText = `RADAR DE PRODUTIVIDADE: A próxima ação urgente identificada é "${bestTaskA.content}" (P${bestTaskA.priority}).`;
          if (bestTaskA.deadline) {
            responseText += ` Com deadline para ${format(parseISO(bestTaskA.deadline), "dd/MM/yyyy", { locale: ptBR })}.`;
          } else if (bestTaskA.due?.date || bestTaskA.due?.datetime) {
            responseText += ` Com vencimento para ${format(parseISO(bestTaskA.due?.datetime || bestTaskA.due?.date!), "dd/MM/yyyy", { locale: ptBR })}.`;
          }

          // Consideração de Energia (Concerta peak)
          const currentHour = getHours(now);
          if (bestTaskA.labels.includes("profissional") && currentHour >= 6 && currentHour < 10) {
            responseText += `\n\nLembre-se: você está no seu pico de produtividade (06h-10h) após o Concerta. Aproveite para focar nesta tarefa profissional!`;
          } else {
            responseText += `\n\nLembre-se do seu ciclo de energia.`;
          }
        } else {
          responseText = `RADAR DE PRODUTIVIDADE: Não identifiquei tarefas com Prioridade Zero ou ações urgentes no momento. Podemos focar na tarefa atual ou buscar por outras prioridades?`;
        }
      }
    }
    else {
      responseText = `Com a tarefa "${taskContent}" em foco, como posso te auxiliar? Posso te ajudar a definir o próximo passo, delegar, ou analisar o status?`;
    }

    setTimeout(() => {
      addMessage("ai", responseText);
      setIsThinking(false);
    }, 1500); // Simulate AI thinking time
  }, [addMessage, currentTask, allTasks, closeTask, aiPrompt, parseDelegateInfo, parseCriticalStakeholders, generateTodoistUpdateSuggestion, updateTask, suggestedTaskForGuidance, onTaskSuggested, taskContext]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "" || isThinking) return;

    addMessage("user", inputMessage);
    const userMsg = inputMessage;
    setInputMessage("");

    simulateAIResponse(userMsg);
  };

  const handleGenerateStatusReport = useCallback(() => {
    const taskToReport = taskContext; // Usar taskContext aqui
    if (!taskToReport) {
      toast.error("Selecione uma tarefa ou peça uma sugestão para gerar o relatório de status.");
      return;
    }
    const statusText = `Nesta sessão de foco, você trabalhou na tarefa: ${taskToReport.content}.`;
    const nextStepText = `Definir a próxima micro-ação para avançar com a tarefa.`;
    const report = generateTodoistUpdateSuggestion(statusText, nextStepText);
    setLastGeneratedReport(report);
    toast.success("Relatório de status gerado!");
  }, [taskContext, generateTodoistUpdateSuggestion]); // Depender de taskContext

  const handleGenerateNextStepReport = useCallback(() => {
    const taskToReport = taskContext; // Usar taskContext aqui
    if (!taskToReport) {
      toast.error("Selecione uma tarefa ou peça uma sugestão para gerar o relatório de próximo passo.");
      return;
    }
    const nextStepText = `${taskToReport.content} (Definir a próxima micro-ação).`;
    const report = generateTodoistUpdateSuggestion("(Preencha aqui o que foi feito na última sessão)", nextStepText);
    setLastGeneratedReport(report);
    toast.success("Relatório de próximo passo gerado!");
  }, [taskContext, generateTodoistUpdateSuggestion]); // Depender de taskContext

  const handleCopyReport = useCallback(() => {
    if (lastGeneratedReport) {
      // Remove markdown code block fences for actual copy
      const textToCopy = lastGeneratedReport.replace(/```\n/g, '').replace(/\n```/g, '');
      navigator.clipboard.writeText(textToCopy);
      toast.success("Relatório copiado para a área de transferência!");
    }
  }, [lastGeneratedReport]);

  return (
    <Card className="h-[calc(100vh-100px)] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-indigo-600" /> Tutor IA SEISO
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col p-0">
        <ScrollArea className="h-[calc(100vh-300px)] p-4" viewportRef={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={cn(
                    "max-w-[80%] p-3 rounded-lg shadow-sm",
                    msg.sender === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-800 border border-gray-200",
                  )}
                >
                  {msg.sender === "ai" && <span className="font-semibold text-indigo-600 block mb-1">Tutor IA:</span>}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg shadow-sm bg-gray-100 text-gray-800 border border-gray-200">
                  <span className="font-semibold text-indigo-600 block mb-1">Tutor IA:</span>
                  <span className="animate-pulse">Pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t flex flex-col gap-2">
          {lastGeneratedReport && (
            <div className="bg-gray-100 p-3 rounded-md border border-gray-200">
              <Label htmlFor="generated-report" className="text-sm font-semibold text-gray-700 mb-1 block">
                Relatório para Todoist:
              </Label>
              <Textarea
                id="generated-report"
                value={lastGeneratedReport}
                readOnly
                rows={4}
                className="font-mono text-xs resize-none"
              />
              <Button onClick={handleCopyReport} size="sm" className="w-full mt-2 flex items-center gap-1">
                <ClipboardCopy className="h-4 w-4" /> Copiar Relatório
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleGenerateStatusReport} disabled={!taskContext || isLoadingTodoist} className="flex items-center gap-1">
              <ClipboardCopy className="h-4 w-4" /> Gerar Status
            </Button>
            <Button onClick={handleGenerateNextStepReport} disabled={!taskContext || isLoadingTodoist} className="flex items-center gap-1">
              <ClipboardCopy className="h-4 w-4" /> Gerar Próximo Passo
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Converse com o Tutor IA..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage();
                }
              }}
              disabled={isThinking || isLoadingTodoist}
              className="flex-grow"
            />
            <Button onClick={handleSendMessage} disabled={isThinking || isLoadingTodoist}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIAgentAssistant;