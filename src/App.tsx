import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Configuration from "./pages/Configuration";
import MainLayout from "./components/MainLayout";
import { TodoistProvider } from "./context/TodoistContext";

// Import module pages
import Eisenhower from "./pages/Eisenhower";
import Agenda from "./pages/Agenda";
import Triagem from "./pages/Triagem"; // Importar o novo módulo

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TodoistProvider>
          <Routes>
            <Route path="/" element={<Configuration />} />
            <Route element={<MainLayout />}>
              <Route path="/eisenhower" element={<Eisenhower />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/triagem" element={<Triagem />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </TodoistProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;