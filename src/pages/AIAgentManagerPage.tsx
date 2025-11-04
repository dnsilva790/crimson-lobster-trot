"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTodoist } from "@/context/TodoistContext";
import { TodoistTask } from "@/lib/types";
import LoadingSpinner from "@/components/ui/loading-spinner";
import AIAgentManager from "@/components/AIAgentManager";
import AIAgentPromptEditor from "@/components/AIAgentPromptEditor";
import { defaultAiManagerPrompt, AI_MANAGER_PROMPT_STORAGE_KEY } from "@/lib/constants";
import { BarChart3, ListTodo } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

const AIAgentManagerPage = () => {
  const { fetchTasks, updateTask, isLoading: isLoadingTodoist } = useTodoist();
  const [aiAgentPrompt, setAiAgentPrompt] = useState<string>(defaultAiManagerPrompt);
  const [allTasks, setAllTasks] = useState<TodoistTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);

  const handleSaveAiAgentPrompt = useCallback((newPrompt: string) => {
    setAiAgentPrompt(newPrompt);
    localStorage.setItem(AI_MANAGER_PROMPT_STORAGE_KEY, newPrompt);
  }, []);

  useEffect(() => {
    const savedPrompt = localStorage.getItem(AI_MANAGER_PROMPT_STORAGE_KEY);
    if (savedPrompt) {
      setAiAgentPrompt(savedPrompt);
    }
  }, []);

  // Fetch all tasks for the AI Assistant's global context
  useEffect(() => {
    const fetchAllTasks = async () => {
      setIsLoadingTasks(true);
      console.log("AIAgentManagerPage: Fetching all tasks for global context.");
      // Fetch all tasks, including subtasks and recurring, but not completed
      const tasks = await fetchTasks(undefined, { includeSubtasks: true, includeRecurring: true, includeCompleted: false });
      setAllTasks(tasks);
      setIsLoadingTasks(false);
      console.log(`AIAgentManagerPage: Fetched ${tasks.length} tasks for global context.`);
    };
    fetchAllTasks();
  }, [fetchTasks]);

  const isLoadingCombined = isLoadingTodoist || isLoadingTasks;

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-3">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">
          <BarChart3 className="inline-block h-8 w-8 mr-2 text-green-600" /> Agente de Gerenciamento Estratégico
        </h2>
        <p className="text-lg text-gray-600 mb-6">
          Seu assistente para análise de backlog, tomada de decisão GTD e acompanhamento global.
        </p>
      </div>
      
      <div className="lg:col-span-2">
        {isLoadingCombined ? (
          <div className="flex justify-center items-center h-96">
            <LoadingSpinner size={40} />
          </div>
        ) : (
          <AIAgentManager
            aiPrompt={aiAgentPrompt}
            allTasks={allTasks}
            updateTask={updateTask}
          />
        )}
      </div>
      
      <div className="lg:col-span-1">
        <div className="flex justify-end mb-4">
          <AIAgentPromptEditor
            initialPrompt={aiAgentPrompt}
            onSave={handleSaveAiAgentPrompt}
            storageKey={AI_MANAGER_PROMPT_STORAGE_KEY}
          />
        </div>
        <Card className="p-4">
            <CardTitle className="text-lg font-bold mb-2 flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-green-600" /> Contexto de Tarefas
            </CardTitle>
            <CardContent className="text-sm text-gray-600 p-0">
                <p>Total de tarefas ativas carregadas: <span className="font-semibold text-gray-800">{allTasks.length}</span></p>
                <p className="mt-2">O AGE tem acesso a todas as suas tarefas ativas para fornecer uma visão global do seu backlog e carga de trabalho.</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AIAgentManagerPage;