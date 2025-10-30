"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Lightbulb } from "lucide-react";
import { EisenhowerTask } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: EisenhowerTask[];
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ isOpen, onClose, tasks }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addMessage("ai", "Olá! Sou o Assistente IA da Matriz de Eisenhower. Posso te ajudar a entender suas tarefas, sugerir como avaliá-las ou interpretar seus resultados. Como posso ajudar?");
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = useCallback((sender: "user" | "ai", text: string) => {
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender, text }]);
  }, []);

  const simulateAIResponse = useCallback(async (userMessage: string) => {
    setIsThinking(true);
    let responseText = "Não entendi sua solicitação. Por favor, tente novamente.";
    const lowerCaseMessage = userMessage.toLowerCase();

    if (lowerCaseMessage.includes("ajuda") || lowerCaseMessage.includes("o que fazer")) {
      responseText = "Posso te ajudar a: \n1. Entender a Matriz de Eisenhower. \n2. Sugerir como avaliar a urgência e importância das suas tarefas. \n3. Interpretar os resultados da sua matriz. \n4. Dar conselhos sobre como agir em cada quadrante.";
    } else if (lowerCaseMessage.includes("matriz de eisenhower")) {
      responseText = "A Matriz de Eisenhower é uma ferramenta de priorização que categoriza tarefas em quatro quadrantes: Fazer (Urgente/Importante), Decidir (Não Urgente/Importante), Delegar (Urgente/Não Importante) e Eliminar (Não Urgente/Não Importante).";
    } else if (lowerCaseMessage.includes("avaliar tarefas") || lowerCaseMessage.includes("urgencia e importancia")) {
      responseText = "Para avaliar a urgência e importância, considere: \n- **Urgência:** Precisa ser feito agora? Há um prazo apertado? \n- **Importância:** Contribui para seus objetivos de longo prazo? Tem grande impacto nos resultados?";
    } else if (lowerCaseMessage.includes("minhas tarefas")) {
      if (tasks.length > 0) {
        const ratedTasks = tasks.filter(t => t.urgency !== null && t.importance !== null);
        if (ratedTasks.length > 0) {
          responseText = `Você tem ${tasks.length} tarefas carregadas. Destas, ${ratedTasks.length} já foram avaliadas. As tarefas avaliadas estão distribuídas nos quadrantes: \n` +
                         `Fazer: ${tasks.filter(t => t.quadrant === 'do').length}\n` +
                         `Decidir: ${tasks.filter(t => t.quadrant === 'decide').length}\n` +
                         `Delegar: ${tasks.filter(t => t.quadrant === 'delegate').length}\n` +
                         `Eliminar: ${tasks.filter(t => t.quadrant === 'delete').length}`;
        } else {
          responseText = `Você tem ${tasks.length} tarefas carregadas, mas nenhuma foi avaliada ainda. Comece a avaliá-las na tela de 'Avaliar'.`;
        }
      } else {
        responseText = "Você ainda não carregou nenhuma tarefa. Vá para a tela de 'Configurar' para começar.";
      }
    } else {
      responseText = "Desculpe, não consigo ajudar com isso no momento. Tente perguntar sobre a Matriz de Eisenhower, como avaliar tarefas ou sobre suas tarefas atuais.";
    }

    setTimeout(() => {
      addMessage("ai", responseText);
      setIsThinking(false);
    }, 1500);
  }, [addMessage, tasks]);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === "" || isThinking) return;

    addMessage("user", inputMessage);
    const userMsg = inputMessage;
    setInputMessage("");

    simulateAIResponse(userMsg);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] flex flex-col h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6 text-indigo-600" /> Assistente IA da Matriz de Eisenhower
          </DialogTitle>
          <DialogDescription>
            Converse com o IA para obter ajuda e insights sobre suas tarefas e a Matriz de Eisenhower.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow p-4 border rounded-md bg-gray-50 mb-4" viewportRef={scrollAreaRef}>
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
                  {msg.sender === "ai" && <span className="font-semibold text-indigo-600 block mb-1">Assistente IA:</span>}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex justify-start">
                <div className="max-w-[80%] p-3 rounded-lg shadow-sm bg-gray-100 text-gray-800 border border-gray-200">
                  <span className="font-semibold text-indigo-600 block mb-1">Assistente IA:</span>
                  <span className="animate-pulse">Pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Pergunte ao Assistente IA..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSendMessage();
              }
            }}
            disabled={isThinking}
            className="flex-grow"
          />
          <Button onClick={handleSendMessage} disabled={isThinking}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AiAssistantModal;