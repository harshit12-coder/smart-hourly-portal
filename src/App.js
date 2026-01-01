// App.js - FULL PREMIUM PRODUCTION ENTRY PAGE
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { login, getClients, getMeterReportsByClient } from "./api.js"; // ← Updated import: getClients

const globalStyles = `
  @keyframes reveal {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;

// Toast Component
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

function getCurrentShiftAndTime() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMins = h * 60 + m;

  const dateStr = now.toLocaleDateString("en-CA");

  let shift = "";
  if (totalMins >= 420 && totalMins < 930) shift = "A";
  else if (totalMins >= 930 || totalMins < 0) shift = "B";
  else shift = "C";

  return { date: dateStr, shift, now };
}

const LINES = Array.from({ length: 18 }).map(
  (_, i) => `Line-${String(i + 1).padStart(2, "0")}`
);

export default function App() {
  const [header, setHeader] = useState(() => {
    const { date, shift } = getCurrentShiftAndTime();
    return { date, shift, line: "" };
  });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [authToken, setAuthToken] = useState(null);
  const [userId, setUserId] = useState(null);

  function updateHeader(e) {
    setHeader({ ...header, [e.target.name]: e.target.value });
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  // Login + Customers load (public /api/clients se)
  useEffect(() => {
    async function fetchCustomers() {
      try {
        setLoading(true);
        // console.log("Attempting login...");

        const loginData = await login("aditya.yadav@kimbal.io", "Aditya0!");

        // console.log("Login response:", loginData);

        const token = loginData.result?.accessToken || loginData.accessToken || loginData.token;
        const id = loginData.result?.userId || loginData.userId || loginData.id;

        if (!token) {
          showToast("Login failed: No token received", "error");
          return;
        }

        localStorage.setItem('authToken', token);
        setAuthToken(token);
        setUserId(id);

        showToast("Login successful!", "success");

        // ← Yeh change: getClients use kar rahe hain (public API)
        const clientsData = await getClients();

        // console.log("Clients data:", clientsData);

        let rawClients = [];
        if (Array.isArray(clientsData)) rawClients = clientsData;
        else if (clientsData.result && Array.isArray(clientsData.result)) rawClients = clientsData.result;
        else if (clientsData.result && Array.isArray(clientsData.result.items)) rawClients = clientsData.result.items;
        else if (clientsData.data && Array.isArray(clientsData.data)) rawClients = clientsData.data;

        const normalized = rawClients.map(c => ({
          id: c.id ?? c.clientId ?? c.ClientId ?? null,
          client_Name: c.client_Name ?? c.clientName ?? c.name ?? c.displayName ?? "Unknown",
          raw: c
        }));

        setCustomers(normalized);
        showToast(`Loaded ${normalized.length} customers`, "success");

      } catch (error) {
        console.error("Error:", error);
        showToast("Failed to load data: " + error.message, "error");
      } finally {
        setLoading(false);
      }
    }

    fetchCustomers();
  }, []);

  // MO numbers fetch (proxy se - agar yeh bhi fail ho toh baad mein fallback denge)
  async function fetchMONumbers(customerId, rowIndex) {
    if (!customerId) return;

    try {
      // console.log(`Fetching MO numbers for client: ${customerId}`);
      
      const moData = await getMeterReportsByClient(customerId);

      let moNumbers = [];
      if (Array.isArray(moData)) moNumbers = moData;
      else if (moData.result) moNumbers = moData.result;
      else if (moData.data) moNumbers = moData.data;

      const copy = [...rows];
      copy[rowIndex].moNumbers = moNumbers;
      setRows(copy);

      if (moNumbers.length === 0) {
        showToast("No MO numbers found", "error");
      } else {
        showToast(`Loaded ${moNumbers.length} MO numbers`, "success");
      }
    } catch (error) {
      console.error("MO fetch error:", error);
      showToast("Failed to load MO numbers", "error");

      const copy = [...rows];
      copy[rowIndex].moNumbers = [];
      setRows(copy);
    }
  }

  // Baaki sab code same rahega (loadSlots, submitSlot, UI etc.)
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
    const { now } = getCurrentShiftAndTime();

    const filteredSlots = allSlots
      .filter(s => !done.includes(s))
      .filter(s => {
        const [startStr, endStr] = s.split("-");
        const [sh, sm] = startStr.split(":").map(Number);
        const [eh, em] = endStr.split(":").map(Number);

        const start = new Date(now);
        start.setHours(sh, sm, 0, 0);
        const end = new Date(now);
        end.setHours(eh, em, 0, 0);

        if (end < start) end.setDate(end.getDate() + 1);

        return now >= start && now < end;
      });

    setRows(
      filteredSlots.map(s => ({
        time_slot: s,
        meter_from: "",
        meter_to: "",
        ok_qty: "",
        nok_qty: "",
        customer_name: "",
        customer_id: "",
        mo_type: "",
        mo_number: "",
        moNumbers: [],
        downtime: 0,
        downtime_detail: "No downtime",
        downtime_issue: "",
        other_reason: "",
        atl: "",
        reason: "",
        remarks: ""
      }))
    );
    setLoading(false);
  }, [header]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  function updateRow(i, field, value) {
    const copy = [...rows];
    copy[i][field] = value;
    setRows(copy);
  }

  async function submitSlot(i) {
    const r = rows[i];

    if (!r.customer_name) return showToast("Customer Name is required", "error");
    if (!r.mo_type) return showToast("Please select MO Type", "error");
    if (!r.mo_number) return showToast("MO Number is required", "error");
    if (r.downtime > 0) {
      if (!r.downtime_issue) return showToast("Please select Downtime Issue", "error");
      if (r.downtime_issue === "others" && !r.other_reason.trim()) return showToast("Enter custom downtime reason", "error");
    }

    const finalDowntimeDetail = r.downtime === 0 ? "No downtime" : (r.downtime_issue === "others" ? r.other_reason.trim() : r.downtime_issue);

    const payload = {
      ...r,
      ...header,
      operator_status: "submitted",
      approver_status: "pending",
      skip_reason: null,
      ok_qty: Number(r.ok_qty || 0),
      nok_qty: Number(r.nok_qty || 0),
      downtime: Number(r.downtime || 0),
      downtime_detail: finalDowntimeDetail
    };
    delete payload.downtime_issue;
    delete payload.other_reason;

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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <style>{globalStyles}</style>

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

      {loading && (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8", fontSize: "20px" }}>
          🔄 Loading...
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

              <div style={gridStyle}>
                <select
                  value={r.customer_id ? String(r.customer_id) : ""}
                  onChange={e => {
                    const val = e.target.value;
                    const selectedCustomer = customers.find(c => String(c.id) === String(val));
                    const resolvedName = selectedCustomer?.client_Name || "";
                    const resolvedId = selectedCustomer?.id || null;

                    updateRow(i, "customer_name", resolvedName);
                    updateRow(i, "customer_id", resolvedId);

                    if (resolvedId) {
                      fetchMONumbers(resolvedId, i);
                    }
                  }}
                  style={inputStyle}
                >
                  <option value="">Select Customer *</option>
                  {customers.map((customer, idx) => (
                    <option key={idx} value={String(customer.id ?? "")}>{customer.client_Name || String(customer.id)}</option>
                  ))}
                </select>
                <select value={r.mo_type} onChange={e => { updateRow(i, "mo_type", e.target.value); updateRow(i, "mo_number", ""); }} style={inputStyle}>
                  <option value="">Select MO Type *</option>
                  <option value="Fresh">Fresh MO</option>
                  <option value="Rework">Rework MO</option>
                </select>
                {r.mo_type === "Fresh" ? (
                  (r.moNumbers && r.moNumbers.length > 0) ? (
                    <select
                      value={r.mo_number}
                      onChange={e => updateRow(i, "mo_number", e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Select MO Number *</option>
                      {r.moNumbers.map((mo, idx) => (
                        <option key={idx} value={mo.mo_Number || mo.moNumber || mo.number || mo}>
                          {mo.mo_Number || mo.moNumber || mo.number || mo}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <input
                        placeholder="No MO list available — enter MO Number manually *"
                        value={r.mo_number}
                        onChange={e => updateRow(i, "mo_number", e.target.value)}
                        style={inputStyle}
                      />
                      <div style={{ fontSize: "12px", color: "#94a3b8" }}>No MO list returned — enter manually</div>
                    </div>
                  )
                ) : (
                  <input
                    placeholder="Enter Rework MO Number *"
                    value={r.mo_number}
                    onChange={e => updateRow(i, "mo_number", e.target.value)}
                    style={inputStyle}
                  />
                )}
              </div>

              <div style={gridStyle4}>
                <input placeholder="From Meter" value={r.meter_from} onChange={e => updateRow(i, "meter_from", e.target.value)} style={inputStyle} />
                <input placeholder="To Meter" value={r.meter_to} onChange={e => updateRow(i, "meter_to", e.target.value)} style={inputStyle} />
                <input type="number" placeholder="OK Qty" value={r.ok_qty} onChange={e => updateRow(i, "ok_qty", e.target.value)} style={inputStyle} />
                <input type="number" placeholder="NOK Qty" value={r.nok_qty} onChange={e => updateRow(i, "nok_qty", e.target.value)} style={inputStyle} />
              </div>

              <div style={gridStyle}>
                <select value={r.downtime} onChange={e => { const v = Number(e.target.value); updateRow(i, "downtime", v); if (v === 0) { updateRow(i, "downtime_issue", ""); updateRow(i, "other_reason", ""); } }} style={inputStyle}>
                  <option value={0}>No Downtime</option>
                  <option value={5}>5 min</option>
                  <option value={10}>10 min</option>
                  <option value={15}>15 min</option>
                  <option value={20}>20 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                  <option value={60}>60 min</option>
                </select>

                <select
                  value={r.downtime_issue}
                  disabled={r.downtime === 0}
                  onChange={e => updateRow(i, "downtime_issue", e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select Issue *</option>
                  <option value="MES Issue">MES Issue</option>
                  <option value="SPM Issue">SPM Issue</option>
                  <option value="Maintenance Issue">Maintenance Issue</option>
                  <option value="others">others</option>
                </select>

                {r.downtime_issue === "others" && (
                  <input
                    placeholder="Fill Reason *"
                    value={r.other_reason}
                    onChange={e => updateRow(i, "other_reason", e.target.value)}
                    style={inputStyle}
                  />
                )}
                <input placeholder="ATL" value={r.atl} onChange={e => updateRow(i, "atl", e.target.value)} style={inputStyle} />
              </div>

              <div style={gridStyle2}>
                <input placeholder="Reason (if any)" value={r.reason} onChange={e => updateRow(i, "reason", e.target.value)} style={inputStyle} />
                <input placeholder="Remarks" value={r.remarks} onChange={e => updateRow(i, "remarks", e.target.value)} style={inputStyle} />
              </div>

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
    </div>
  );
}

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