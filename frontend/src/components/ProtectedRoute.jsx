import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { CircleNotch } from "@phosphor-icons/react";

export const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (user === undefined)
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <CircleNotch size={28} className="animate-spin text-primary" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return children;
};
