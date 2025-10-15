"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Send, Bot, User, ClipboardCopy, RotateCcw } from "lucide-react";
import { TodoistTask } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, isToday, isTomorrow, isPast, addHours, getHours, differenceInDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTodoist } from "@/context/TodoistContext";
import { Label } from "@/components/ui/label";

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

type DialogueState = 'initial' | 'awaiting_task_action' | 'general_conversation';

const AI_CHAT_HISTORY_KEY_PREFIX = "ai_agent_chat_history_task_";
const AI_GENERAL_CHAT_HISTORY_KEY = "ai_agent_chat_history_general"; // Chave para histórico geral

// URL da função Edge do Supabase
const GEMINI_CHAT_FUNCTION_URL = "https://nesiwmsujsulwncbmcnc.supabase.co/functions/v1/gemini-chat";

const AIAgentAssistant: React.FC<AIAgentAssistantProps> = ({
  aiPrompt,
  currentTask, // Tarefa selecionada no dropdown
  allTasks, // Recebido como prop
  updateTask,
  closeTask,
  onTaskSuggested, // Nova prop
}) => {
  const { isLoading: isLoadingTodoist } = useTodoist();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [lastGeneratedReport, setLastGeneratedReport] = useState<string | null>(null);
  const [suggestedTaskForGuidance, setSuggestedTaskForGuidance] = useState<TodoistTask | null>(null);
  const [dialogueState, setDialogueState] = useState<DialogueState>('initial');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Determine the task context: explicit selection first, then AI suggestion
  const taskContext = currentTask || suggestedTaskForGuidance;

  const getTaskHistoryKey = useCallback((taskId: string | null) => {
    return taskId ? `${AI_CHAT_HISTORY_KEY_PREFIX}${taskId}` : AI_GENERAL_CHAT_HISTORY_KEY;
  }, []);

  // Load messages based on taskContext or general history
  useEffect(() => {
    const historyKey = getTaskHistoryKey(taskContext?.id || null);
    const savedHistory = localStorage.getItem(historyKey);

    if (savedHistory) {
      setMessages(JSON.parse(savedHistory));
    } else {
      setMessages([]);
      if (taskContext) {
        addMessage("ai", `Olá! Sou o Tutor IA SEISO. Como posso te ajudar a focar e executar a tarefa "${taskContext.content}" hoje?`);
      } else {
        addMessage("ai", "Olá! Sou o Tutor IA SEISO. Estou pronto para te ajudar a organizar suas tarefas. Posso sugerir a próxima tarefa com o 'Radar de Produtividade', responder a perguntas gerais sobre GTD/produtividade, ou te ajudar com uma tarefa específica se você a seleciona.");
      }
    }

    setDialogueState(taskContext ? 'awaiting_task_action' : 'initial');
    setLastGeneratedReport(null);
  }, [taskContext, getTaskHistoryKey]);

  // Save messages whenever they change
  useEffect(() => {
    const historyKey = getTaskHistoryKey(taskContext?.id || null);
    if (messages.length > 0) {
      localStorage.setItem(historyKey, JSON.stringify(messages));
    }
  }, [messages, taskContext, getTaskHistoryKey]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = useCallback((sender: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender, text }]);
  }, []);

  const generateTodoistUpdateSuggestion = useCallback((progress: string, nextStep: string) => {
    return `\`\`\`
[PROGRESSO]: ${progress}
[PRÓXIMO PASSO]: _${nextStep}_
\`\`\``;
  }, []);

  const callGeminiChatFunction = useCallback(async (userMessage: string, debugAIOnly: boolean = false) => { // Alterado para debugAIOnly
    setIsThinking(true);
    try {
      const response = await fetch(GEMINI_CHAT_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer YOUR_SUPABASE_ANON_KEY` // Not needed for public Edge Functions
        },
        body: JSON.stringify({
          aiPrompt,
          userMessage,
          currentTask: taskContext, // Pass the task in context
          allTasks, // Pass all tasks for Radar functionality
          debugAIOnly, // Novo parâmetro
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro na função Edge: ${response.statusText}`);
      }

      const data = await response.json();

      if (debugAIOnly) { // Nova lógica de depuração
        console.log("DEBUG INFO from Edge Function:", data.debugInfo);
        addMessage("ai", `Informações de depuração da IA enviadas para o console do navegador. Verifique os logs 'DEBUG INFO'.`);
        toast.info("Informações de depuração da IA disponíveis no console do navegador.");
      } else {
        addMessage("ai", data.response);
        setDialogueState(taskContext ? 'awaiting_task_action' : 'general_conversation'); // Adjust state based on context
      }
    } catch (error: any) {
      console.error("Erro ao chamar a função Gemini Chat:", error);
      toast.error(`Erro no Tutor IA: ${error.message || "Não foi possível obter uma resposta."}`);
      addMessage("ai", "Desculpe, tive um problema ao me comunicar com o Tutor IA. Por favor, tente novamente mais tarde.");
    } finally {
      setIsThinking(false);
    }
  }, [aiPrompt, taskContext, allTasks, addMessage]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "" || isThinking) return;

    addMessage("user", inputMessage);
    const userMsg = inputMessage;
    setInputMessage("");

    // Check for specific commands that don't need AI processing
    const lowerCaseMessage = userMsg.toLowerCase();

    if (lowerCaseMessage.includes("concluir") || lowerCaseMessage.includes("terminei") || lowerCaseMessage.includes("finalizei") || lowerCaseMessage.includes("acabei") || lowerCaseMessage.includes("feito")) {
      if (taskContext) {
        await closeTask(taskContext.id);
        addMessage("ai", `Excelente! Tarefa "${taskContext.content}" concluída. Parabéns!`);
        setSuggestedTaskForGuidance(null); // Clear suggested task after completion
        setDialogueState('initial'); // Go back to initial state
      } else {
        addMessage("ai", "Não há uma tarefa em foco para concluir.");
        setDialogueState('awaiting_task_action');
      }
      return;
    }
    
    if (lowerCaseMessage.includes("depurar ia")) { // Novo comando para depuração
      await callGeminiChatFunction(userMsg, true);
      return;
    }

    // Otherwise, send to Gemini
    await callGeminiChatFunction(userMsg);
  };

  const handleGenerateStatusReport = useCallback(() => {
    const taskToReport = taskContext;
    if (!taskToReport) {
      toast.error("Selecione uma tarefa ou peça uma sugestão para gerar o relatório de status.");
      return;
    }
    const statusText = `Nesta sessão de foco, você trabalhou na tarefa: ${taskToReport.content}.`;
    const nextStepText = `Definir a próxima micro-ação para avançar com a tarefa.`;
    const report = generateTodoistUpdateSuggestion(statusText, nextStepText);
    setLastGeneratedReport(report);
    toast.success("Relatório de status gerado!");
  }, [taskContext, generateTodoistUpdateSuggestion]);

  const handleGenerateNextStepReport = useCallback(() => {
    const taskToReport = taskContext;
    if (!taskToReport) {
      toast.error("Selecione uma tarefa ou peça uma sugestão para gerar o relatório de próximo passo.");
      return;
    }
    const nextStepText = `${taskToReport.content} (Definir a próxima micro-ação).`;
    const report = generateTodoistUpdateSuggestion("(Preencha aqui o que foi feito na última sessão)", nextStepText);
    setLastGeneratedReport(report);
    toast.success("Relatório de próximo passo gerado!");
  }, [taskContext, generateTodoistUpdateSuggestion]);

  const handleCopyReport = useCallback(() => {
    if (lastGeneratedReport) {
      const textToCopy = lastGeneratedReport.replace(/```\n/g, '').replace(/\n```/g, '');
      navigator.clipboard.writeText(textToCopy);
      toast.success("Relatório copiado para a área de transferência!");
    }
  }, [lastGeneratedReport]);

  const handleResetChat = useCallback(() => {
    if (confirm("Tem certeza que deseja reiniciar o chat? Isso apagará todo o histórico de conversa.")) {
      setMessages([]);
      setSuggestedTaskForGuidance(null);
      setDialogueState('initial');
      setLastGeneratedReport(null);
      localStorage.removeItem(AI_GENERAL_CHAT_HISTORY_KEY);
      if (taskContext) {
        localStorage.removeItem(getTaskHistoryKey(taskContext.id));
      }
      addMessage("ai", "Olá! Sou o Tutor IA SEISO. Estou pronto para te ajudar a organizar suas tarefas. Posso sugerir a próxima tarefa com o 'Radar de Produtividade', responder a perguntas gerais sobre GTD/produtividade, ou te ajudar com uma tarefa específica se você a seleciona.");
      toast.success("Chat reiniciado!");
    }
  }, [taskContext, getTaskHistoryKey, addMessage]);

  return (
    <Card className="h-[calc(100vh-100px)] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-indigo-600" /> Tutor IA SEISO
          <Button variant="ghost" size="icon" onClick={handleResetChat} className="ml-auto">
            <RotateCcw className="h-4 w-4 text-gray-500" />
          </Button>
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