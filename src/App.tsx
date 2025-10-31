import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Configuration from "./pages/Configuration";
import MainLayout from "./components/MainLayout";
import { TodoistProvider } from "./context/TodoistContext"; // Import TodoistProvider

// Import module pages
import Seiri from "./pages/Seiri";
import Seiketsu from "./pages/Seiketsu"; // Renomeado de GTDProcessor
import Seiton from "./pages/Seiton";
import NovoSeiso from "./pages/NovoSeiso"; // Renomeado de Execucao
import InternalTasks from "./pages/InternalTasks";
import Planejador from "./pages/Planejador";
import ProjectManagement from "./pages/ProjectManagement"; // Renomeado de Shitsuke
import CreateProjectManagement from "./pages/CreateProjectManagement"; // Renomeado de CreateProject
import ProjectManagementDetail from "./pages/ProjectManagementDetail"; // Renomeado de ProjectDetail
import EditProjectManagement from "./pages/EditProjectManagement"; // Renomeado de EditProject
import FollowUp from "./pages/FollowUp";
import Shitsuke from "./pages/Shitsuke"; // Importar a nova página Shitsuke (Revisão Diária)
import Eisenhower from "./pages/Eisenhower"; // Importar a nova página Eisenhower
import Seiso from "./pages/Seiso"; // Importar a nova página Seiso
import Agenda from "./pages/Agenda"; // Importar a nova página Agenda
import EmailTriage from "./pages/EmailTriage"; // Importar a nova página EmailTriage


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <TodoistProvider> {/* TodoistProvider ADICIONADO de volta aqui */}
          <Routes>
            <Route path="/" element={<Configuration />} /> {/* Initial config page */}
            <Route element={<MainLayout />}>
              <Route path="/seiri" element={<Seiri />} />
              <Route path="/seiketsu" element={<Seiketsu />} /> {/* Rota atualizada para Seiketsu */}
              <Route path="/seiton" element={<Seiton />} />
              <Route path="/novoseiso" element={<NovoSeiso />} /> {/* Rota atualizada para NovoSeiso */}
              <Route path="/seiso/:taskId" element={<Seiso />} /> {/* Rota atualizada para aceitar taskId */}
              <Route path="/internal-tasks" element={<InternalTasks />} />
              <Route path="/planejador" element={<Planejador />} />
              <Route path="/project-management" element={<ProjectManagement />} /> {/* Rota atualizada para Gestão de Projetos */}
              <Route path="/project-management/create" element={<CreateProjectManagement />} />
              <Route path="/project-management/:projectId" element={<ProjectManagementDetail />} />
              <Route path="/project-management/edit/:projectId" element={<EditProjectManagement />} />
              <Route path="/follow-up" element={<FollowUp />} />
              <Route path="/shitsuke" element={<Shitsuke />} /> {/* Nova rota para SHITSUKE (Revisão Diária) */}
              <Route path="/eisenhower" element={<Eisenhower />} /> {/* Nova rota para Eisenhower */}
              <Route path="/agenda" element={<Agenda />} /> {/* Nova rota para Agenda */}
              <Route path="/email-triage" element={<EmailTriage />} /> {/* Nova rota para EmailTriage */}
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </TodoistProvider> {/* TodoistProvider FECHADO aqui */}
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;