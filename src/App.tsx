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
import NovoSeiso from "./pages/NovoSeiso"; // Renomeado de Execucao
import InternalTasks from "./pages/InternalTasks";
import Planejador from "./pages/Planejador";
import Shitsuke from "./pages/Shitsuke";
import CreateProject from "./pages/CreateProject";
import ProjectDetail from "./pages/ProjectDetail"; // Importar a nova página ProjectDetail
import EditProject from "./pages/EditProject";
import FollowUp from "./pages/FollowUp";
import SeitonReview from "./pages/SeitonReview"; // Importar a nova página SeitonReview
import Deadlines from "./pages/Deadlines"; // Importar a nova página Deadlines


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
              <Route path="/novoseiso" element={<NovoSeiso />} /> {/* Rota atualizada para NovoSeiso */}
              <Route path="/internal-tasks" element={<InternalTasks />} />
              <Route path="/planejador" element={<Planejador />} />
              <Route path="/shitsuke" element={<Shitsuke />} />
              <Route path="/shitsuke/create" element={<CreateProject />} />
              <Route path="/shitsuke/:projectId" element={<ProjectDetail />} /> {/* Nova rota para detalhes do projeto */}
              <Route path="/shitsuke/edit/:projectId" element={<EditProject />} />
              <Route path="/follow-up" element={<FollowUp />} />
              <Route path="/deadlines" element={<Deadlines />} /> {/* NOVA ROTA */}
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