"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, RotateCcw, BarChart3, ListTodo } from "lucide-react";
import { TodoistTask } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTodoist } from "@/context/TodoistContext";
import { Label } from "@/components/ui/label";
import { getLearningContextForPrompt } from "@/utils/aiLearningStorage"; // Importar o contexto de aprendizado

interface AIAgentManagerProps {
  aiPrompt: string;
  allTasks: TodoistTask[]; // Todas as tarefas para análise global
  updateTask: (taskId: string, data: any) => Promise<TodoistTask | undefined>;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const AI_MANAGER_CHAT_HISTORY_KEY = "ai_agent_manager_chat_history";
// Usando a URL hardcoded da função Edge (ATUALIZADA)
const GEMINI_CHAT_FUNCTION_URL = "https://nesiwmsujsulwncbmcnc.supabase.co/functions/v1/ai-chat";

const AIAgentManager: React.FC<AIAgentManagerProps> = ({
  aiPrompt,
  allTasks,
  updateTask,
}) => {
  const { isLoading: isLoadingTodoist } = useTodoist();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const initialGreeting = "Olá! Sou o Agente de Gerenciamento Estratégico (AGE). Meu foco é te ajudar a analisar seu backlog, tomar decisões GTD e acompanhar o status global das tarefas. Como posso te ajudar a gerenciar sua carga de trabalho?";

  // Load messages
  useEffect(() => {
    const savedHistory = localStorage.getItem(AI_MANAGER_CHAT_HISTORY_KEY);
    if (savedHistory) {
      setMessages(JSON.parse(savedHistory));
    } else {
      setMessages([]);
      addMessage("ai", initialGreeting);
    }
  }, []);

  // Save messages
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(AI_MANAGER_CHAT_HISTORY_KEY, JSON.stringify(messages));
    }
  }, [messages]);

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
    
    // Adicionar o contexto de aprendizado ao prompt
    const learningContext = getLearningContextForPrompt();
    const fullAiPromptWithLearning = aiPrompt + learningContext;

    try {
      const response = await fetch(GEMINI_CHAT_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aiPrompt: fullAiPromptWithLearning, // Usar o prompt com o contexto de aprendizado
          userMessage,
          currentTask: null,
          allTasks: allTasks,
          chatHistory: messages.map(msg => ({ sender: msg.sender, text: msg.text })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro na função Edge: ${response.statusText}`);
      }

      const data = await response.json();
      addMessage("ai", data.response);
    } catch (error: any) {
      console.error("Erro ao chamar a função Gemini Chat:", error);
      toast.error(`Erro no Agente de Gerenciamento: ${error.message || "Não foi possível obter uma resposta."}`);
      addMessage("ai", "Desculpe, tive um problema ao me comunicar com o Agente de Gerenciamento. Por favor, tente novamente mais tarde.");
    } finally {
      setIsThinking(false);
    }
  }, [aiPrompt, allTasks, addMessage, messages]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "" || isThinking) return;

    addMessage("user", inputMessage);
    const userMsg = inputMessage;
    setInputMessage("");

    await callGeminiChatFunction(userMsg);
  };

  const handleResetChat = useCallback(() => {
    if (confirm("Tem certeza que deseja reiniciar o chat? Isso apagará todo o histórico de conversa.")) {
      setMessages([]);
      localStorage.removeItem(AI_MANAGER_CHAT_HISTORY_KEY);
      addMessage("ai", initialGreeting);
      toast.success("Chat reiniciado!");
    }
  }, [addMessage]);

  return (
    <Card className="h-[calc(100vh-100px)] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-green-600" /> Agente de Gerenciamento Estratégico (AGE)
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
                  {msg.sender === "ai" && <span className="font-semibold text-green-600 block mb-1">AGE:</span>}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg shadow-sm bg-gray-100 text-gray-800 border border-gray-200">
                  <span className="font-semibold text-green-600 block mb-1">AGE:</span>
                  <span className="animate-pulse">Analisando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Pergunte sobre seu backlog, projetos ou status..."
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

export default AIAgentManager;