import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTodoist } from "@/context/TodoistContext";
import MainLayout from "@/components/MainLayout";

const Index = () => {
  const { apiKey } = useTodoist();
  const navigate = useNavigate();

  useEffect(() => {
    if (!apiKey) {
      navigate("/"); // Redirect to configuration if API key is not set
    }
  }, [apiKey, navigate]);

  // If API key is present, render the MainLayout which will handle further routing
  // If not, the useEffect will redirect to '/', which is the Configuration page.
  // This page essentially acts as a smart redirect/entry point.
  return apiKey ? <MainLayout /> : null;
};

export default Index;