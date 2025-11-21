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
import Triagem from "./pages/Triagem";
import Seiri from "./pages/Seiri";
import Seiketsu from "./pages/Seiketsu";
import Seiketsu5W2H from "./pages/Seiketsu5W2H";
import Seiso from "./pages/Seiso";
import NovoSeiso from "./pages/NovoSeiso";
import Planejador from "./pages/Planejador";
import MassivePlanner from "./pages/MassivePlanner";
import FollowUp from "./pages/FollowUp";
import AIAgentManagerPage from "./pages/AIAgentManagerPage";
import InternalTasks from "./pages/InternalTasks";
import ProjectManagement from "./pages/ProjectManagement";
import CreateProjectManagement from "./pages/CreateProjectManagement";
import EditProjectManagement from "./pages/EditProjectManagement";
import ProjectManagementDetail from "./pages/ProjectManagementDetail";
import CardDatabase from "./pages/CardDatabase";
import TaskReport from "./pages/TaskReport";


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
              <Route path="/seiri" element={<Seiri />} />
              <Route path="/seiketsu" element={<Seiketsu />} />
              <Route path="/seiketsu-5w2h" element={<Seiketsu5W2H />} />
              <Route path="/seiso" element={<Seiso />} />
              <Route path="/seiso/:taskId" element={<Seiso />} /> {/* Route with param */}
              <Route path="/novo-seiso" element={<NovoSeiso />} />
              <Route path="/planejador" element={<Planejador />} />
              <Route path="/massive-planner" element={<MassivePlanner />} />
              <Route path="/follow-up" element={<FollowUp />} />
              <Route path="/ai-agent-manager" element={<AIAgentManagerPage />} />
              <Route path="/internal-tasks" element={<InternalTasks />} />
              <Route path="/project-management" element={<ProjectManagement />} />
              <Route path="/project-management/create" element={<CreateProjectManagement />} />
              <Route path="/project-management/edit/:projectId" element={<EditProjectManagement />} />
              <Route path="/project-management/:projectId" element={<ProjectManagementDetail />} />
              <Route path="/card-database" element={<CardDatabase />} />
              <Route path="/task-report" element={<TaskReport />} />
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