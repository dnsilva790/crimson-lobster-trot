import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTodoist } from "@/context/TodoistContext";
import { toast } from "sonner";
import LoadingSpinner from "@/components/ui/loading-spinner";

const Configuration = () => {
  const [inputApiKey, setInputApiKey] = useState("");
  const { setApiKey, fetchTasks, isLoading } = useTodoist();
  const navigate = useNavigate();

  const handleConnect = async () => {
    if (!inputApiKey.trim()) {
      toast.error("Por favor, insira sua API key do Todoist.");
      return;
    }

    setApiKey(inputApiKey.trim());
    // Test the API key by fetching tasks
    const tasks = await fetchTasks();
    if (tasks) {
      toast.success("Conectado ao Todoist com sucesso!");
      navigate("/seiri");
    } else {
      // Error handling is already in TodoistContext, just clear the key if test failed
      setApiKey(""); // Clear the invalid key
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-4xl font-bold mb-4 text-indigo-800">
          Dashboard 5S - Gestão TDAH-Friendly
        </h1>
        <p className="text-lg text-gray-700 mb-6">
          Cole sua API key do Todoist para conectar e começar a organizar suas tarefas.
        </p>

        <div className="grid w-full items-center gap-1.5 mb-6">
          <Label htmlFor="api-key" className="text-left text-gray-600 font-medium">
            API Key do Todoist
          </Label>
          <Input
            type="password"
            id="api-key"
            placeholder="Sua API Key aqui..."
            value={inputApiKey}
            onChange={(e) => setInputApiKey(e.target.value)}
            className="mt-1"
            disabled={isLoading}
          />
        </div>

        <a
          href="https://todoist.com/app/settings/integrations/developer"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-600 hover:underline mb-6 block"
        >
          Obtenha sua API Key em: todoist.com/app/settings/integrations/developer
        </a>

        <Button
          onClick={handleConnect}
          className="w-full py-3 text-lg bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors duration-200"
          disabled={isLoading}
        >
          {isLoading ? (
            <LoadingSpinner size={20} className="text-white" />
          ) : (
            "Conectar Dashboard"
          )}
        </Button>

        <p className="text-xs text-gray-500 mt-4">
          🔒 Sua chave fica apenas no seu navegador (em memória).
        </p>
      </div>
    </div>
  );
};

export default Configuration;