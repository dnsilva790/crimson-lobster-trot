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
import {
  FOCO_LABEL_ID,
  RAPIDA_LABEL_ID,
  CRONOGRAMA_HOJE_LABEL,
} from "@/lib/constants"; // Importar as constantes das etiquetas do local correto

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

// URL da função Edge do Supabase (ATUALIZADA)
const GEMINI_CHAT_FUNCTION_URL = "https://nesiwmsujsulwncbmcnc.supabase.co/functions/v1/ai-chat";

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
  const [suggestedTaskForGuidance, setSuggestedTaskForGuidance] = useState<TodoistTask | null>(null);
  const [dialogueState, setDialogueState] = useState<DialogueState>('initial');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Determine the task context: explicit selection first, then AI suggestion
  const taskContext = currentTask || suggestedTaskForGuidance;

  const getTaskHistoryKey = useCallback((taskId: string | null) => {
    return taskId ? `${AI_CHAT_HISTORY_KEY_PREFIX}${taskId}` : AI_GENERAL_CHAT_HISTORY_KEY;
  }, []);

  const addMessage = useCallback((sender: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender, text }]);
  }, []);

  const initialGreeting = "Olá! Sou o Tutor IA SEISO. Estou pronto para te ajudar a lidar com suas tarefas de forma assertiva e focada. Como posso te ajudar hoje?";

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
        addMessage("ai", initialGreeting);
      }
    }

    setDialogueState(taskContext ? 'awaiting_task_action' : 'initial');
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

  const callGeminiChatFunction = useCallback(async (userMessage: string) => {
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
          allTasks: allTasks, // Pass all tasks for Radar functionality
          chatHistory: messages.map(msg => ({ sender: msg.sender, text: msg.text })), // Pass the chat history
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro na função Edge: ${response.statusText}`);
      }

      const data = await response.json();

      addMessage("ai", data.response);
      setDialogueState(taskContext ? 'awaiting_task_action' : 'general_conversation'); // Adjust state based on context
    } catch (error: any) {
      console.error("Erro ao chamar a função Gemini Chat:", error);
      toast.error(`Erro no Tutor IA: ${error.message || "Não foi possível obter uma resposta."}`);
      addMessage("ai", "Desculpe, tive um problema ao me comunicar com o Tutor IA. Por favor, tente novamente mais tarde.");
    } finally {
      setIsThinking(false);
    }
  }, [aiPrompt, taskContext, allTasks, addMessage, messages]); // Add messages to dependencies

  // Helper functions for label management
  const addLabelToTask = useCallback(async (taskId: string, label: string, currentLabels: string[]) => {
    const newLabels = [...new Set([...currentLabels, label])];
    const updated = await updateTask(taskId, { labels: newLabels });
    if (updated) {
      toast.success(`Etiqueta "${label}" adicionada à tarefa "${updated.content}".`);
    } else {
      toast.error(`Falha ao adicionar etiqueta "${label}".`);
    }
    return updated;
  }, [updateTask]);

  const removeLabelFromTask = useCallback(async (taskId: string, label: string, currentLabels: string[]) => {
    const newLabels = currentLabels.filter(l => l !== label);
    const updated = await updateTask(taskId, { labels: newLabels });
    if (updated) {
      toast.success(`Etiqueta "${label}" removida da tarefa "${updated.content}".`);
    } else {
      toast.error(`Falha ao remover etiqueta "${label}".`);
    }
    return updated;
  }, [updateTask]);


  const handleSendMessage = async () => {
    if (inputMessage.trim() === "" || isThinking) return;

    addMessage("user", inputMessage);
    const userMsg = inputMessage;
    setInputMessage("");

    setIsThinking(true); // Start thinking state for all commands initially

    // Check for specific commands that don't need AI processing
    const lowerCaseMessage = userMsg.toLowerCase();
    let handled = false;

    if (taskContext) {
      const currentLabels = taskContext.labels || [];

      // Handle "Concluir" command
      if (lowerCaseMessage.includes("concluir") || lowerCaseMessage.includes("terminei") || lowerCaseMessage.includes("finalizei") || lowerCaseMessage.includes("acabei") || lowerCaseMessage.includes("feito")) {
        await closeTask(taskContext.id);
        addMessage("ai", `Excelente! Tarefa "${taskContext.content}" concluída. Parabéns!`);
        setSuggestedTaskForGuidance(null); // Clear suggested task after completion
        setDialogueState('initial'); // Go back to initial state
        handled = true;
      }
      // Handle "Foco" label
      else if (lowerCaseMessage.includes("adicionar foco") || lowerCaseMessage.includes("colocar foco") || lowerCaseMessage.includes("marcar como foco")) {
        await addLabelToTask(taskContext.id, FOCO_LABEL_ID, currentLabels);
        addMessage("ai", `Etiqueta "${FOCO_LABEL_ID}" adicionada à tarefa "${taskContext.content}".`);
        handled = true;
      } else if (lowerCaseMessage.includes("remover foco") || lowerCaseMessage.includes("tirar foco") || lowerCaseMessage.includes("desmarcar foco")) {
        await removeLabelFromTask(taskContext.id, FOCO_LABEL_ID, currentLabels);
        addMessage("ai", `Etiqueta "${FOCO_LABEL_ID}" removida da tarefa "${taskContext.content}".`);
        handled = true;
      }
      // Handle "Rápida" label
      else if (lowerCaseMessage.includes("adicionar rapida") || lowerCaseMessage.includes("colocar rapida") || lowerCaseMessage.includes("marcar como rapida")) {
        await addLabelToTask(taskContext.id, RAPIDA_LABEL_ID, currentLabels);
        addMessage("ai", `Etiqueta "${RAPIDA_LABEL_ID}" adicionada à tarefa "${taskContext.content}".`);
        handled = true;
      } else if (lowerCaseMessage.includes("remover rapida") || lowerCaseMessage.includes("tirar rapida") || lowerCaseMessage.includes("desmarcar rapida")) {
        await removeLabelFromTask(taskContext.id, RAPIDA_LABEL_ID, currentLabels);
        addMessage("ai", `Etiqueta "${RAPIDA_LABEL_ID}" removida da tarefa "${taskContext.content}".`);
        handled = true;
      }
      // Handle "Cronograma de hoje" label
      else if (lowerCaseMessage.includes("adicionar cronograma") || lowerCaseMessage.includes("colocar cronograma") || lowerCaseMessage.includes("marcar cronograma")) {
        await addLabelToTask(taskContext.id, CRONOGRAMA_HOJE_LABEL, currentLabels);
        addMessage("ai", `Etiqueta "${CRONOGRAMA_HOJE_LABEL}" adicionada à tarefa "${taskContext.content}".`);
        handled = true;
      } else if (lowerCaseMessage.includes("remover cronograma") || lowerCaseMessage.includes("tirar cronograma") || lowerCaseMessage.includes("desmarcar cronograma")) {
        await removeLabelFromTask(taskContext.id, CRONOGRAMA_HOJE_LABEL, currentLabels);
        addMessage("ai", `Etiqueta "${CRONOGRAMA_HOJE_LABEL}" removida da tarefa "${taskContext.content}".`);
        handled = true;
      }
    }

    if (handled) {
      setIsThinking(false);
      return;
    }
    
    // Otherwise, send to Gemini
    await callGeminiChatFunction(userMsg);
  };

  const handleResetChat = useCallback(() => {
    if (confirm("Tem certeza que deseja reiniciar o chat? Isso apagará todo o histórico de conversa.")) {
      setMessages([]);
      setSuggestedTaskForGuidance(null);
      setDialogueState('initial');
      // Limpa o histórico geral e o histórico da tarefa atual (se houver)
      localStorage.removeItem(AI_GENERAL_CHAT_HISTORY_KEY);
      if (taskContext) {
        localStorage.removeItem(getTaskHistoryKey(taskContext.id));
      }
      addMessage("ai", initialGreeting); // Usa a nova saudação inicial
      toast.success("Chat reiniciado!");
    }
  }, [taskContext, getTaskHistoryKey, addMessage]);

  return (
    <Card className="h-[calc(100vh-100px)] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-indigo-600" /> Tutor IA SEISO
          <Button variant="ghost" size="icon" onClick={handleResetChat} className="ml-auto">
            <RotateCcw className="h-4 w-4" />
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
          {/* Removido: lastGeneratedReport e botões de relatório */}
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