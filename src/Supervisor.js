import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { utils, writeFile } from "xlsx";

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

const LINES = Array.from({ length: 18 }).map(
  (_, i) => `Line-${String(i + 1).padStart(2, "0")}`
);

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
  const [editingId, setEditingId] = useState(null);
  const [tempData, setTempData] = useState({});
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
  }, []);

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
  }, [filters]);

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

  function startEdit(r) {
    setEditingId(r.id);
    setTempData({ ...r });
  }

  function cancelEdit() {
    setEditingId(null);
    setTempData({});
  }

  function updateTemp(field, value) {
    setTempData(prev => ({ ...prev, [field]: value }));
  }

  async function saveEdit() {
    setLoading(true);
    const { error } = await supabase
      .from("production_entries")
      .update({
        customer_name: tempData.customer_name,
        mo_number: tempData.mo_number,
        mo_type: tempData.mo_type,
        ok_qty: Number(tempData.ok_qty || 0),
        nok_qty: Number(tempData.nok_qty || 0),
        downtime: Number(tempData.downtime || 0),
        downtime_detail: tempData.downtime_detail,
        atl: tempData.atl,
        remarks: tempData.remarks
      })
      .eq("id", editingId);

    setLoading(false);
    if (error) {
      showToast("Save failed: " + error.message, "error");
      return;
    }

    showToast("Entry updated successfully!", "success");
    setRows(rows.map(r => (r.id === editingId ? { ...r, ...tempData } : r)));
    setEditingId(null);
    setTempData({});
  }

  return (
    <div style={{ padding: "1rem", maxWidth: "1400px", width: "100%", margin: "0 auto" }}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <style>{globalStyles}</style>

      <h1 style={{
        fontSize: "clamp(1.3rem, 4vw, 1.8rem)",
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
        <button onClick={exportToExcel} style={{
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
          gap: "0.5rem"
        }}>
          📥 Export to Excel
        </button>
      </div>

      {name && (
        <div style={{
          textAlign: "center",
          color: "#a78bfa",
          fontSize: "0.95rem",
          marginBottom: "1.5rem",
          fontWeight: "600"
        }}>
          👤 Logged in as: <span style={{ color: "#e0e7ff", fontWeight: "800" }}>{name}</span>
        </div>
      )}

      {/* FILTERS */}
      <div style={{
        background: "rgba(30, 41, 59, 0.75)",
        backdropFilter: "blur(24px)",
        borderRadius: "1rem",
        padding: "1.25rem",
        border: "1px solid rgba(129, 140, 248, 0.3)",
        boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
        marginBottom: "1.5rem"
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem"
        }}>
          <div>
            <label style={{ display: "block", color: "#94a3b8", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: "600" }}>📅 Review Date</label>
            <input type="date" value={filters.date} onChange={e => setFilters({ ...filters, date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", color: "#94a3b8", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: "600" }}>🔧 Line</label>
            <select value={filters.line} onChange={e => setFilters({ ...filters, line: e.target.value })} style={inputStyle}>
              <option value="">All Lines</option>
              {LINES.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", color: "#94a3b8", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: "600" }}>⏰ Shift</label>
            <select value={filters.shift} onChange={e => setFilters({ ...filters, shift: e.target.value })} style={inputStyle}>
              <option value="">All Shifts</option>
              <option value="A">A Shift</option>
              <option value="B">B Shift</option>
              <option value="C">C Shift</option>
            </select>
          </div>
        </div>
      </div>

      {/* BULK ACTIONS */}
      {rows.length > 0 && (
        <div style={{
          background: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(20px)",
          borderRadius: "1rem",
          padding: "1rem",
          marginBottom: "1.5rem",
          border: "1px solid rgba(129, 140, 248, 0.2)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <button onClick={selectAll} style={{
              padding: "0.55rem 1.2rem",
              background: "rgba(129, 140, 248, 0.15)",
              color: "#818cf8",
              border: "1px solid rgba(129, 140, 248, 0.3)",
              borderRadius: "0.6rem",
              fontWeight: "700",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}>
              {selected.length === rows.length ? "Deselect All" : `Select All (${rows.length})`}
            </button>
            <span style={{ color: "#94a3b8", fontSize: "0.85rem", fontWeight: "600" }}>
              {selected.length} selected
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button onClick={bulkApprove} disabled={selected.length === 0 || loading} style={{
              padding: "0.6rem 1.4rem",
              background: "linear-gradient(135deg, #10b981, #059669)",
              color: "white",
              border: "none",
              borderRadius: "0.7rem",
              fontWeight: "700",
              fontSize: "0.85rem",
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(16, 185, 129, 0.3)"
            }}>
              ✅ Approve ({selected.length})
            </button>
            <button onClick={bulkReject} disabled={selected.length === 0 || loading} style={{
              padding: "0.6rem 1.4rem",
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              color: "white",
              border: "none",
              borderRadius: "0.7rem",
              fontWeight: "700",
              fontSize: "0.85rem",
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(239, 68, 68, 0.3)"
            }}>
              ❌ Reject
            </button>
          </div>
        </div>
      )}

      {/* CONTENT */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem 2rem", color: "#94a3b8", fontSize: "1.2rem", background: "rgba(129, 140, 248, 0.05)", borderRadius: "1.5rem" }}>
          🔄 Loading pending entries...
        </div>
      ) : rows.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "2.5rem 2rem",
          background: "rgba(16, 185, 129, 0.1)",
          borderRadius: "1.25rem",
          border: "2px dashed rgba(16, 185, 129, 0.3)",
          color: "#10b981",
          maxWidth: "500px",
          margin: "0 auto"
        }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎉</div>
          <div style={{ fontSize: "1.5rem", fontWeight: "800", marginBottom: "0.5rem" }}>No Pending Approvals</div>
          <div style={{ fontSize: "1rem", opacity: 0.8 }}>
            Great job! All submitted entries have been reviewed.
          </div>
        </div>
      ) : (
        <div style={{
          background: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(20px)",
          borderRadius: "1.25rem",
          overflow: "hidden",
          border: "1px solid rgba(129, 140, 248, 0.2)",
          boxShadow: "0 25px 70px rgba(0,0,0,0.5)",
          marginBottom: "2rem"
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: "rgba(51, 65, 85, 0.9)" }}>
                  <th style={thStyle}>
                    <input type="checkbox" checked={selected.length === rows.length && rows.length > 0} onChange={selectAll} style={{ cursor: "pointer", width: "18px", height: "18px" }} />
                  </th>
                  <th style={thStyle}>Slot</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>MO Details</th>
                  <th style={thStyle}>OK</th>
                  <th style={thStyle}>NOK</th>
                  <th style={thStyle}>Downtime</th>
                  <th style={thStyle}>Reason</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentRows.map(r => (
                  <tr key={r.id} style={{ background: selected.includes(r.id) ? "rgba(129, 140, 248, 0.15)" : "transparent", borderBottom: "1px solid rgba(129, 140, 248, 0.1)" }}>
                    <td style={tdStyle}>
                      <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSelect(r.id)} style={{ cursor: "pointer", width: "16px", height: "16px" }} />
                    </td>
                    <td style={{ ...tdStyle, color: "#c4b5fd", fontWeight: "700" }}>{r.time_slot}</td>
                    <td style={tdStyle}>
                      {editingId === r.id ? (
                        <input value={tempData.customer_name} onChange={e => updateTemp("customer_name", e.target.value)} style={editInputStyle} />
                      ) : (r.customer_name || "-")}
                    </td>
                    <td style={tdStyle}>
                      {editingId === r.id ? (
                        <div style={{ display: "flex", gap: "4px" }}>
                          <select value={tempData.mo_type} onChange={e => updateTemp("mo_type", e.target.value)} style={{ ...editInputStyle, padding: "4px" }}>
                            <option value="Fresh">F</option>
                            <option value="Rework">R</option>
                          </select>
                          <input value={tempData.mo_number} onChange={e => updateTemp("mo_number", e.target.value)} style={editInputStyle} />
                        </div>
                      ) : (<span>{r.mo_number || "-"} <small style={{ opacity: 0.7 }}>({r.mo_type})</small></span>)}
                    </td>
                    <td style={{ ...tdStyle, color: "#10b981", fontWeight: "700" }}>
                      {editingId === r.id ? (
                        <input type="number" value={tempData.ok_qty} onChange={e => updateTemp("ok_qty", e.target.value)} style={{ ...editInputStyle, width: "60px" }} />
                      ) : (r.ok_qty)}
                    </td>
                    <td style={{ ...tdStyle, color: "#ef4444", fontWeight: "700" }}>
                      {editingId === r.id ? (
                        <input type="number" value={tempData.nok_qty} onChange={e => updateTemp("nok_qty", e.target.value)} style={{ ...editInputStyle, width: "60px" }} />
                      ) : (r.nok_qty)}
                    </td>
                    <td style={tdStyle}>
                      {editingId === r.id ? (
                        <select value={tempData.downtime} onChange={e => updateTemp("downtime", e.target.value)} style={editInputStyle}>
                          {[0, 5, 10, 15, 20, 30, 45, 60].map(v => (<option key={v} value={v}>{v}m</option>))}
                        </select>
                      ) : (<span style={{ color: r.downtime > 30 ? "#ef4444" : "#f59e0b" }}>{r.downtime || 0}m</span>)}
                    </td>
                    <td style={tdStyle}>
                      {editingId === r.id ? (
                        <input value={tempData.downtime_detail} onChange={e => updateTemp("downtime_detail", e.target.value)} style={editInputStyle} />
                      ) : (<span style={{ fontSize: "12px", fontStyle: "italic" }}>{r.downtime_detail || "-"}</span>)}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {editingId === r.id ? (
                          <>
                            <button onClick={saveEdit} disabled={loading} style={{ padding: "4px 10px", background: "#818cf8", color: "white", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>Save</button>
                            <button onClick={cancelEdit} disabled={loading} style={{ padding: "4px 8px", background: "rgba(148, 163, 184, 0.2)", color: "#94a3b8", border: "none", borderRadius: "4px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>X</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => approve(r.id)} disabled={loading} style={actionBtn("#10b981")}>Approve</button>
                            <button onClick={() => startEdit(r)} disabled={loading} style={actionBtn("#60a5fa")}>Edit</button>
                            <button onClick={() => reject(r.id)} disabled={loading} style={actionBtn("#ef4444")}>Reject</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginTop: "20px", padding: "20px" }}>
          <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} style={{ padding: "8px 16px", background: "rgba(15, 23, 42, 0.5)", color: currentPage === 1 ? "#475569" : "#e0e7ff", border: "1px solid rgba(129, 140, 248, 0.2)", borderRadius: "10px", cursor: currentPage === 1 ? "default" : "pointer" }}>
            Previous
          </button>
          <div style={{ color: "#94a3b8", fontWeight: "600", fontSize: "14px" }}>
            Page <span style={{ color: "#c4b5fd" }}>{currentPage}</span> of {totalPages}
          </div>
          <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} style={{ padding: "8px 16px", background: "rgba(15, 23, 42, 0.5)", color: currentPage === totalPages ? "#475569" : "#e0e7ff", border: "1px solid rgba(129, 140, 248, 0.2)", borderRadius: "10px", cursor: currentPage === totalPages ? "default" : "pointer" }}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "0.65rem 0.9rem",
  background: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(129, 140, 248, 0.4)",
  borderRadius: "0.7rem",
  color: "#e0e7ff",
  fontSize: "0.9rem",
  backdropFilter: "blur(12px)"
};

const editInputStyle = {
  width: "100%",
  padding: "6px 10px",
  background: "rgba(15, 23, 42, 0.8)",
  border: "1px solid #818cf8",
  borderRadius: "6px",
  color: "white",
  fontSize: "14px",
  outline: "none"
};

const thStyle = {
  padding: "1rem",
  textAlign: "left",
  color: "#c4b5fd",
  fontWeight: "800",
  fontSize: "0.85rem",
  borderBottom: "2px solid rgba(129, 140, 248, 0.3)"
};

const tdStyle = {
  padding: "0.8rem 1rem",
  color: "#e0e7ff",
  fontSize: "0.85rem"
};

const actionBtn = (color) => ({
  padding: "6px 12px",
  background: `${color}15`,
  color: color,
  border: `1px solid ${color}40`,
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: "12px"
});