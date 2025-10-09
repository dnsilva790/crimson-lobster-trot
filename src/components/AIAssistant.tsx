"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, FileText } from "lucide-react"; // Adicionado FileText para o novo botão
import { TodoistTask } from "@/lib/types";
import { useTodoist } from "@/context/TodoistContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  }) => Promise<TodoistTask | undefined>;
  closeTask: (taskId: string) => Promise<void>;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  aiPrompt,
  currentTask,
  focusTasks,
  updateTask,
  closeTask,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { isLoading } = useTodoist();

  const getTaskHistoryKey = (taskId: string) => `ai_chat_history_${taskId}`;

  // Load messages for the current task
  useEffect(() => {
    if (currentTask) {
      const savedHistory = localStorage.getItem(getTaskHistoryKey(currentTask.id));
      if (savedHistory) {
        setMessages(JSON.parse(savedHistory));
      } else {
        setMessages([]);
        // Add initial welcome message only if no history exists for the task
        addMessage("ai", "Olá! Sou o Tutor IA SEISO. Estou aqui para te ajudar a otimizar sua execução e produtividade. Qual tarefa você gostaria de focar hoje?");
      }
    } else {
      setMessages([]); // Clear messages if no task is in focus
      addMessage("ai", "Olá! Sou o Tutor IA SEISO. Por favor, inicie o Modo Foco para que eu possa te ajudar com uma tarefa específica.");
    }
  }, [currentTask]); // Depend on currentTask to load history

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
    let responseText = "Olá! Como posso te ajudar a focar e ser mais produtivo hoje?";

    // MODO RELATÓRIO
    if (userMessage.toLowerCase().includes("gerar status") || userMessage.toLowerCase().includes("próximo passo para todoist")) {
      if (currentTask) {
        const status = `[STATUS]: Na última sessão, focamos em analisar a tarefa e identificar os próximos passos.`;
        const nextStep = `[PRÓXIMO PASSO - AÇÃO IMEDIATA]: _**Definir o primeiro micro-passo concreto para iniciar a execução.**_`;
        responseText = `${status}\n\n${nextStep}`;
      } else {
        responseText = "Não há uma tarefa em foco para gerar um relatório. Por favor, selecione uma tarefa.";
      }
      addMessage("ai", responseText);
      return;
    }

    // MODO DIÁLOGO (PADRÃO)
    if (currentTask) {
      const taskName = currentTask.content;
      const taskLink = currentTask.url;

      if (userMessage.toLowerCase().includes("próximo passo") || userMessage.toLowerCase().includes("começar")) {
        responseText = `Excelente! Para a tarefa "${taskName}", o próximo micro-passo é: **Analisar a descrição da tarefa e identificar o objetivo principal.**`;
        addMessage("ai", responseText);
        addMessage("ai", `
          Sugestão para Atualização da Descrição do Todoist (copiar/colar):
          \`\`\`
          [PROGRESSO]: Iniciando foco na tarefa.
          [PRÓXIMO PASSO]: _Analisar a descrição da tarefa e identificar o objetivo principal._
          \`\`\`
        `);
      } else if (userMessage.toLowerCase().includes("feito") || userMessage.toLowerCase().includes("concluído")) {
        responseText = `Ótimo trabalho! Você concluiu um micro-passo. Qual foi o resultado da sua análise?`;
        addMessage("ai", responseText);
        addMessage("ai", `
          Sugestão para Atualização da Descrição do Todoist (copiar/colar):
          \`\`\`
          [PROGRESSO]: Descrição analisada. Objetivo principal identificado.
          [PRÓXIMO PASSO]: _Definir a primeira ação concreta para atingir o objetivo._
          \`\`\`
        `);
      } else if (userMessage.toLowerCase().includes("delegar")) {
        // Simulação de lógica de delegação
        const delegationOptions = [
          { name: "Ingrid", criteria: "Negociações >R$500k, stakeholders de alto escalão, análises complexas" },
          { name: "João", criteria: "Médio/grande porte, follow-ups críticos, requer seriedade" },
          { name: "Samara", criteria: "Médio porte, análises equilibradas, está em desenvolvimento" },
          { name: "Francisco", criteria: "Tarefas relacionais, follow-ups diversos, suporte geral" },
          { name: "David", criteria: "Questões jurídicas, contratos, assinaturas, interlocução jurídico" },
          { name: "Cazé/Ana Julia", criteria: "Requisições administrativas, tarefas supervisionadas" },
        ];
        const suitableDelegates = delegationOptions.filter(d => currentTask.description.toLowerCase().includes(d.name.toLowerCase()) || currentTask.content.toLowerCase().includes(d.name.toLowerCase()));

        if (suitableDelegates.length > 0) {
          responseText = `A tarefa "${taskName}" parece ser adequada para delegação. Com base na descrição, ${suitableDelegates.map(d => d.name).join(", ")} poderiam ser boas opções. Qual você prefere?`;
        } else {
          responseText = `A tarefa "${taskName}" não parece se encaixar nos critérios de delegação para a equipe atual. Vamos focar em como você pode executá-la com o mínimo de esforço.`;
        }
        addMessage("ai", responseText);
      } else if (userMessage.toLowerCase().includes("prioridade")) {
        responseText = `A prioridade atual da tarefa "${taskName}" é P${currentTask.priority}. Lembre-se: P1: Impacto nas próximas 4h, P2: 24h, P3: 7 dias, P4: Inbox (até 2 min).`;
        addMessage("ai", responseText);
      } else {
        responseText = `Entendido. Para a tarefa "${taskName}", qual é a sua principal dúvida ou o que está te bloqueando agora? Lembre-se do seu pico de produtividade (06h-10h) e dos stakeholders críticos.`;
        addMessage("ai", responseText);
      }
    } else {
      responseText = "Não há uma tarefa em foco. Por favor, inicie o Modo Foco para que eu possa te ajudar com uma tarefa específica.";
      addMessage("ai", responseText);
    }
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

  const handleGenerateSummaryAndUpdate = useCallback(async () => {
    if (!currentTask) {
      toast.error("Nenhuma tarefa em foco para gerar resumo.");
      return;
    }

    const now = new Date();
    const timestamp = format(now, "dd/MM/yyyy HH:mm", { locale: ptBR });

    // Simple summary for now. In a real AI, this would be more sophisticated.
    const conversationSummary = messages
      .filter(msg => msg.sender === "ai")
      .slice(-3) // Take last 3 AI messages as a simple summary
      .map(msg => msg.text.replace(/(\*\*|__)/g, '').replace(/```[\s\S]*?```/g, '').trim()) // Remove markdown bold/italic and code blocks
      .join("\n- ");

    const summaryText = `\n\n--- Resumo da Sessão (${timestamp}) ---\n` +
                       `[PROGRESSO]: ${conversationSummary || "Nenhum progresso significativo registrado na conversa."}\n` +
                       `[PRÓXIMO PASSO]: _(Defina aqui o próximo passo manual ou peça ao Tutor IA para sugerir)_`;

    const newDescription = (currentTask.description || "") + summaryText;

    const updated = await updateTask(currentTask.id, { description: newDescription });

    if (updated) {
      toast.success("Resumo adicionado à descrição da tarefa no Todoist!");
      // Optionally clear chat history for this task after summarizing
      // localStorage.removeItem(getTaskHistoryKey(currentTask.id));
      // setMessages([]);
    } else {
      toast.error("Falha ao atualizar a descrição da tarefa.");
    }
  }, [currentTask, messages, updateTask]);


  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-indigo-600" /> Tutor IA SEISO
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col p-0">
        <ScrollArea className="flex-grow p-4" viewportRef={scrollAreaRef}>
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
                    "max-w-[70%] p-3 rounded-lg shadow-sm",
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
          </div>
        </ScrollArea>
        <div className="p-4 border-t flex flex-col gap-2">
          <Button
            onClick={handleGenerateSummaryAndUpdate}
            disabled={isLoading || !currentTask}
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center"
          >
            <FileText className="mr-2 h-4 w-4" /> Gerar Resumo e Atualizar Todoist
          </Button>
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
              disabled={isLoading}
              className="flex-grow"
            />
            <Button onClick={handleSendMessage} disabled={isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIAssistant;