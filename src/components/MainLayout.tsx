import React, { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import MainNavigation from "@/components/MainNavigation";
import { useTodoist } from "@/context/TodoistContext";
import { MadeWithDyad } from "@/components/made-with-dyad";

const MainLayout = () => {
  const { apiKey } = useTodoist();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!apiKey && location.pathname !== "/") {
      navigate("/"); // Redirect to configuration if API key is not set
    }
  }, [apiKey, navigate, location.pathname]);

  if (!apiKey && location.pathname !== "/") {
    return null; // Or a loading spinner, but redirect handles it
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <MainNavigation />
        <main className="bg-white p-6 md:p-8 rounded-xl shadow-lg">
          <Outlet /> {/* Renders the current module page */}
        </main>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default MainLayout;