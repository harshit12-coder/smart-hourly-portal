// src/index.js - FINAL PREMIUM + MOBILE RESPONSIVE
import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";

import App from "./App";
import Report from "./Report";
import Supervisor from "./Supervisor";
import Admin from "./Admin";
import Auth from "./Auth";
import { supabase } from "./supabase";
import { useRole } from "./useRole";

function ProtectedRoute({ children, allowedRoles }) {
  const role = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (role && !allowedRoles.includes(role)) {
      if (role === "operator") navigate("/", { replace: true });
      else if (role === "supervisor") navigate("/supervisor", { replace: true });
      else if (role === "admin") navigate("/admin", { replace: true });
    }
  }, [role, allowedRoles, navigate]);

  if (role === null) return <div style={loadingStyle}>Initializing Dashboard...</div>;
  if (!allowedRoles.includes(role)) return null;

  return children;
}

function Root() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading || !user || role === null) return;

    const path = window.location.pathname;

    if (role === "operator" && path !== "/") navigate("/", { replace: true });
    else if (role === "supervisor" && path !== "/supervisor") navigate("/supervisor", { replace: true });
    else if (role === "admin" && !["/", "/report", "/supervisor", "/admin"].includes(path)) {
      navigate("/admin", { replace: true });
    }
  }, [user, role, loading, navigate]);

  if (loading) {
    return (
      <div style={loadingStyle}>
        <div>SMART-HOURLY</div>
        <div style={{ fontSize: 16, marginTop: 16, opacity: 0.8 }}>Premium Dashboard Loading...</div>
      </div>
    );
  }

  if (!user) return <Auth />;

  const navLinks = (
    <>
      {role === "operator" && <Link to="/" onClick={() => setMobileMenuOpen(false)} style={navLinkStyle(window.location.pathname === "/")}>Production Entry</Link>}
      {role === "supervisor" && <Link to="/supervisor" onClick={() => setMobileMenuOpen(false)} style={navLinkStyle(window.location.pathname === "/supervisor")}>Review Panel</Link>}
      {role === "admin" && (
        <>
          <Link to="/" onClick={() => setMobileMenuOpen(false)} style={navLinkStyle(window.location.pathname === "/")}>Entry</Link>
          <Link to="/report" onClick={() => setMobileMenuOpen(false)} style={navLinkStyle(window.location.pathname === "/report")}>Reports</Link>
          <Link to="/supervisor" onClick={() => setMobileMenuOpen(false)} style={navLinkStyle(window.location.pathname === "/supervisor")}>Supervisor</Link>
          <Link to="/admin" onClick={() => setMobileMenuOpen(false)} style={navLinkStyle(window.location.pathname === "/admin")}>Admin</Link>
        </>
      )}
    </>
  );

  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      display: "flex",
      flexDirection: "column",
      background: "transparent",
      color: "#e0e7ff",
      overflow: "hidden"
    }}>
     <nav style={{
        backdropFilter: "blur(20px)",
        background: "rgba(15, 23, 42, 0.4)",
        borderBottom: "1px solid rgba(167, 139, 250, 0.15)",
        padding: "12px 24px",
        flexShrink: 0,
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        position: "relative",
        zIndex: 1000
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
            <Link to="/" style={{ textDecoration: "none" }}>
              <h1 style={{
                fontSize: "clamp(1.2rem, 2vw, 1.5rem)",
                fontWeight: "900",
                background: "linear-gradient(90deg, #a78bfa, #818cf8, #60a5fa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "1px",
                textShadow: "0 0 20px rgba(167, 139, 250, 0.4)"
              }}>
                SmartHourly
              </h1>
            </Link>

            <div className="desktop-nav" style={{ display: "flex", gap: "32px" }}>
              {navLinks}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
           <button
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                background: mobileMenuOpen 
                  ? "rgba(167, 139, 250, 0.2)" 
                  : "rgba(129, 140, 248, 0.15)",
                border: "1px solid rgba(167, 139, 250, 0.3)",
                color: "#c4b5fd",
                fontSize: "24px",
                cursor: "pointer",
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
                backdropFilter: "blur(10px)",
                boxShadow: mobileMenuOpen 
                  ? "0 0 20px rgba(167, 139, 250, 0.3)" 
                  : "0 4px 15px rgba(0,0,0,0.2)"
              }}
              onMouseEnter={e => {
                e.target.style.background = "rgba(167, 139, 250, 0.25)";
                e.target.style.transform = "scale(1.05)";
              }}
              onMouseLeave={e => {
                e.target.style.background = mobileMenuOpen 
                  ? "rgba(167, 139, 250, 0.2)" 
                  : "rgba(129, 140, 248, 0.15)";
                e.target.style.transform = "scale(1)";
              }}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>

            <button style={{
              padding: "0.6rem 1.5rem",
              background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
              border: "none",
              borderRadius: "10px",
              color: "white",
              fontWeight: "700",
              fontSize: "0.85rem",
              cursor: "pointer",
              boxShadow: "0 8px 25px rgba(220, 38, 38, 0.4)",
              transition: "all 0.4s ease"
            }}
              onMouseEnter={e => e.target.style.transform = "translateY(-4px) scale(1.02)"}
              onMouseLeave={e => e.target.style.transform = "translateY(0) scale(1)"}
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/", { replace: true });
              }}>
              Logout
            </button>
          </div>
        </div>

        {/* MOBILE MENU DROPDOWN */}
        {mobileMenuOpen && (
          <div className="mobile-menu" style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "rgba(15, 23, 42, 0.98)",
            backdropFilter: "blur(24px)",
            padding: "24px 20px",
            borderBottom: "1px solid rgba(167, 139, 250, 0.3)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.7)",
            zIndex: 9999,
            animation: "slideDown 0.3s ease-out"
          }}>
            {navLinks}
          </div>
        )}
      </nav>

      <main style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px 24px",
        width: "100%"
      }}>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/report" element={<ProtectedRoute allowedRoles={["admin"]}><Report /></ProtectedRoute>} />
          <Route path="/supervisor" element={<ProtectedRoute allowedRoles={["supervisor", "admin"]}><Supervisor /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><Admin /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

const navLinkStyle = (active) => ({
  color: active ? "#c4b5fd" : "#94a3b8",
  textDecoration: "none",
  fontSize: "0.95rem",
  fontWeight: "700",
  opacity: active ? 1 : 0.85,
  textShadow: active ? "0 0 12px rgba(196, 181, 253, 0.4)" : "none",
  transition: "all 0.4s ease"
});

const loadingStyle = {
  height: "100vh",
  width: "100vw",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#0f172a",
  color: "#c4b5fd",
  fontSize: "clamp(1.5rem, 4vw, 2rem)",
  fontWeight: "800",
  letterSpacing: "2px",
  textShadow: "0 0 30px rgba(196, 181, 253, 0.6)"
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <Root />
  </BrowserRouter>
);