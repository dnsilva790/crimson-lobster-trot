import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { TodoistProvider } from "./context/TodoistContext"; // Import TodoistProvider

createRoot(document.getElementById("root")!).render(
  <App />
);