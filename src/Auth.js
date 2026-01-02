import { useState } from "react";
import { supabase } from "./supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");           // ← Naya
  const [department, setDepartment] = useState(""); // ← Naya
  const [phone, setPhone] = useState("");         // ← Naya
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSignup, setIsSignup] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (isSignup) {
        // Validation for extra fields
        if (!name.trim()) throw new Error("Full name is required");
        if (!department.trim()) throw new Error("Department is required");

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name.trim(),
              department: department.trim(),
              phone: phone.trim() || null, // optional field
            },
          },
        });

        if (error) throw error;
        if (!data.user) throw new Error("Signup failed");

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
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo-container">
          <img src="/kmp-logo.png?v=5" alt="Logo" className="logo" />
        </div>

        <h2 className="title">
          {isSignup ? "Create Account" : "Welcome Back"}
        </h2>

        {message && (
          <div className={`message ${message.startsWith("✅") ? "success" : "error"}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {/* EXTRA FIELDS ONLY IN SIGNUP MODE */}
          {isSignup && (
            <>
              <div className="input-wrapper">
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="auth-input"
                />
              </div>

              <div className="input-wrapper">
                <input
                  type="text"
                  placeholder="Department *"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  className="auth-input"
                />
              </div>

              <div className="input-wrapper">
                <input
                  type="tel"
                  placeholder="Phone Number (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="auth-input"
                />
              </div>
            </>
          )}

          <div className="input-wrapper">
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
            />
          </div>

          <div className="input-wrapper">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="auth-input"
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? (
              <span className="loading-state">
                <span className="spinner"></span>
                {isSignup ? "Creating Account..." : "Logging in..."}
              </span>
            ) : (
              isSignup ? "Create Account" : "Login"
            )}
          </button>
        </form>

        <div className="toggle-container">
          {isSignup ? "Already have an account?" : "New user?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignup(!isSignup);
              setMessage(""); // clear message on toggle
            }}
            className="toggle-btn"
            disabled={loading}
          >
            {isSignup ? "Login here" : "Sign up"}
          </button>
        </div>

        <div className="footer">
          SmartHourly Production Management © 2025
        </div>
      </div>

      <style>{globalStyles}</style>
    </div>
  );
}
// RESPONSIVE MOBILE-APP LIKE GLOBAL STYLES
const globalStyles = `
  :root {
    --glass-bg: rgba(30, 41, 59, 0.85);
    --glass-border: rgba(129, 140, 248, 0.3);
    --input-bg: rgba(15, 23, 42, 0.75);
    --input-border: rgba(129, 140, 248, 0.2);
    --btn-primary: linear-gradient(135deg, #60a5fa, #818cf8);
    --success-bg: rgba(16, 185, 129, 0.2);
    --error-bg: rgba(239, 68, 68, 0.2);
    --text-primary: #e0e7ff;
    --text-secondary: #94a3b8;
    --shadow: 0 25px 70px rgba(0,0,0,0.5);
  }

  * {
    box-sizing: border-box;
  }

  /* MOBILE APP LIKE CONTAINER */
  .auth-container {
    min-height: 100vh;
    width: 100vw;
    background: 
      radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(120, 219, 255, 0.3) 0%, transparent 50%),
      linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    position: relative;
    overflow: hidden;
  }

  .auth-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
      url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    animation: float 20s ease-in-out infinite;
  }

  /* GLASS CARD - MOBILE APP STYLE */
  .auth-card {
    width: 100%;
    max-width: 28rem;
    min-height: 480px;
    background: var(--glass-bg);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border-radius: 24px;
    padding: clamp(24px, 5vw, 32px);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow);
    text-align: center;
    animation: fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) both;
    position: relative;
    overflow: hidden;
  }

  .auth-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.5), transparent);
  }

  /* LOGO */
  .logo-container {
    display: flex;
    justify-content: center;
    margin-bottom: 28px;
    padding-top: 12px;
  }

  .logo {
    width: clamp(56px, 16vw, 72px);
    height: clamp(56px, 16vw, 72px);
    border-radius: 50%;
    object-fit: contain;
    box-shadow: 0 16px 40px rgba(0,0,0,0.4);
    animation: float 6s ease-in-out infinite;
    border: 3px solid rgba(255,255,255,0.1);
  }

  /* TITLE */
  .title {
    font-size: clamp(1.4rem, 4vw, 1.75rem);
    color: #c4b5fd;
    margin-bottom: 28px;
    font-weight: 800;
    background: linear-gradient(135deg, #c4b5fd, #e0e7ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }

  /* MESSAGE */
  .message {
    padding: 16px 20px;
    margin-bottom: 28px;
    border-radius: 20px;
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 600;
    border: 1px solid;
  }

  .message.success {
    background: var(--success-bg);
    border-color: rgba(16, 185, 129, 0.5);
  }

  .message.error {
    background: var(--error-bg);
    border-color: rgba(239, 68, 68, 0.5);
  }

  /* INPUTS - MOBILE APP STYLE */
  .input-wrapper {
    margin-bottom: 24px;
    position: relative;
  }

  .auth-input {
    width: 100%;
    padding: clamp(14px, 3.5vw, 18px) 20px;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    border-radius: 16px;
    color: var(--text-primary);
    font-size: clamp(16px, 3vw, 17px);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    font-weight: 500;
  }

  .auth-input::placeholder {
    color: #64748b;
  }

  .auth-input:focus {
    border-color: rgba(129, 140, 248, 0.8) !important;
    background: rgba(15, 23, 42, 0.9) !important;
    box-shadow: 0 8px 32px rgba(129, 140, 248, 0.25), inset 0 1px 2px rgba(0,0,0,0.1) !important;
    transform: translateY(-2px);
  }

  /* SUBMIT BUTTON - MOBILE APP STYLE */
  .submit-btn {
    width: 100%;
    padding: clamp(16px, 4vw, 20px);
    background: var(--btn-primary);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: clamp(16px, 3.5vw, 18px);
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 16px 48px rgba(96, 165, 250, 0.4);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 32px;
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 24px 64px rgba(96, 165, 250, 0.5);
    filter: brightness(1.08);
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(-1px) scale(0.98);
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none !important;
  }

  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .spinner {
    width: 22px;
    height: 22px;
    border: 3px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  /* TOGGLE BUTTON */
  .toggle-container {
    margin-bottom: 24px;
    color: var(--text-secondary);
    font-size: clamp(15px, 3.5vw, 17px);
    font-weight: 500;
  }

  .toggle-btn {
    background: none;
    border: none;
    color: #818cf8;
    font-weight: 800;
    cursor: pointer;
    font-size: inherit;
    text-decoration: none;
    padding: 4px 0;
    position: relative;
  }

  .toggle-btn::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 0;
    height: 2px;
    background: linear-gradient(90deg, #60a5fa, #818cf8);
    transition: width 0.3s ease;
  }

  .toggle-btn:hover::after {
    width: 100%;
  }

  /* FOOTER */
  .footer {
    color: #64748b;
    font-size: clamp(13px, 2.5vw, 14px);
    font-weight: 500;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }

  /* ANIMATIONS */
  @keyframes fadeInUp {
    from { 
      opacity: 0; 
      transform: translateY(40px) scale(0.95); 
    }
    to { 
      opacity: 1; 
      transform: translateY(0) scale(1); 
    }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    33% { transform: translateY(-8px) rotate(2deg); }
    66% { transform: translateY(-4px) rotate(-1deg); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* RESPONSIVE BREAKPOINTS */
  @media (max-width: 480px) {
    .auth-container {
      padding: 12px;
      background-size: 150% 150%;
    }
    
    .auth-card {
      border-radius: 20px;
      padding: 24px 20px;
      margin: 0 4px;
    }
    
    .logo {
      border: 2px solid rgba(255,255,255,0.15);
    }
    
    .submit-btn {
      margin-bottom: 28px;
    }
  }

  @media (min-width: 768px) {
  
    .auth-card {
      max-width: 420px;
      padding: 40px 32px;
      border-radius: 28px;
    }
    
    .logo-container {
      margin-bottom: 32px;
    }
    
    .title {
      margin-bottom: 32px;
    }
    
    .input-wrapper {
      margin-bottom: 28px;
    }
  }

  @media (min-width: 1024px) {
    .auth-container {
      padding: 40px;
    }
    
    .auth-card {
      box-shadow: 0 40px 100px rgba(0,0,0,0.6);
    }
  }

  /* SAFARI BACKDROP FILTER FIX */
  @supports (-webkit-touch-callout: none) {
    .auth-card,
    .auth-input {
      backdrop-filter: blur(32px);
    }
  }

  /* HIGH-END DEVICES */
  @media (prefers-reduced-motion: no-preference) {
    .auth-card:hover {
      transform: translateY(-4px);
    }
  }
`;