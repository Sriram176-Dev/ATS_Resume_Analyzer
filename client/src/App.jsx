import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import { useAuth } from "./context/AuthContext";

// Route-level code splitting keeps the first load small.
const Landing = lazy(() => import("./pages/Landing/Landing"));
const Login = lazy(() => import("./pages/Login/Login"));
const Register = lazy(() => import("./pages/Register/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard"));
const Report = lazy(() => import("./pages/Report/Report"));
const Contact = lazy(() => import("./pages/Contact/Contact"));
const NotFound = lazy(() => import("./pages/NotFound/NotFound"));

/** Signed-in users skip the marketing page and the sign-in / register forms. */
function GuestOnly({ children }) {
  const { isAuthenticated, status } = useAuth();
  if (status === "loading") return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

const Loading = () => (
  <div className="page-loading" role="status"><span className="spinner spinner-lg" /><span className="sr-only">Loading</span></div>
);

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<GuestOnly><Landing /></GuestOnly>} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/reports/:id" element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/your-resumes" element={<Navigate to="/dashboard" replace />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
