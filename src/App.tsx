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
import Seiri from "./pages/Seiri";
import Seiketsu from "./pages/Seiketsu";
import Seiton from "./pages/Seiton";
import NovoSeiso from "./pages/NovoSeiso";
import InternalTasks from "./pages/InternalTasks";
import Planejador from "./pages/Planejador";
import ProjectManagement from "./pages/ProjectManagement";
import CreateProjectManagement from "./pages/CreateProjectManagement";
import ProjectManagementDetail from "./pages/ProjectManagementDetail";
import EditProjectManagement from "./pages/EditProjectManagement";
import FollowUp from "./pages/FollowUp";
import Shitsuke from "./pages/Shitsuke";
import Eisenhower from "./pages/Eisenhower";
import Seiso from "./pages/Seiso";
import Agenda from "./pages/Agenda";
import MassivePlanner from "./pages/MassivePlanner";
import TaskReport from "./pages/TaskReport";
import AIAgentManagerPage from "./pages/AIAgentManagerPage";
import CardDatabase from "./pages/CardDatabase"; // Importar o novo módulo

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
              <Route path="/seiri" element={<Seiri />} />
              <Route path="/seiketsu" element={<Seiketsu />} />
              <Route path="/seiton" element={<Seiton />} />
              <Route path="/novoseiso" element={<NovoSeiso />} />
              <Route path="/seiso/:taskId" element={<Seiso />} />
              <Route path="/internal-tasks" element={<InternalTasks />} />
              <Route path="/planejador" element={<Planejador />} />
              <Route path="/project-management" element={<ProjectManagement />} />
              <Route path="/project-management/create" element={<CreateProjectManagement />} />
              <Route path="/project-management/:projectId" element={<ProjectManagementDetail />} />
              <Route path="/project-management/edit/:projectId" element={<EditProjectManagement />} />
              <Route path="/follow-up" element={<FollowUp />} />
              {/* <Route path="/shitsuke" element={<Shitsuke />} /> */}
              <Route path="/eisenhower" element={<Eisenhower />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/massive-planner" element={<MassivePlanner />} />
              <Route path="/task-report" element={<TaskReport />} />
              <Route path="/agent-manager" element={<AIAgentManagerPage />} />
              <Route path="/card-database" element={<CardDatabase />} /> {/* NOVA ROTA */}
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