import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Configuration from "./pages/Configuration";
import MainLayout from "./components/MainLayout";
import { TodoistProvider } from "./context/TodoistContext";

// Import module pages
import Seiri from "./pages/Seiri";
import Seiketsu from "./pages/Seiketsu"; // Renomeado de GTDProcessor
import Seiton from "./pages/Seiton";
import Seiso from "./pages/Seiso";
import Execucao from "./pages/Execucao";
import InternalTasks from "./pages/InternalTasks";
import Planejador from "./pages/Planejador";
import Shitsuke from "./pages/Shitsuke";
import CreateProject from "./pages/CreateProject";
import ProjectDetail from "./pages/ProjectDetail";
import EditProject from "./pages/EditProject";
import FollowUp from "./pages/FollowUp";
import SeitonReview from "./pages/SeitonReview"; // Importar a nova página SeitonReview

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TodoistProvider>
          <Routes>
            <Route path="/" element={<Configuration />} /> {/* Initial config page */}
            <Route element={<MainLayout />}>
              <Route path="/seiri" element={<Seiri />} />
              <Route path="/seiketsu" element={<Seiketsu />} /> {/* Rota atualizada para Seiketsu */}
              <Route path="/seiton-review" element={<SeitonReview />} /> {/* Nova rota para SeitonReview */}
              <Route path="/seiton" element={<Seiton />} />
              <Route path="/seiso" element={<Seiso />} />
              <Route path="/execucao" element={<Execucao />} />
              <Route path="/internal-tasks" element={<InternalTasks />} />
              <Route path="/planejador" element={<Planejador />} />
              <Route path="/shitsuke" element={<Shitsuke />} />
              <Route path="/shitsuke/create" element={<CreateProject />} />
              <Route path="/shitsuke/:projectId" element={<ProjectDetail />} />
              <Route path="/shitsuke/edit/:projectId" element={<EditProject />} />
              <Route path="/follow-up" element={<FollowUp />} />
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