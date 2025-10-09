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

// Import module pages (will be created in next steps)
import Seiri from "./pages/Seiri";
import Seiton from "./pages/Seiton";
// import Seiso from "./pages/Seiso"; // REMOVIDO
import Seiketsu from "./pages/Seiketsu";
import Shitsuke from "./pages/Shitsuke";
import Execucao from "./pages/Execucao";

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
              <Route path="/seiton" element={<Seiton />} />
              {/* <Route path="/seiso" element={<Seiso />} /> REMOVIDO */}
              <Route path="/seiketsu" element={<Seiketsu />} />
              <Route path="/shitsuke" element={<Shitsuke />} />
              <Route path="/execucao" element={<Execucao />} />
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