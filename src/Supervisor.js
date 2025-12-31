import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { utils, writeFile } from "xlsx";

const globalStyles = `
  @keyframes reveal {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

const LINES = Array.from({ length: 18 }).map(
  (_, i) => `Line-${String(i + 1).padStart(2, "0")}`
);

// Toast Component (same as App.js)
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
      padding: "16px 28px",
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

export default function Supervisor() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [filters, setFilters] = useState({
    date: new Date().toISOString().substring(0, 10),
    line: "",
    shift: ""
  });
  const [selected, setSelected] = useState([]);
  const [toast, setToast] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  const loadUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;

    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", user.id)
      .single();

    if (profile?.name) setName(profile.name);
  }, [supabase]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("production_entries")
      .select("*")
      .eq("date", filters.date)
      .eq("approver_status", "pending")
      .eq("operator_status", "submitted")
      .order("time_slot");

    if (filters.line) q = q.eq("line", filters.line);
    if (filters.shift) q = q.eq("shift", filters.shift);

    const { data, error } = await q;
    setLoading(false);

    if (error) {
      showToast("Error loading entries: " + error.message, "error");
      return;
    }

    setRows(data || []);
    setSelected([]);
  }, [filters, supabase]);

  const exportToExcel = () => {
    if (rows.length === 0) return alert("No pending entries to export");

    const dataToExport = rows.map(e => ({
      "Date": e.date,
      "Shift": e.shift,
      "Line": e.line,
      "Time Slot": e.time_slot,
      "Customer": e.customer_name,
      "MO Type": e.mo_type,
      "MO Number": e.mo_number,
      "OK Qty": e.ok_qty || 0,
      "NOK Qty": e.nok_qty || 0,
      "Downtime (min)": e.downtime || 0,
      "Downtime Detail": e.downtime_detail,
      "ATL": e.atl,
      "Remarks": e.remarks
    }));

    const worksheet = utils.json_to_sheet(dataToExport);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "Pending Entries");
    writeFile(workbook, `SmartHourly_Pending_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  useEffect(() => {
    load();
  }, [load]);

  function toggleSelect(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // Pagination Logic
  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const currentRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function selectAll() {
    if (selected.length === rows.length) {
      setSelected([]);
    } else {
      setSelected(rows.map(r => r.id));
    }
  }

  async function approve(id) {
    setLoading(true);
    const { error } = await supabase
      .from("production_entries")
      .update({
        approver_status: "approved",
        approved: true,
        rejected: false,
        approved_by: name || "Supervisor"
      })
      .eq("id", id);

    setLoading(false);
    if (error) {
      showToast("Approve failed: " + error.message, "error");
      return;
    }

    showToast("Entry approved successfully!", "success");
    setRows(rows.filter(r => r.id !== id));
    setSelected(selected.filter(s => s !== id));
  }

  async function reject(id) {
    const reason = prompt("Reason for rejection?");
    if (!reason?.trim()) {
      showToast("Rejection cancelled - reason required", "error");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("production_entries")
      .update({
        approver_status: "rejected",
        approved: false,
        rejected: true,
        rejection_note: reason.trim()
      })
      .eq("id", id);

    setLoading(false);
    if (error) {
      showToast("Reject failed: " + error.message, "error");
      return;
    }

    showToast("Entry rejected", "success");
    setRows(rows.filter(r => r.id !== id));
    setSelected(selected.filter(s => s !== id));
  }

  async function bulkApprove() {
    if (selected.length === 0) return showToast("No entries selected", "error");

    setLoading(true);
    const { error } = await supabase
      .from("production_entries")
      .update({
        approver_status: "approved",
        approved: true,
        rejected: false,
        approved_by: name || "Supervisor"
      })
      .in("id", selected);

    setLoading(false);
    if (error) {
      showToast("Bulk approve failed: " + error.message, "error");
      return;
    }

    showToast(`${selected.length} entries approved!`, "success");
    setRows(rows.filter(r => !selected.includes(r.id)));
    setSelected([]);
  }

  async function bulkReject() {
    if (selected.length === 0) return showToast("No entries selected", "error");

    const reason = prompt(`Reason for rejecting ${selected.length} entries?`);
    if (!reason?.trim()) {
      showToast("Bulk reject cancelled", "error");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("production_entries")
      .update({
        approver_status: "rejected",
        approved: false,
        rejected: true,
        rejection_note: reason.trim()
      })
      .in("id", selected);

    setLoading(false);
    if (error) {
      showToast("Bulk reject failed: " + error.message, "error");
      return;
    }

    showToast(`${selected.length} entries rejected`, "success");
    setRows(rows.filter(r => !selected.includes(r.id)));
    setSelected([]);
  }

  return (
    <div style={{ padding: "1.5rem 1rem", maxWidth: "1400px", width: "98%", margin: "0 auto" }}>
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <style>{globalStyles}</style>

      <h1 style={{
        fontSize: "clamp(1.5rem, 4vw, 1.8rem)",
        fontWeight: "900",
        textAlign: "center",
        marginBottom: "1rem",
        background: "linear-gradient(90deg, #c4b5fd, #818cf8, #60a5fa)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        textShadow: "0 0 25px rgba(196, 181, 253, 0.4)",
        animation: "reveal 0.8s ease both"
      }}>
        SmartHourly Review Panel
      </h1>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
        <button
          onClick={exportToExcel}
          style={{
            padding: "0.6rem 1.2rem",
            background: "rgba(129, 140, 248, 0.1)",
            color: "#c4b5fd",
            border: "1px solid rgba(129, 140, 248, 0.2)",
            borderRadius: "0.7rem",
            fontWeight: "700",
            fontSize: "0.85rem",
            cursor: "pointer",
            backdropFilter: "blur(10px)",
            transition: "all 0.4s ease",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            animation: "reveal 0.8s ease both",
            animationDelay: "0.05s"
          }}
          onMouseEnter={e => {
            e.target.style.background = "rgba(129, 140, 248, 0.2)";
            e.target.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={e => {
            e.target.style.background = "rgba(129, 140, 248, 0.1)";
            e.target.style.transform = "translateY(0)";
          }}
        >
          📥 Export Pending to Excel
        </button>
      </div>

      {name && (
        <div style={{
          textAlign: "center",
          color: "#a78bfa",
          fontSize: "16px",
          marginBottom: "30px",
          fontWeight: "600"
        }}>
          👤 Logged in as: <span style={{ color: "#e0e7ff", fontWeight: "800" }}>{name}</span>
        </div>
      )}

      {/* FILTERS CARD */}
      <div style={{ ...filterCardStyle, animation: "reveal 0.8s ease both", animationDelay: "0.1s" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px"
        }}>
          <div>
            <label style={labelStyle}>📅 Review Date</label>
            <input type="date" value={filters.date} onChange={e => setFilters({ ...filters, date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>🔧 Line</label>
            <select value={filters.line} onChange={e => setFilters({ ...filters, line: e.target.value })} style={inputStyle}>
              <option value="">All Lines</option>
              {LINES.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>⏰ Shift</label>
            <select value={filters.shift} onChange={e => setFilters({ ...filters, shift: e.target.value })} style={inputStyle}>
              <option value="">All Shifts</option>
              <option value="A">A Shift</option>
              <option value="B">B Shift</option>
              <option value="C">C Shift</option>
            </select>
          </div>
        </div>
      </div>

      {/* BULK ACTIONS BAR */}
      {rows.length > 0 && (
        <div style={{
          background: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(20px)",
          borderRadius: "24px",
          padding: "30px",
          marginBottom: "40px",
          border: "1px solid rgba(129, 140, 248, 0.2)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <button onClick={selectAll} style={secondaryButtonStyle}>
              {selected.length === rows.length ? "Deselect All" : "Select All"} ({rows.length})
            </button>
            <span style={{ color: "#94a3b8", fontSize: "18px" }}>
              {selected.length} selected
            </span>
          </div>

          <div style={{ display: "flex", gap: "20px" }}>
            <button onClick={bulkApprove} disabled={selected.length === 0 || loading} style={bulkApproveStyle}>
              ✅ Bulk Approve ({selected.length})
            </button>
            <button onClick={bulkReject} disabled={selected.length === 0 || loading} style={bulkRejectStyle}>
              ❌ Bulk Reject
            </button>
          </div>
        </div>
      )}

      {/* CONTENT */}
      {loading ? (
        <div style={loadingStateStyle}>🔄 Loading pending entries...</div>
      ) : rows.length === 0 ? (
        <div style={emptyStateStyle}>
          <div style={{ fontSize: "80px", marginBottom: "30px" }}>🎉</div>
          <div style={{ fontSize: "32px", fontWeight: "800" }}>No Pending Approvals</div>
          <div style={{ fontSize: "20px", opacity: 0.8, marginTop: "20px" }}>
            Great job! All submitted entries have been reviewed.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {currentRows.map(r => (
            <div
              key={r.id}
              style={{
                background: selected.includes(r.id)
                  ? "rgba(129, 140, 248, 0.15)"
                  : "rgba(30, 41, 59, 0.85)",
                backdropFilter: "blur(20px)",
                borderRadius: "20px",
                padding: "20px",
                border: selected.includes(r.id)
                  ? "2px solid #818cf8"
                  : "1px solid rgba(129, 140, 248, 0.2)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                transition: "all 0.4s ease"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    style={{ width: "20px", height: "20px", accentColor: "#60a5fa", cursor: "pointer" }}
                  />
                  <h3 style={{
                    color: "#c4b5fd",
                    fontSize: "20px",
                    fontWeight: "800",
                    textShadow: "0 0 15px rgba(196, 181, 253, 0.3)"
                  }}>
                    {r.date} — {r.line} — {r.time_slot}
                  </h3>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "30px", marginBottom: "40px" }}>
                <div style={infoCardStyle}>
                  <div style={{ color: "#94a3b8", fontSize: "16px", marginBottom: "8px" }}>Customer</div>
                  <div style={{ color: "#e0e7ff", fontSize: "20px", fontWeight: "700" }}>{r.customer_name || "-"}</div>
                </div>
                <div style={infoCardStyle}>
                  <div style={{ color: "#94a3b8", fontSize: "16px", marginBottom: "8px" }}>MO Details</div>
                  <div style={{ color: "#e0e7ff", fontSize: "20px", fontWeight: "700" }}>
                    {r.mo_number || "-"} <span style={{ opacity: 0.7, fontSize: "16px" }}>({r.mo_type})</span>
                  </div>
                </div>
                <div style={infoCardStyle}>
                  <div style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "6px" }}>OK Quantity</div>
                  <div style={{ color: "#10b981", fontSize: "24px", fontWeight: "900" }}>{r.ok_qty}</div>
                </div>
                <div style={infoCardStyle}>
                  <div style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "6px" }}>NOK Quantity</div>
                  <div style={{ color: "#ef4444", fontSize: "24px", fontWeight: "900" }}>{r.nok_qty}</div>
                </div>
                <div style={infoCardStyle}>
                  <div style={{ color: "#94a3b8", fontSize: "16px", marginBottom: "8px" }}>Downtime</div>
                  <div style={{ color: r.downtime > 30 ? "#ef4444" : "#f59e0b", fontSize: "24px", fontWeight: "700" }}>
                    {r.downtime || 0} min
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "30px" }}>
                <button onClick={() => approve(r.id)} disabled={loading} style={approveButtonStyle}>
                  {loading ? "Processing..." : "✅ Approve Entry"}
                </button>
                <button onClick={() => reject(r.id)} disabled={loading} style={rejectButtonStyle}>
                  ❌ Reject Entry
                </button>
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "12px",
              marginTop: "20px",
              padding: "20px"
            }}>
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  padding: "8px 16px",
                  background: "rgba(15, 23, 42, 0.5)",
                  color: currentPage === 1 ? "#475569" : "#e0e7ff",
                  border: "1px solid rgba(129, 140, 248, 0.2)",
                  borderRadius: "10px",
                  cursor: currentPage === 1 ? "default" : "pointer"
                }}
              >
                Previous
              </button>

              <div style={{ color: "#94a3b8", fontWeight: "600", fontSize: "14px" }}>
                Page <span style={{ color: "#c4b5fd" }}>{currentPage}</span> of {totalPages}
              </div>

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  padding: "8px 16px",
                  background: "rgba(15, 23, 42, 0.5)",
                  color: currentPage === totalPages ? "#475569" : "#e0e7ff",
                  border: "1px solid rgba(129, 140, 248, 0.2)",
                  borderRadius: "10px",
                  cursor: currentPage === totalPages ? "default" : "pointer"
                }}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Animation */}
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
const filterCardStyle = {
  background: "rgba(30, 41, 59, 0.75)",
  backdropFilter: "blur(24px)",
  borderRadius: "1.25rem",
  padding: "1.5rem",
  border: "1px solid rgba(129, 140, 248, 0.3)",
  boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
  marginBottom: "2rem"
};

const labelStyle = {
  display: "block",
  color: "#94a3b8",
  marginBottom: "0.5rem",
  fontSize: "0.85rem",
  fontWeight: "600"
};

const inputStyle = {
  width: "100%",
  padding: "0.75rem 1rem",
  background: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(129, 140, 248, 0.4)",
  borderRadius: "0.75rem",
  color: "#e0e7ff",
  fontSize: "0.9rem",
  backdropFilter: "blur(12px)",
  transition: "all 0.3s ease"
};

const infoCardStyle = {
  padding: "1.5rem",
  background: "rgba(51, 65, 85, 0.5)",
  borderRadius: "1.25rem",
  border: "1px solid rgba(129, 140, 248, 0.2)",
  backdropFilter: "blur(12px)"
};

const approveButtonStyle = {
  padding: "0.85rem 2rem",
  background: "linear-gradient(135deg, #10b981, #059669)",
  color: "white",
  border: "none",
  borderRadius: "0.75rem",
  fontWeight: "800",
  fontSize: "1rem",
  cursor: "pointer",
  boxShadow: "0 15px 40px rgba(16, 185, 129, 0.4)",
  transition: "all 0.4s ease"
};

const rejectButtonStyle = {
  padding: "0.85rem 2rem",
  background: "linear-gradient(135deg, #ef4444, #dc2626)",
  color: "white",
  border: "none",
  borderRadius: "0.75rem",
  fontWeight: "800",
  fontSize: "1rem",
  cursor: "pointer",
  boxShadow: "0 15px 40px rgba(239, 68, 68, 0.4)",
  transition: "all 0.4s ease"
};

const bulkApproveStyle = {
  padding: "1rem 2.5rem",
  background: "linear-gradient(135deg, #10b981, #059669)",
  color: "white",
  border: "none",
  borderRadius: "1rem",
  fontWeight: "800",
  fontSize: "1.05rem",
  cursor: "pointer",
  boxShadow: "0 10px 30px rgba(16, 185, 129, 0.4)"
};

const bulkRejectStyle = {
  padding: "1rem 2.5rem",
  background: "linear-gradient(135deg, #ef4444, #dc2626)",
  color: "white",
  border: "none",
  borderRadius: "1rem",
  fontWeight: "800",
  fontSize: "1.05rem",
  cursor: "pointer",
  boxShadow: "0 10px 30px rgba(239, 68, 68, 0.4)"
};

const secondaryButtonStyle = {
  padding: "0.8rem 2rem",
  background: "rgba(129, 140, 248, 0.2)",
  color: "#818cf8",
  border: "1px solid rgba(129, 140, 248, 0.4)",
  borderRadius: "0.8rem",
  fontWeight: "700",
  fontSize: "0.95rem",
  cursor: "pointer",
  transition: "all 0.3s ease"
};

const loadingStateStyle = {
  textAlign: "center",
  padding: "6rem 2rem",
  color: "#94a3b8",
  fontSize: "1.5rem",
  background: "rgba(129, 140, 248, 0.05)",
  borderRadius: "2rem"
};

const emptyStateStyle = {
  textAlign: "center",
  padding: "8rem 2rem",
  background: "rgba(16, 185, 129, 0.15)",
  borderRadius: "2rem",
  border: "2px dashed rgba(16, 185, 129, 0.4)",
  color: "#10b981"
};