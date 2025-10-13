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
import { format } from "date-fns";
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
    // Removido: deadline?: string | null;
  }) => Promise<TodoistTask | undefined>;
  isLoading: boolean;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const FOLLOW_UP_AI_HISTORY_KEY_PREFIX = "follow_up_ai_chat_history_";

const FollowUpAIAssistant: React.FC<FollowUpAIAssistantProps> = ({
  currentTask,
  updateTask,
  isLoading,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [lastAiSuggestion, setLastAiSuggestion] = useState<string | null>(null);

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

  const addMessage = useCallback((sender: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender, text }]);
  }, []);

  const simulateAIResponse = useCallback(async (userMessage: string) => {
    let responseText = "Não entendi sua solicitação. Por favor, tente novamente ou peça uma sugestão de follow-up.";

    if (!currentTask) {
      responseText = "Por favor, selecione uma tarefa delegada para que eu possa te ajudar.";
      addMessage("ai", responseText);
      return;
    }

    const delegateName = getDelegateNameFromLabels(currentTask.labels) || "o responsável";
    const taskContent = currentTask.content;
    const taskDueDate = currentTask.due?.datetime 
      ? format(parseISO(currentTask.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })
      : currentTask.due?.date
      ? format(parseISO(currentTask.due.date), "dd/MM/yyyy", { locale: ptBR })
      : "sem prazo definido";

    if (userMessage.toLowerCase().includes("sugestão de follow-up") || userMessage.toLowerCase().includes("gerar mensagem")) {
      responseText = `Claro! Aqui está uma sugestão de mensagem de follow-up para ${delegateName} sobre a tarefa "${taskContent}" (vencimento: ${taskDueDate}):\n\n` +
                     `"Olá ${delegateName},\n\n` +
                     `Gostaria de fazer um rápido follow-up sobre a tarefa "${taskContent}", que tem vencimento para ${taskDueDate}. Você conseguiu avançar com ela? Há algo em que eu possa ajudar para garantir que seja concluída no prazo?\n\n` +
                     `Agradeço o seu retorno!\n\n` +
                     `Atenciosamente,\n[Seu Nome]"`;
      setLastAiSuggestion(responseText);
    } else if (userMessage.toLowerCase().includes("próximo passo")) {
      responseText = `Para a tarefa "${taskContent}" delegada a ${delegateName}, o próximo passo é: **Verificar o status atual com ${delegateName} e oferecer suporte, se necessário.**`;
      setLastAiSuggestion(responseText);
    } else if (userMessage.toLowerCase().includes("urgente")) {
      responseText = `Entendido. Para uma abordagem mais urgente com ${delegateName} sobre "${taskContent}", você pode enviar:\n\n` +
                     `"Olá ${delegateName},\n\n` +
                     `Preciso de uma atualização urgente sobre a tarefa "${taskContent}", com vencimento para ${taskDueDate}. É crucial que tenhamos um status o mais breve possível. Por favor, me informe sobre o andamento.\n\n` +
                     `Obrigado,\n[Seu Nome]"`;
      setLastAiSuggestion(responseText);
    } else {
      responseText = `Para a tarefa "${taskContent}" delegada a ${delegateName}, como posso te ajudar a fazer o follow-up? Posso sugerir uma mensagem, um próximo passo, ou algo mais?`;
    }
    addMessage("ai", responseText);
  }, [addMessage, currentTask]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "") return;

    addMessage("user", inputMessage);
    const userMsg = inputMessage;
    setInputMessage("");

    // Simulate AI thinking time
    setTimeout(() => {
      simulateAIResponse(userMsg);
    }, 1000);
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
              disabled={isLoading || !currentTask}
              className="flex-grow"
            />
            <Button onClick={handleSendMessage} disabled={isLoading || !currentTask}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FollowUpAIAssistant;