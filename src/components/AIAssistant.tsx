"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea"; // Importar Textarea
import { Send, Bot, User, ClipboardCopy } from "lucide-react"; // Adicionar ClipboardCopy
import { TodoistTask } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AIAssistantProps {
  aiPrompt: string;
  currentTask: TodoistTask | null;
  focusTasks: TodoistTask[];
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
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const AI_CHAT_HISTORY_KEY = "ai_chat_history_novoseiso";

const AIAssistant: React.FC<AIAssistantProps> = ({
  aiPrompt,
  currentTask,
  focusTasks,
  updateTask,
  closeTask,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [lastGeneratedReport, setLastGeneratedReport] = useState<string | null>(null); // Novo estado para o relatório
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem(AI_CHAT_HISTORY_KEY);
    if (savedHistory) {
      setMessages(JSON.parse(savedHistory));
    } else {
      addMessage("ai", "Olá! Sou o Tutor IA SEISO. Como posso te ajudar a focar e executar suas tarefas hoje?");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(AI_CHAT_HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Limpar relatório gerado quando a tarefa muda ou uma nova mensagem é enviada
  useEffect(() => {
    setLastGeneratedReport(null);
  }, [currentTask, messages]); // messages para limpar ao enviar nova mensagem de chat

  const addMessage = useCallback((sender: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender, text }]);
  }, []);

  const simulateAIResponse = useCallback(async (userMessage: string) => {
    setIsThinking(true);
    let responseText = "Não entendi sua solicitação. Por favor, tente novamente.";

    if (!currentTask) {
      responseText = "Por favor, selecione uma tarefa para que eu possa te ajudar com o foco.";
      addMessage("ai", responseText);
      setIsThinking(false);
      return;
    }

    const taskContent = currentTask.content;
    const taskDescription = currentTask.description;
    const taskPriority = currentTask.priority;
    const remainingTasksCount = focusTasks.length;

    // Simple keyword-based responses for demonstration
    if (userMessage.toLowerCase().includes("próximo passo") || userMessage.toLowerCase().includes("o que fazer")) {
      responseText = `Para a tarefa "${taskContent}", o próximo passo é: **Analisar a descrição e identificar a primeira micro-ação.**`;
      if (taskDescription) {
        responseText += `\n\nDescrição: "${taskDescription}"`;
      }
    } else if (userMessage.toLowerCase().includes("delegar")) {
      responseText = `Para delegar "${taskContent}", preciso saber: **Para quem você gostaria de delegar esta tarefa?**`;
    } else if (userMessage.toLowerCase().includes("status")) {
      responseText = `O status atual da tarefa "${taskContent}" é P${taskPriority}. Você tem ${remainingTasksCount} tarefas restantes no seu foco.`;
    } else if (userMessage.toLowerCase().includes("ajuda") || userMessage.toLowerCase().includes("coach")) {
      responseText = `Estou aqui para te ajudar a quebrar a tarefa "${taskContent}" em micro-ações. Qual é a sua maior dificuldade com ela?`;
    } else if (userMessage.toLowerCase().includes("concluir")) {
      await closeTask(currentTask.id);
      responseText = `Excelente! Tarefa "${taskContent}" concluída. Parabéns!`;
    } else {
      responseText = `Com a tarefa "${taskContent}" em foco, como posso te auxiliar? Posso te ajudar a definir o próximo passo, delegar, ou analisar o status?`;
    }

    setTimeout(() => {
      addMessage("ai", responseText);
      setIsThinking(false);
    }, 1500); // Simulate AI thinking time
  }, [addMessage, currentTask, focusTasks, closeTask]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "" || isThinking) return;

    addMessage("user", inputMessage);
    const userMsg = inputMessage;
    setInputMessage("");

    simulateAIResponse(userMsg);
  };

  const handleGenerateStatusReport = useCallback(() => {
    if (!currentTask) {
      toast.error("Selecione uma tarefa para gerar o relatório de status.");
      return;
    }
    // Simplificado, pois o AI Assistant não tem memória de 'últimos passos concluídos'
    const statusText = `[STATUS]: Nesta sessão de foco, você trabalhou na tarefa: ${currentTask.content}.`;
    const nextStepText = `[PRÓXIMO PASSO - AÇÃO IMEDIATA]: _Definir a próxima micro-ação para avançar com a tarefa._`;
    const report = `${statusText}\n${nextStepText}`;
    setLastGeneratedReport(report);
    toast.success("Relatório de status gerado!");
  }, [currentTask]);

  const handleGenerateNextStepReport = useCallback(() => {
    if (!currentTask) {
      toast.error("Selecione uma tarefa para gerar o relatório de próximo passo.");
      return;
    }
    const nextStepText = `[PRÓXIMO PASSO - AÇÃO IMEDIATA]: _${currentTask.content} (Definir a próxima micro-ação)._`;
    const report = `[STATUS]: (Preencha aqui o que foi feito na última sessão)\n${nextStepText}`;
    setLastGeneratedReport(report);
    toast.success("Relatório de próximo passo gerado!");
  }, [currentTask]);

  const handleCopyReport = useCallback(() => {
    if (lastGeneratedReport) {
      navigator.clipboard.writeText(lastGeneratedReport);
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
            <Button onClick={handleGenerateStatusReport} disabled={!currentTask} className="flex items-center gap-1">
              <ClipboardCopy className="h-4 w-4" /> Gerar Status
            </Button>
            <Button onClick={handleGenerateNextStepReport} disabled={!currentTask} className="flex items-center gap-1">
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
              disabled={isThinking || !currentTask}
              className="flex-grow"
            />
            <Button onClick={handleSendMessage} disabled={isThinking || !currentTask}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIAssistant;