"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Copy } from "lucide-react";
import { TodoistTask } from "@/lib/types";
import { toast } from "sonner";
import { cn, getDelegateNameFromLabels } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FollowUpAIAssistantProps {
  currentTask: TodoistTask | null;
  updateTask: (taskId: string, data: {
    content?: string;
    description?: string;
    priority?: 1 | 2 | 3 | 4;
    due_date?: string | null;
    due_datetime?: string | null;
    labels?: string[];
    duration?: number;
    duration_unit?: "minute" | "day";
    deadline?: string | null; // Adicionado
  }) => Promise<TodoistTask | undefined>;
  isLoading: boolean;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const FOLLOW_UP_AI_HISTORY_KEY_PREFIX = "follow_up_ai_chat_history_";
// URL da função Edge do Supabase (ATUALIZADA)
const GEMINI_CHAT_FUNCTION_URL = "https://nesiwmsujsulwncbmcnc.supabase.co/functions/v1/ai-chat";

const FollowUpAIAssistant: React.FC<FollowUpAIAssistantProps> = ({
  currentTask,
  updateTask,
  isLoading,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [lastAiSuggestion, setLastAiSuggestion] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);

  const getTaskHistoryKey = (taskId: string) => `${FOLLOW_UP_AI_HISTORY_KEY_PREFIX}${taskId}`;

  // Load messages for the current task
  useEffect(() => {
    if (currentTask) {
      const savedHistory = localStorage.getItem(getTaskHistoryKey(currentTask.id));
      if (savedHistory) {
        setMessages(JSON.parse(savedHistory));
      } else {
        setMessages([]);
        addMessage("ai", `Olá! Sou o Tutor IA SEISO. Selecionei a tarefa "${currentTask.content}" para te ajudar com o follow-up. Como posso te auxiliar?`);
      }
    } else {
      setMessages([]); // Clear messages if no task is in focus
      addMessage("ai", "Olá! Sou o Tutor IA SEISO. Por favor, selecione uma tarefa delegada na lista para que eu possa te ajudar com o follow-up.");
    }
    setLastAiSuggestion(null); // Clear last suggestion when task changes
  }, [currentTask]);

  // Save messages whenever they change
  useEffect(() => {
    if (currentTask && messages.length > 0) {
      localStorage.setItem(getTaskHistoryKey(currentTask.id), JSON.stringify(messages));
    }
  }, [messages, currentTask]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = useCallback((sender: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender, text }]);
  }, []);

  const callGeminiChatFunction = useCallback(async (userMessage: string) => {
    setIsThinking(true);
    try {
      const response = await fetch(GEMINI_CHAT_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aiPrompt: "Você é um assistente de follow-up focado em comunicação assertiva e lembretes de prazos. Sua missão é ajudar o usuário a redigir mensagens de acompanhamento para tarefas delegadas.",
          userMessage,
          currentTask: currentTask,
          allTasks: [], // Não precisa de todas as tarefas para follow-up
          chatHistory: messages.map(msg => ({ sender: msg.sender, text: msg.text })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro na função Edge: ${response.statusText}`);
      }

      const data = await response.json();
      let responseText = data.response;

      // Heurística para extrair sugestão de follow-up se a IA a gerar
      if (responseText.toLowerCase().includes("sugestão de mensagem") || responseText.toLowerCase().includes("aqui está uma sugestão")) {
        setLastAiSuggestion(responseText);
      } else {
        setLastAiSuggestion(null);
      }

      addMessage("ai", responseText);
    } catch (error: any) {
      console.error("Erro ao chamar a função Gemini Chat:", error);
      toast.error(`Erro no Tutor IA: ${error.message || "Não foi possível obter uma resposta."}`);
      addMessage("ai", "Desculpe, tive um problema ao me comunicar com o Tutor IA. Por favor, tente novamente mais tarde.");
    } finally {
      setIsThinking(false);
    }
  }, [addMessage, currentTask, messages]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "" || isThinking || !currentTask) return;

    addMessage("user", inputMessage);
    const userMsg = inputMessage;
    setInputMessage("");

    await callGeminiChatFunction(userMsg);
  };

  const handleCopySuggestion = useCallback(() => {
    if (lastAiSuggestion) {
      navigator.clipboard.writeText(lastAiSuggestion);
      toast.success("Sugestão copiada para a área de transferência!");
    } else {
      toast.error("Nenhuma sugestão de IA para copiar.");
    }
  }, [lastAiSuggestion]);

  return (
    <Card className="h-[calc(100vh-100px)] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-indigo-600" /> Tutor IA SEISO (Follow-Up)
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
                  {msg.sender === "ai" && msg.text === lastAiSuggestion && lastAiSuggestion && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleCopySuggestion} 
                      className="mt-2 text-xs text-indigo-600 hover:bg-indigo-100"
                    >
                      <Copy className="mr-1 h-3 w-3" /> Copiar Sugestão
                    </Button>
                  )}
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
              disabled={isLoading || !currentTask || isThinking}
              className="flex-grow"
            />
            <Button onClick={handleSendMessage} disabled={isLoading || !currentTask || isThinking}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FollowUpAIAssistant;