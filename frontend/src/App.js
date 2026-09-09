import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Toaster } from "@/components/ui/sonner";

import PublicForm from "@/pages/PublicForm";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import TicketsList from "@/pages/TicketsList";
import TicketDetail from "@/pages/TicketDetail";
import Brands from "@/pages/Brands";
import Agents from "@/pages/Agents";
import Settings from "@/pages/Settings";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicForm />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="tickets" element={<TicketsList />} />
            <Route path="tickets/:id" element={<TicketDetail />} />
            <Route path="brands" element={<Brands />} />
            <Route path="agents" element={<Agents />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors />
    </AuthProvider>
  );
}

export default App;
