import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, status, manualSignOut } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <div className="page-loading" role="status"><span className="spinner spinner-lg" /><span className="sr-only">Loading your account</span></div>;
  }
  if (!isAuthenticated) {
    return manualSignOut ? <Navigate to="/" replace /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
