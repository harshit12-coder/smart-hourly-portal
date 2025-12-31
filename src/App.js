// App.js - FULL PREMIUM PRODUCTION ENTRY PAGE
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

const globalStyles = `
  @keyframes reveal {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

// Toast Component (Simple & Beautiful)
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: "fixed",
      top: 100,
      right: 30,
      background: type === "success"
        ? "linear-gradient(135deg, #10b981, #059669)"
        : "linear-gradient(135deg, #ef4444, #dc2626)",
      color: "white",
      padding: "16px 24px",
      borderRadius: "16px",
      boxShadow: "0 15px 40px rgba(0,0,0,0.4)",
      fontWeight: "600",
      fontSize: "16px",
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      gap: 12,
      animation: "slideIn 0.4s ease"
    }}>
      <span>{type === "success" ? "✅" : "❌"}</span>
      {message}
    </div>
  );
}

function buildSlots(start, end) {
  const slots = [];
  let current = start;

  while (true) {
    let next = new Date(current.getTime() + 60 * 60 * 1000);
    if (next > end) next = end;

    const fmt = t => t.toTimeString().substring(0, 5);
    slots.push(`${fmt(current)}-${fmt(next)}`);

    if (next.getTime() === end.getTime()) break;
    current = next;
  }
  return slots;
}

function getShiftSlots(shift, dateStr) {
  if (!shift || !dateStr) return [];
  const d = new Date(dateStr);

  const set = (h, m = 0, addDay = 0) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDay, h, m, 0);

  if (shift === "A") return buildSlots(set(7), set(15, 30));
  if (shift === "B") return buildSlots(set(15, 30), set(0, 0, 1));
  if (shift === "C") return buildSlots(set(0, 0), set(7, 0));

  return [];
}

const LINES = Array.from({ length: 18 }).map(
  (_, i) => `Line-${String(i + 1).padStart(2, "0")}`
);

export default function App() {
  const [header, setHeader] = useState({ date: "", shift: "", line: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // External API State
  const [clients, setClients] = useState([]);
  const [moCache, setMoCache] = useState({});
  const [apiToken, setApiToken] = useState("");

  useEffect(() => {
    async function initApi() {
      try {
        const loginRes = await fetch('/api/login', { method: 'POST' });
        const loginData = await loginRes.json();
        if (loginData.result && loginData.result.accessToken) {
          const token = loginData.result.accessToken;
          setApiToken(token);

          const clientRes = await fetch('/api/clients', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const clientData = await clientRes.json();
          setClients(clientData.result?.items || []);
        }
      } catch (err) {
        console.error("API init error:", err);
      }
    }
    initApi();
  }, []);

  const loadMoNumbers = async (clientId) => {
    if (!clientId || moCache[clientId]) return;
    try {
      const res = await fetch(`/api/mo-numbers?clientId=${clientId}`, {
        headers: { Authorization: `Bearer ${apiToken}` }
      });
      const data = await res.json();
      setMoCache(prev => ({ ...prev, [clientId]: data.result?.items || data.result || [] }));
    } catch (err) {
      console.error("MO load error:", err);
    }
  };

  function updateHeader(e) {
    setHeader({ ...header, [e.target.name]: e.target.value });
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  const loadSlots = useCallback(async () => {
    if (!header.date || !header.shift || !header.line) {
      setRows([]);
      return;
    }

    setLoading(true);
    const allSlots = getShiftSlots(header.shift, header.date);

    const { data, error } = await supabase
      .from("production_entries")
      .select("time_slot")
      .eq("date", header.date)
      .eq("shift", header.shift)
      .eq("line", header.line);

    if (error) {
      showToast("Failed to load slots: " + error.message, "error");
      setLoading(false);
      return;
    }

    const done = (data || []).map(d => d.time_slot);

    setRows(
      allSlots
        .filter(s => !done.includes(s))
        .map(s => ({
          time_slot: s,
          meter_from: "",
          meter_to: "",
          ok_qty: "",
          nok_qty: "",
          customer_name: "",
          mo_type: "",
          mo_number: "",
          downtime: 0,
          downtime_detail: "No downtime",
          atl: "",
          reason: "",
          remarks: ""
        }))
    );
    setLoading(false);
  }, [header, supabase]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  function updateRow(i, field, value) {
    const copy = [...rows];
    copy[i][field] = value;

    // Trigger MO load if customer changed
    if (field === "customer_name") {
      const selectedClient = clients.find(c => c.client_Name === value);
      if (selectedClient) {
        loadMoNumbers(selectedClient.id);
        copy[i]["mo_number"] = ""; // Reset MO number when customer changes
      }
    }

    setRows(copy);
  }

  async function submitSlot(i) {
    const r = rows[i];

    if (!r.customer_name) return showToast("Customer Name is required", "error");
    if (!r.mo_type) return showToast("Please select MO Type", "error");
    if (!r.mo_number) return showToast("MO Number is required", "error");
    if (r.downtime > 0 && !r.downtime_detail.trim()) return showToast("Enter downtime reason", "error");

    const payload = {
      ...r,
      ...header,
      operator_status: "submitted",
      approver_status: "pending",
      skip_reason: null,
      ok_qty: Number(r.ok_qty || 0),
      nok_qty: Number(r.nok_qty || 0),
      downtime: Number(r.downtime || 0)
    };

    setLoading(true);
    const { error } = await supabase.from("production_entries").insert(payload);
    setLoading(false);

    if (error) {
      if (error.message.includes("duplicate")) {
        showToast("This slot is already submitted!", "error");
      } else {
        showToast("Submit failed: " + error.message, "error");
      }
      return;
    }

    showToast(`Slot ${r.time_slot} submitted successfully!`, "success");
    setRows(rows.filter((_, idx) => idx !== i));
  }

  async function skipSlot(i) {
    const r = rows[i];
    const reason = prompt("Reason for skipping this slot?");
    if (!reason?.trim()) {
      showToast("Skip cancelled - reason required", "error");
      return;
    }

    const payload = {
      ...r,
      ...header,
      operator_status: "skipped",
      approver_status: "pending",
      skip_reason: reason.trim(),
      ok_qty: 0,
      nok_qty: 0,
      downtime: 0,
      downtime_detail: "Skipped"
    };

    setLoading(true);
    const { error } = await supabase.from("production_entries").insert(payload);
    setLoading(false);

    if (error) {
      showToast("Skip failed: " + error.message, "error");
      return;
    }

    showToast(`Slot ${r.time_slot} skipped`, "success");
    setRows(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ padding: "1.5rem 1rem", maxWidth: "1200px", width: "98%", margin: "0 auto" }}>
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <style>{globalStyles}</style>

      {/* Header */}
      <h1 style={{
        fontSize: "clamp(1.5rem, 4vw, 1.8rem)",
        fontWeight: "800",
        textAlign: "center",
        marginBottom: "1.5rem",
        background: "linear-gradient(90deg, #c4b5fd, #818cf8, #60a5fa)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        textShadow: "0 0 30px rgba(196, 181, 253, 0.4)",
        animation: "reveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) both"
      }}>
        SmartHourly Production
      </h1>

      {/* Header Filters Card */}
      <div style={{
        background: "rgba(30, 41, 59, 0.4)",
        backdropFilter: "blur(20px)",
        borderRadius: "1.25rem",
        padding: "1.25rem 1.5rem",
        border: "1px solid rgba(129, 140, 248, 0.15)",
        boxShadow: "0 15px 40px rgba(0,0,0,0.3)",
        marginBottom: "1.25rem",
        animation: "reveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) both",
        animationDelay: "0.1s"
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px"
        }}>
          <div>
            <label style={labelStyle}>📅 Date</label>
            <input type="date" name="date" value={header.date} onChange={updateHeader} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>⏰ Shift</label>
            <select name="shift" value={header.shift} onChange={updateHeader} style={inputStyle}>
              <option value="">Select Shift</option>
              <option value="A">A Shift (07:00 - 15:30)</option>
              <option value="B">B Shift (15:30 - 00:00)</option>
              <option value="C">C Shift (00:00 - 07:00)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>🔧 Production Line</label>
            <select name="line" value={header.line} onChange={updateHeader} style={inputStyle}>
              <option value="">Select Line</option>
              {LINES.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* States */}
      {loading && (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", fontSize: "20px" }}>
          🔄 Loading time slots...
        </div>
      )}

      {!header.date || !header.shift || !header.line ? (
        <div style={{
          textAlign: "center",
          padding: "80px",
          background: "rgba(129, 140, 248, 0.1)",
          borderRadius: "24px",
          color: "#818cf8",
          fontSize: "24px",
          fontWeight: "600"
        }}>
          👆 Please select Date, Shift, and Line to load available slots
        </div>
      ) : rows.length === 0 && !loading ? (
        <div style={{
          textAlign: "center",
          padding: "100px",
          background: "rgba(16, 185, 129, 0.15)",
          borderRadius: "30px",
          border: "2px dashed rgba(16, 185, 129, 0.4)",
          color: "#10b981",
          fontSize: "32px",
          fontWeight: "bold"
        }}>
          🎉 Amazing! All slots completed for this shift
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              background: "rgba(15, 23, 42, 0.3)",
              backdropFilter: "blur(16px)",
              borderRadius: "24px",
              padding: "24px",
              border: "1px solid rgba(129, 140, 248, 0.1)",
              marginBottom: "24px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
              animation: "reveal 0.8s cubic-bezier(0.22, 1, 0.36, 1) both",
              animationDelay: `${0.2 + (i * 0.1)}s`,
              transition: "all 0.4s ease"
            }}>
              <h3 style={{
                color: "#c4b5fd",
                fontSize: "20px",
                marginBottom: "20px",
                textAlign: "center",
                fontWeight: "800",
                textShadow: "0 0 15px rgba(196, 181, 253, 0.3)"
              }}>
                ⏰ Time Slot: {r.time_slot}
              </h3>

              {/* Row 1 */}
              <div style={gridStyle}>
                <select
                  value={r.customer_name}
                  onChange={e => updateRow(i, "customer_name", e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select Customer *</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.client_Name}>
                      {c.client_Name}
                    </option>
                  ))}
                </select>

                <select value={r.mo_type} onChange={e => { updateRow(i, "mo_type", e.target.value); updateRow(i, "mo_number", ""); }} style={inputStyle}>
                  <option value="">Select MO Type *</option>
                  <option value="Fresh">Fresh MO</option>
                  <option value="Rework">Rework MO</option>
                </select>

                {r.mo_type === "Fresh" ? (
                  <select
                    value={r.mo_number}
                    onChange={e => updateRow(i, "mo_number", e.target.value)}
                    style={inputStyle}
                    disabled={!r.customer_name}
                  >
                    <option value="">Select MO Number *</option>
                    {(moCache[clients.find(c => c.client_Name === r.customer_name)?.id] || []).map((mo, moIdx) => {
                      const val = mo.moNumber || mo;
                      return <option key={moIdx} value={val}>{val}</option>;
                    })}
                  </select>
                ) : (
                  <input
                    placeholder={!r.mo_type ? "Select MO Type first" : "Enter Rework MO Number *"}
                    disabled={!r.mo_type}
                    value={r.mo_number}
                    onChange={e => updateRow(i, "mo_number", e.target.value)}
                    style={inputStyle}
                  />
                )}
              </div>

              {/* Row 2 */}
              <div style={gridStyle4}>
                <input placeholder="From Meter" value={r.meter_from} onChange={e => updateRow(i, "meter_from", e.target.value)} style={inputStyle} />
                <input placeholder="To Meter" value={r.meter_to} onChange={e => updateRow(i, "meter_to", e.target.value)} style={inputStyle} />
                <input type="number" placeholder="OK Qty" value={r.ok_qty} onChange={e => updateRow(i, "ok_qty", e.target.value)} style={inputStyle} />
                <input type="number" placeholder="NOK Qty" value={r.nok_qty} onChange={e => updateRow(i, "nok_qty", e.target.value)} style={inputStyle} />
              </div>

              {/* Row 3 */}
              <div style={gridStyle}>
                <select value={r.downtime} onChange={e => { const v = Number(e.target.value); updateRow(i, "downtime", v); updateRow(i, "downtime_detail", v === 0 ? "No downtime" : ""); }} style={inputStyle}>
                  <option value={0}>No Downtime</option>
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={20}>20 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                </select>
                <input
                  placeholder={r.downtime === 0 ? "No downtime" : "Downtime Reason *"}
                  disabled={r.downtime === 0}
                  value={r.downtime_detail}
                  onChange={e => updateRow(i, "downtime_detail", e.target.value)}
                  style={inputStyle}
                />
                <input placeholder="ATL" value={r.atl} onChange={e => updateRow(i, "atl", e.target.value)} style={inputStyle} />
              </div>

              {/* Row 4 */}
              <div style={gridStyle2}>
                <input placeholder="Reason (if any)" value={r.reason} onChange={e => updateRow(i, "reason", e.target.value)} style={inputStyle} />
                <input placeholder="Remarks" value={r.remarks} onChange={e => updateRow(i, "remarks", e.target.value)} style={inputStyle} />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", justifyContent: "center", gap: "16px", marginTop: "20px" }}>
                <button onClick={() => submitSlot(i)} style={submitButtonStyle} disabled={loading}>
                  {loading ? "Submitting..." : "Submit Slot"}
                </button>
                <button onClick={() => skipSlot(i)} style={skipButtonStyle} disabled={loading}>
                  Skip Slot
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Premium Styles
const labelStyle = {
  display: "block",
  color: "#94a3b8",
  marginBottom: "0.4rem",
  fontSize: "0.85rem",
  fontWeight: "600"
};

const inputStyle = {
  width: "100%",
  padding: "0.65rem 1rem",
  background: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(129, 140, 248, 0.3)",
  borderRadius: "0.7rem",
  color: "#e0e7ff",
  fontSize: "0.85rem",
  backdropFilter: "blur(12px)",
  transition: "all 0.3s ease",
  outline: "none"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1rem",
  marginBottom: "1.25rem"
};

const gridStyle4 = {
  ...gridStyle,
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))"
};

const gridStyle2 = {
  ...gridStyle,
  gridTemplateColumns: "1fr 1fr"
};

const submitButtonStyle = {
  padding: "0.7rem 1.5rem",
  background: "linear-gradient(135deg, #10b981, #059669)",
  color: "white",
  border: "none",
  borderRadius: "0.7rem",
  fontWeight: "700",
  fontSize: "0.9rem",
  cursor: "pointer",
  boxShadow: "0 10px 30px rgba(16, 185, 129, 0.3)",
  transition: "all 0.4s ease"
};

const skipButtonStyle = {
  padding: "0.7rem 1.5rem",
  background: "linear-gradient(135deg, #f59e0b, #d97706)",
  color: "white",
  border: "none",
  borderRadius: "0.7rem",
  fontWeight: "700",
  fontSize: "0.9rem",
  cursor: "pointer",
  boxShadow: "0 10px 30px rgba(245, 158, 11, 0.3)",
  transition: "all 0.4s ease"
};