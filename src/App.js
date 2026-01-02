// App.js — UPDATED: ATL = Supervisors Only Dropdown + Reason Field Removed

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { login, getClients, getMeterReportsByClient } from "./api.js";

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="toast">
      {type === "success" ? "✅" : "❌"} {message}
    </div>
  );
}

function buildSlots(start, end) {
  const s = []; let c = start;
  while (true) {
    let n = new Date(c.getTime() + 60 * 60 * 1000);
    if (n > end) n = end;
    const fmt = t => t.toTimeString().substring(0, 5);
    s.push(`${fmt(c)}-${fmt(n)}`);
    if (n.getTime() === end.getTime()) break;
    c = n;
  }
  return s;
}

function getShiftSlots(shift, dateStr) {
  if (!shift || !dateStr) return [];
  const d = new Date(dateStr);
  const set = (h, m = 0, add = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + add, h, m, 0);
  if (shift === "A") return buildSlots(set(7), set(15, 30));
  if (shift === "B") return buildSlots(set(15, 30), set(0, 0, 1));
  if (shift === "C") return buildSlots(set(0), set(7));
  return [];
}

function getCurrentShiftAndTime() {
  const now = new Date(); const h = now.getHours(), m = now.getMinutes();
  const tot = h * 60 + m; const dateStr = now.toLocaleDateString("en-CA");
  let shift = "";
  if (tot >= 420 && tot < 930) shift = "A";
  else if (tot >= 930 || tot < 420) shift = "B";
  else shift = "C";
  return { date: dateStr, shift, now };
}

const LINES = Array.from({ length: 18 }).map((_, i) => `Line-${String(i + 1).padStart(2, "0")}`);

export default function App() {
  const [header, setHeader] = useState(() => {
    const { date, shift } = getCurrentShiftAndTime();
    return { date, shift, line: "" };
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [supervisors, setSupervisors] = useState([]); // ← NEW: Only supervisors for ATL

  const showToast = (m, t = "success") => setToast({ message: m, type: t });
  const updateHeader = e => setHeader({ ...header, [e.target.name]: e.target.value });

  // Fetch Customers (unchanged)
  useEffect(() => {
    async function fetchCustomers() {
      try {
        setLoading(true);
        const loginData = await login("aditya.yadav@kimbal.io", "Aditya0!");
        const token = loginData.result?.accessToken || loginData.accessToken || loginData.token;
        if (!token) { showToast("Login failed", "error"); return; }
        localStorage.setItem("authToken", token);

        const clientsData = await getClients();
        let raw = [];
        if (clientsData.items) raw = clientsData.items;
        else if (clientsData.result?.items) raw = clientsData.result.items;
        else if (Array.isArray(clientsData.result)) raw = clientsData.result;
        else if (Array.isArray(clientsData)) raw = clientsData;

        setCustomers(
          raw.map(c => ({
            id: c.id ?? c.clientId ?? c.ClientId ?? null,
            client_Name: c.client_Name ?? c.clientName ?? c.name ?? "Unknown"
          }))
        );
      } catch (e) { showToast("Failed to load clients", "error"); }
      finally { setLoading(false); }
    }
    fetchCustomers();
  }, []);

  // NEW: Fetch only supervisors for ATL dropdown
  useEffect(() => {
    async function fetchSupervisors() {
      try {
        // Step 1: Get IDs of users with role = supervisor
        const { data: supervisorRoles, error: roleError } = await supabase
          .from("user_roles")
          .select("id")
          .eq("role", "supervisor");

        if (roleError || !supervisorRoles || supervisorRoles.length === 0) {
          setSupervisors([]);
          return;
        }

        const supervisorIds = supervisorRoles.map(r => r.id);

        // Step 2: Get their names from profiles
        const { data: supervisorProfiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", supervisorIds)
          .order("name", { ascending: true });

        if (profileError) {
          console.error("Error fetching supervisor profiles:", profileError);
          setSupervisors([]);
        } else {
          setSupervisors(supervisorProfiles || []);
        }
      } catch (err) {
        console.error("Unexpected error fetching supervisors:", err);
        setSupervisors([]);
      }
    }
    fetchSupervisors();
  }, []);

  async function fetchMONumbers(customerId, rowIndex) {
    if (!customerId) return;
    try {
      const moData = await getMeterReportsByClient(customerId);
      let list = [];
      if (Array.isArray(moData)) list = moData;
      else if (moData.result) list = moData.result;
      else if (moData.data) list = moData.data;
      const copy = [...rows]; copy[rowIndex].moNumbers = list; setRows(copy);
      showToast(`${list.length} MO loaded`);
    } catch {
      const copy = [...rows]; copy[rowIndex].moNumbers = []; setRows(copy);
      showToast("MO fetch failed", "error");
    }
  }

  const loadSlots = useCallback(async () => {
    if (!header.date || !header.shift || !header.line) { setRows([]); return; }
    setLoading(true);
    const all = getShiftSlots(header.shift, header.date);
    const { data, error } = await supabase
      .from("production_entries")
      .select("time_slot")
      .eq("date", header.date)
      .eq("shift", header.shift)
      .eq("line", header.line);
    if (error) { showToast("Slots load failed", "error"); setLoading(false); return; }

    const done = (data || []).map(d => d.time_slot);
    const { now } = getCurrentShiftAndTime();
    const filtered = all
      .filter(s => !done.includes(s))
      .filter(s => {
        const [a, b] = s.split("-");
        const [sh, sm] = a.split(":").map(Number);
        const [eh, em] = b.split(":").map(Number);
        const st = new Date(now); st.setHours(sh, sm, 0, 0);
        const en = new Date(now); en.setHours(eh, em, 0, 0);
        if (en < st) en.setDate(en.getDate() + 1);
        return now >= st && now < en;
      });

    setRows(filtered.map(s => ({
      time_slot: s, meter_from: "", meter_to: "",
      ok_qty: "", nok_qty: "",
      customer_name: "", customer_id: "",
      mo_type: "", mo_number: "", moNumbers: [],
      downtime: 0, downtime_detail: "No downtime",
      downtime_issue: "", other_reason: "",
      atl: "", remarks: ""  // reason removed
    })));
    setLoading(false);
  }, [header]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const updateRow = (i, f, v) => { const c = [...rows]; c[i][f] = v; setRows(c); };

  async function submitSlot(i) {
    const r = rows[i];
    if (!r.customer_name) return showToast("Customer required", "error");
    if (!r.mo_type) return showToast("MO type required", "error");
    if (!r.mo_number) return showToast("MO number required", "error");
    if (r.downtime > 0) {
      if (!r.downtime_issue) return showToast("Select issue", "error");
      if (r.downtime_issue === "others" && !r.other_reason.trim())
        return showToast("Enter custom downtime", "error");
    }
    const final = r.downtime === 0
      ? "No downtime"
      : (r.downtime_issue === "others" ? r.other_reason.trim() : r.downtime_issue);

    const payload = {
      ...r, ...header,
      operator_status: "submitted",
      approver_status: "pending",
      skip_reason: null,
      ok_qty: Number(r.ok_qty || 0),
      nok_qty: Number(r.nok_qty || 0),
      downtime: Number(r.downtime || 0),
      downtime_detail: final
    };
    delete payload.downtime_issue; delete payload.other_reason;

    setLoading(true);
    const { error } = await supabase.from("production_entries").insert(payload);
    setLoading(false);

    if (error) { showToast("Submit failed", "error"); return; }
    showToast("Submitted successfully!");
    setRows(rows.filter((_, x) => x !== i));
  }

  async function skipSlot(i) {
    const r = rows[i];
    const reason = prompt("Reason for skipping?");
    if (!reason?.trim()) return showToast("Reason required", "error");

    const payload = {
      ...r, ...header,
      operator_status: "skipped",
      approver_status: "pending",
      skip_reason: reason.trim(),
      ok_qty: 0, nok_qty: 0,
      downtime: 0, downtime_detail: "Skipped"
    };

    setLoading(true);
    const { error } = await supabase.from("production_entries").insert(payload);
    setLoading(false);

    if (error) return showToast("Skip failed", "error");
    showToast("Slot skipped");
    setRows(rows.filter((_, x) => x !== i));
  }

  return (
    <div className="app-container">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <h1 className="app-title">Smart Sheet</h1>

      {/* HEADER CARD - unchanged */}
      <div className="header-card">
        <div className="header-grid">
          <div className="input-group">
            <label>📅 Date</label>
            <input type="date" name="date" value={header.date}
              onChange={updateHeader} className="app-input" />
          </div>
          <div className="input-group">
            <label>⏰ Shift</label>
            <select name="shift" value={header.shift}
              onChange={updateHeader} className="app-input">
              <option value="">Select</option>
              <option value="A">A (07:00–15:30)</option>
              <option value="B">B (15:30–00:00)</option>
              <option value="C">C (00:00–07:00)</option>
            </select>
          </div>
          <div className="input-group">
            <label>🔧 Line</label>
            <select name="line" value={header.line}
              onChange={updateHeader} className="app-input">
              <option value="">Select</option>
              {LINES.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading slots...</p>
        </div>
      )}

      {!header.date || !header.shift || !header.line ? (
        <div className="empty-hint">
          <span>👆 Please select Date, Shift & Line to continue</span>
        </div>
      ) : rows.length === 0 && !loading ? (
        <div className="done-box">
          <span>🎉 All slots completed for this shift!</span>
        </div>
      ) : (
        <div className="slots-container">
          {rows.map((r, i) => (
            <div key={i} className="slot-card">
              <h3 className="slot-time">⏰ {r.time_slot}</h3>

              {/* Customer, MO Type, MO Number - unchanged */}
              <div className="form-grid">
                <div className="input-group">
                  <label>Customer *</label>
                  <select
                    value={r.customer_id ? String(r.customer_id) : ""}
                    onChange={e => {
                      const v = e.target.value;
                      const c = customers.find(x => String(x.id) === String(v));
                      updateRow(i, "customer_name", c?.client_Name || "");
                      updateRow(i, "customer_id", c?.id || null);
                      if (c?.id) fetchMONumbers(c.id, i);
                    }}
                    className="app-input"
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c, k) => (
                      <option key={k} value={String(c.id ?? "")}>
                        {c.client_Name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="input-group">
                  <label>MO Type *</label>
                  <select
                    value={r.mo_type}
                    onChange={e => {
                      updateRow(i, "mo_type", e.target.value);
                      updateRow(i, "mo_number", "");
                    }}
                    className="app-input"
                  >
                    <option value="">Select</option>
                    <option value="Fresh">Fresh</option>
                    <option value="Rework">Rework</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>MO Number *</label>
                  {r.mo_type === "Fresh" ? (
                    r.moNumbers?.length ? (
                      <select
                        value={r.mo_number || ""}
                        onChange={e => updateRow(i, "mo_number", e.target.value)}
                        className="app-input"
                      >
                        <option value="">Select MO</option>
                        {r.moNumbers.map((mo, k) => {
                          const v = typeof mo === 'string' ? mo : (mo.mo_Number || mo.moNumber || mo.number || mo.mo_no || mo.id || k);
                          const display = typeof mo === 'string' ? mo : (mo.mo_Number || mo.moNumber || mo.number || mo.mo_no || mo.id || `MO ${k + 1}`);
                          return <option key={k} value={v}>{display}</option>;
                        })}
                      </select>
                    ) : (
                      <input
                        placeholder="Enter Fresh MO"
                        value={r.mo_number || ""}
                        onChange={e => updateRow(i, "mo_number", e.target.value)}
                        className="app-input"
                      />
                    )
                  ) : (
                    <input
                      placeholder="Enter Rework MO"
                      value={r.mo_number || ""}
                      onChange={e => updateRow(i, "mo_number", e.target.value)}
                      className="app-input"
                    />
                  )}
                </div>
              </div>

              {/* Meters & Qty - unchanged */}
              <div className="form-grid-4">
                <div className="input-group">
                  <label>From Meter</label>
                  <input value={r.meter_from}
                    onChange={e => updateRow(i, "meter_from", e.target.value)}
                    className="app-input" />
                </div>
                <div className="input-group">
                  <label>To Meter</label>
                  <input value={r.meter_to}
                    onChange={e => updateRow(i, "meter_to", e.target.value)}
                    className="app-input" />
                </div>
                <div className="input-group">
                  <label>OK Qty</label>
                  <input type="number" value={r.ok_qty}
                    onChange={e => updateRow(i, "ok_qty", e.target.value)}
                    className="app-input" />
                </div>
                <div className="input-group">
                  <label>NOK Qty</label>
                  <input type="number" value={r.nok_qty}
                    onChange={e => updateRow(i, "nok_qty", e.target.value)}
                    className="app-input" />
                </div>
              </div>

              {/* Downtime Section - unchanged */}
              <div className="form-grid">
                <div className="input-group">
                  <label>Downtime</label>
                  <select value={r.downtime}
                    onChange={e => {
                      const v = Number(e.target.value);
                      updateRow(i, "downtime", v);
                      if (v === 0) { updateRow(i, "downtime_issue", ""); updateRow(i, "other_reason", ""); }
                    }}
                    className="app-input"
                  >
                    <option value={0}>No Downtime</option>
                    {[5, 10, 15, 20, 30, 45, 60].map(v =>
                      <option key={v} value={v}>{v} min</option>
                    )}
                  </select>
                </div>

                <div className="input-group">
                  <label>Issue {r.downtime > 0 && "*"}</label>
                  <select
                    disabled={r.downtime === 0}
                    value={r.downtime_issue}
                    onChange={e => updateRow(i, "downtime_issue", e.target.value)}
                    className="app-input"
                  >
                    <option value="">Select Issue</option>
                    <option value="MES Issue">MES Issue</option>
                    <option value="SPM Issue">SPM Issue</option>
                    <option value="Maintenance Issue">Maintenance Issue</option>
                    <option value="others">Others</option>
                  </select>
                </div>

                {r.downtime_issue === "others" && (
                  <div className="input-group full-width">
                    <label>Custom Reason *</label>
                    <input
                      value={r.other_reason}
                      onChange={e => updateRow(i, "other_reason", e.target.value)}
                      className="app-input"
                      placeholder="Describe the issue"
                    />
                  </div>
                )}

                {/* ATL as Dropdown - Only Supervisors */}
                <div className="input-group">
                  <label>ATL (Supervisor)</label>
                  <select
                    value={r.atl || ""}
                    onChange={e => updateRow(i, "atl", e.target.value)}
                    className="app-input"
                  >
                    <option value="">Select Supervisor</option>
                    {supervisors.length === 0 ? (
                      <option value="" disabled>No Supervisor Available</option>
                    ) : (
                      supervisors.map(user => (
                        <option key={user.id} value={user.name}>
                          {user.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Only Remarks (Reason removed) */}
              <div className="form-grid-2">
                <div className="input-group full-width">
                  <label>Remarks</label>
                  <input
                    value={r.remarks}
                    onChange={e => updateRow(i, "remarks", e.target.value)}
                    className="app-input"
                    placeholder="Any additional remarks"
                  />
                </div>
              </div>

              {/* Action Buttons - unchanged */}
              <div className="action-buttons">
                <button onClick={() => submitSlot(i)} className="submit-btn">
                  Submit Slot
                </button>
                <button onClick={() => skipSlot(i)} className="skip-btn">
                  Skip Slot
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{globalStyles}</style>
    </div>
  );
}

/* CSS unchanged - same as before */
const globalStyles = `
  :root {
    --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    --glass-bg: rgba(30, 41, 59, 0.85);
    --glass-border: rgba(129, 140, 248, 0.25);
    --input-bg: rgba(15, 23, 42, 0.8);
    --input-border: rgba(129, 140, 248, 0.3);
    --text-primary: #e0e7ff;
    --text-secondary: #94a3b8;
    --accent: #818cf8;
    --success: #10b981;
    --warning: #f59e0b;
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html, body {
    width: 100%;
    overflow-x: hidden;
  }

  .app-container {
    min-height: 100vh;
    width: 100%;
    max-width: 100vw;
    padding: clamp(12px, 3vw, 20px) clamp(8px, 2vw, 12px);
    color: var(--text-primary);
    font-family: system-ui, -apple-system, sans-serif;
    overflow-x: hidden;
  }

  .app-title {
    text-align: center;
    font-size: clamp(1.8rem, 5vw, 2.2rem);
    font-weight: 900;
    margin: 8px 0 24px;
    background: linear-gradient(90deg, #c7d2fe, #818cf8, #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.5px;
  }

  .header-card, .slot-card {
    background: var(--glass-bg);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border-radius: 24px;
    padding: clamp(16px, 4vw, 24px);
    border: 1px solid var(--glass-border);
    box-shadow: 0 20px 50px rgba(0,0,0,0.4);
    width: 100%;
    overflow: hidden;
    margin-bottom: 24px;
  }

  .header-grid, .form-grid {
    display: grid;
    gap: 14px;
    grid-template-columns: 1fr;
  }

  .form-grid-2 {
    display: grid;
    gap: 14px;
    grid-template-columns: 1fr 1fr;
  }

  .form-grid-4 {
    display: grid;
    gap: 14px;
    grid-template-columns: repeat(2, 1fr);
  }

  .input-group label {
    display: block;
    color: #c4b5fd;
    font-size: clamp(13px, 2.8vw, 14px);
    font-weight: 700;
    margin-bottom: 8px;
  }

  .app-input, select, input {
    width: 100%;
    min-width: 0;
    padding: clamp(12px, 3vw, 16px) 16px;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    border-radius: 16px;
    color: var(--text-primary);
    font-size: clamp(15px, 3.2vw, 16px);
    backdrop-filter: blur(12px);
    transition: all 0.3s ease;
    outline: none;
  }

  .app-input:focus, select:focus, input:focus {
    border-color: #818cf8;
    background: rgba(15, 23, 42, 0.95);
    box-shadow: 0 0 24px rgba(129, 140, 248, 0.3);
    transform: translateY(-2px);
  }

  .slot-time {
    text-align: center;
    font-size: clamp(1.3rem, 4vw, 1.5rem);
    font-weight: 800;
    color: #c4b5fd;
    margin-bottom: 20px;
    background: linear-gradient(135deg, #c4b5fd, #e0e7ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 24px;
  }

  .submit-btn, .skip-btn {
    padding: clamp(14px, 3.5vw, 18px);
    border: none;
    border-radius: 16px;
    font-size: clamp(15px, 3.5vw, 17px);
    font-weight: 800;
    box-shadow: 0 16px 40px rgba(0,0,0,0.4);
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .submit-btn {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
    box-shadow: 0 16px 40px rgba(16,185,129,0.4);
  }

  .submit-btn:hover { transform: translateY(-3px); box-shadow: 0 24px 60px rgba(16,185,129,0.5); }

  .skip-btn {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: white;
    box-shadow: 0 16px 40px rgba(245,158,11,0.4);
  }

  .skip-btn:hover { transform: translateY(-3px); box-shadow: 0 24px 60px rgba(245,158,11,0.5); }

  .toast {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30,41,59,0.95);
    backdrop-filter: blur(20px);
    color: white;
    padding: 14px 24px;
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    font-weight: 700;
    font-size: 15px;
    z-index: 9999;
    animation: slideDown 0.4s ease;
    border: 1px solid rgba(129,140,248,0.3);
    min-width: 280px;
    text-align: center;
  }

  .loading-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(129,140,248,0.3);
    border-top-color: #818cf8;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 16px;
  }

  .empty-hint, .done-box {
    text-align: center;
    padding: 60px 20px;
    border-radius: 28px;
    font-size: clamp(1.1rem, 3.5vw, 1.3rem);
    font-weight: 700;
    margin: 20px 0;
  }

  .empty-hint {
    background: rgba(129,140,248,0.1);
    border: 2px dashed rgba(129,140,248,0.4);
    color: #818cf8;
  }

  .done-box {
    background: rgba(16,185,129,0.15);
    border: 2px dashed rgba(16,185,129,0.5);
    color: #10b981;
  }

  .full-width { grid-column: 1 / -1; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateX(-50%) translateY(-30px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  @media (min-width: 640px) {
    .app-container {
      background: 
        radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.25), transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(120, 219, 255, 0.25), transparent 50%),
        var(--bg-gradient);
      width: 100%;
    }
    .header-grid, .form-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .form-grid-2 { grid-template-columns: 1fr 1fr; }
    .form-grid-4 { grid-template-columns: repeat(4, 1fr); }
  }

  @media (min-width: 768px) {
    .app-container {
      width: 100%;
      margin: 0 auto;
      padding-left: clamp(16px, 4vw, 32px);
      padding-right: clamp(16px, 4vw, 32px);
    }
    .action-buttons { flex-direction: row; }
    .submit-btn, .skip-btn { flex: 1; }
  }

  @media (max-width: 480px) {
    .app-container {
      width: 100%;
    }
    .form-grid-4 { grid-template-columns: 1fr 1fr; }
  }
`;