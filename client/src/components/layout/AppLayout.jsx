import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function AppLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <>
      <a href="#main" className="skip-link">Skip to main content</a>
      <Navbar />
      <main id="main" tabIndex={-1}><Outlet /></main>
      <Footer />
    </>
  );
}
