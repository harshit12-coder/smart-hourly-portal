// Auth.js - FULL PREMIUM GLASSMORPHISM LOGIN PAGE
import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSignup, setIsSignup] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage("✅ Check your email for confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage("Login successful! Redirecting...");
      }
    } catch (error) {
      setMessage("❌ " + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      width: "100vw",
      background: "transparent",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      {/* PREMIUM GLASS CARD */}
      <div style={{
        width: "95%",
        maxWidth: "26rem",
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(24px)",
        borderRadius: "1.5rem",
        padding: "2.5rem 1.5rem",
        border: "1px solid rgba(129, 140, 248, 0.3)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        textAlign: "center",
        animation: "fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) both"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "24px"
        }}>
          <img
            src="/kmp-logo.png?v=5"
            alt="Logo"
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              objectFit: "contain",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              animation: "float 6s ease-in-out infinite"
            }}
          />
        </div>

        <h2 style={{
          fontSize: "clamp(1.2rem, 3vw, 1.5rem)",
          color: "#c4b5fd",
          marginBottom: "2rem",
          fontWeight: "700"
        }}>
          {isSignup ? "Create Account" : "Welcome Back"}
        </h2>

        {/* MESSAGE */}
        {message && (
          <div style={{
            padding: "14px",
            marginBottom: "20px",
            background: message.startsWith("✅")
              ? "rgba(16, 185, 129, 0.2)"
              : "rgba(239, 68, 68, 0.2)",
            border: message.startsWith("✅")
              ? "1px solid rgba(16, 185, 129, 0.5)"
              : "1px solid rgba(239, 68, 68, 0.5)",
            borderRadius: "16px",
            color: "#e0e7ff",
            fontSize: "15px",
            fontWeight: "600"
          }}>
            {message}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "30px" }}>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "30px" }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.85rem",
              background: "linear-gradient(135deg, #60a5fa, #818cf8)",
              color: "white",
              border: "none",
              borderRadius: "1rem",
              fontSize: "1.05rem",
              fontWeight: "800",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 15px 40px rgba(96, 165, 250, 0.4)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              opacity: loading ? 0.7 : 1,
              position: "relative",
              overflow: "hidden"
            }}
            onMouseEnter={e => {
              if (!loading) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 20px 50px rgba(96, 165, 250, 0.5)";
                e.target.style.filter = "brightness(1.1)";
              }
            }}
            onMouseLeave={e => {
              if (!loading) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 15px 40px rgba(96, 165, 250, 0.4)";
                e.target.style.filter = "brightness(1)";
              }
            }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <span className="spinner"></span> {isSignup ? "Creating Account..." : "Logging in..."}
              </span>
            ) : (
              isSignup ? "Create Account" : "Login"
            )}
          </button>
        </form>

        {/* TOGGLE MODE */}
        <div style={{
          marginTop: "40px",
          color: "#94a3b8",
          fontSize: "17px"
        }}>
          {isSignup ? "Already have an account?" : "New user?"}{" "}
          <button
            onClick={() => setIsSignup(!isSignup)}
            style={{
              background: "none",
              border: "none",
              color: "#818cf8",
              fontWeight: "700",
              cursor: "pointer",
              fontSize: "17px",
              textDecoration: "underline"
            }}
          >
            {isSignup ? "Login here" : "Sign up"}
          </button>
        </div>

        {/* FOOTER */}
        <div style={{
          marginTop: "60px",
          color: "#64748b",
          fontSize: "14px"
        }}>
          SmartHourly Production Management © 2025
        </div>
      </div>
      <style>{globalStyles}</style>
    </div>
  );
}

// Premium Input Style
const inputStyle = {
  width: "100%",
  padding: "0.8rem 1.25rem",
  background: "rgba(15, 23, 42, 0.6)",
  border: "1px solid rgba(129, 140, 248, 0.2)",
  borderRadius: "1rem",
  color: "#e0e7ff",
  fontSize: "0.95rem",
  backdropFilter: "blur(12px)",
  transition: "all 0.3s ease",
  outline: "none",
  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)"
};

// Global styles for animations
const globalStyles = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(30px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spinner {
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  input:focus {
    border-color: rgba(129, 140, 248, 0.8) !important;
    background: rgba(15, 23, 42, 0.8) !important;
    box-shadow: 0 0 20px rgba(129, 140, 248, 0.2) !important;
    transform: translateY(-1px);
  }
  button:active {
    transform: translateY(1px) scale(0.98) !important;
  }
`;