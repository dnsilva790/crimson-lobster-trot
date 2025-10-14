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
import { format, parseISO, isValid } from "date-fns";
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
  const [lastGeneratedReport, setLastGeneratedReport] = useState<string | null>(null);
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
  }, [currentTask, messages]);

  const addMessage = useCallback((sender: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender, text }]);
  }, []);

  const parseDelegateInfo = useCallback(() => {
    const delegateSectionMatch = aiPrompt.match(/EQUIPE \(PARA DELEGAÇÃO\)\n([\s\S]*?)(?=\n\n[A-Z]|$)/);
    if (!delegateSectionMatch) return [];

    const delegateLines = delegateSectionMatch[1].split('\n').filter(line => line.trim().startsWith('*'));
    return delegateLines.map(line => {
      const match = line.match(/\* \*\*([A-Za-z\s]+):\*\*(.*)/);
      if (match) {
        return { name: match[1].trim(), responsibilities: match[2].trim() };
      }
      return null;
    }).filter(Boolean);
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
    const delegates = parseDelegateInfo();

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
      const dueDate = currentTask.due?.datetime 
        ? format(parseISO(currentTask.due.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })
        : currentTask.due?.date
        ? format(parseISO(currentTask.due.date), "dd/MM/yyyy", { locale: ptBR })
        : "sem prazo definido";
      
      const deadline = currentTask.deadline 
        ? format(parseISO(currentTask.deadline), "dd/MM/yyyy", { locale: ptBR })
        : "não definido";

      responseText = `O status atual da tarefa "${taskContent}" é P${taskPriority}. Vencimento: ${dueDate}. Deadline: ${deadline}. Você tem ${remainingTasksCount} tarefas restantes no seu foco.`;
      responseText += `\n\nSe precisar de um relatório formatado para o Todoist, use os botões "Gerar Status" ou "Gerar Próximo Passo" abaixo.`;
    } else if (lowerCaseMessage.includes("ajuda") || lowerCaseMessage.includes("coach")) {
      responseText = `Estou aqui para te ajudar a quebrar a tarefa "${taskContent}" em micro-ações e manter o foco. Qual é a sua maior dificuldade com ela agora? Ou podemos definir o próximo passo?`;
    } else if (lowerCaseMessage.includes("concluir")) {
      await closeTask(currentTask.id);
      responseText = `Excelente! Tarefa "${taskContent}" concluída. Parabéns!`;
    } else if (lowerCaseMessage.includes("gerar status") || lowerCaseMessage.includes("gerar próximo passo")) {
      responseText = `Para gerar um relatório formatado para o Todoist, por favor, use os botões dedicados "Gerar Status" ou "Gerar Próximo Passo" abaixo do campo de texto.`;
    } else {
      responseText = `Com a tarefa "${taskContent}" em foco, como posso te auxiliar? Posso te ajudar a definir o próximo passo, delegar, ou analisar o status?`;
    }

    setTimeout(() => {
      addMessage("ai", responseText);
      setIsThinking(false);
    }, 1500); // Simulate AI thinking time
  }, [addMessage, currentTask, focusTasks, closeTask, aiPrompt, parseDelegateInfo, generateTodoistUpdateSuggestion]);

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
    const statusText = `Nesta sessão de foco, você trabalhou na tarefa: ${currentTask.content}.`;
    const nextStepText = `Definir a próxima micro-ação para avançar com a tarefa.`;
    const report = generateTodoistUpdateSuggestion(statusText, nextStepText);
    setLastGeneratedReport(report);
    toast.success("Relatório de status gerado!");
  }, [currentTask, generateTodoistUpdateSuggestion]);

  const handleGenerateNextStepReport = useCallback(() => {
    if (!currentTask) {
      toast.error("Selecione uma tarefa para gerar o relatório de próximo passo.");
      return;
    }
    const nextStepText = `${currentTask.content} (Definir a próxima micro-ação).`;
    const report = generateTodoistUpdateSuggestion("(Preencha aqui o que foi feito na última sessão)", nextStepText);
    setLastGeneratedReport(report);
    toast.success("Relatório de próximo passo gerado!");
  }, [currentTask, generateTodoistUpdateSuggestion]);

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