// Supervisor.js - COMPLETE UPDATED & FINAL VERSION (Bulk Buttons Fixed + Screenshot Match)
import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { utils, writeFile } from "xlsx";

const LINES = Array.from({ length: 18 }).map(
  (_, i) => `Line-${String(i + 1).padStart(2, "0")}`
);

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="toast">
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
  const rowsPerPage = 8;

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
    writeFile(workbook, `SmartHourly_Pending_${filters.date}.xlsx`);
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

    showToast("Entry approved!", "success");
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

    showToast("Entry updated!", "success");
    setRows(rows.map(r => (r.id === editingId ? { ...r, ...tempData } : r)));
    setEditingId(null);
    setTempData({});
  }

  return (
    <div className="supervisor-container">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <h1 className="page-title">SmartHourly Review Panel</h1>

      {name && (
        <div className="user-info">
          👤 Logged in as: <strong>{name}</strong>
        </div>
      )}

      <button onClick={exportToExcel} className="export-btn">
        📥 Export Pending to Excel
      </button>

      {/* FILTERS CARD */}
      <div className="filters-card">
        <div className="filters-grid">
          <div className="input-group">
            <label>📅 Review Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={e => setFilters({ ...filters, date: e.target.value })}
              className="app-input"
            />
          </div>
          <div className="input-group">
            <label>🔧 Line</label>
            <select
              value={filters.line}
              onChange={e => setFilters({ ...filters, line: e.target.value })}
              className="app-input"
            >
              <option value="">All Lines</option>
              {LINES.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>⏰ Shift</label>
            <select
              value={filters.shift}
              onChange={e => setFilters({ ...filters, shift: e.target.value })}
              className="app-input"
            >
              <option value="">All Shifts</option>
              <option value="A">A Shift</option>
              <option value="B">B Shift</option>
              <option value="C">C Shift</option>
            </select>
          </div>
        </div>
      </div>

      {/* BULK ACTIONS - PERFECTLY MATCHES YOUR SCREENSHOT */}
      {rows.length > 0 && (
        <div className="bulk-actions">
          <div className="selection-info">
            <button onClick={selectAll} className="select-all-btn">
              {selected.length === rows.length ? "Deselect All" : `Select All (${rows.length})`}
            </button>
            <span className="selected-count">{selected.length} selected</span>
          </div>

          <div className="bulk-buttons">
            <button
              onClick={bulkApprove}
              disabled={selected.length === 0 || loading}
              className="bulk-approve"
            >
               Approve ({selected.length || 0})
            </button>
            <button
              onClick={bulkReject}
              disabled={selected.length === 0 || loading}
              className="bulk-reject"
            >
               Reject ({selected.length || 0})
            </button>
          </div>
        </div>
      )}

      {/* ENTRIES LIST */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading pending entries...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="celebration">🎉</div>
          <h3>No Pending Approvals</h3>
          <p>Great job! All entries have been reviewed.</p>
        </div>
      ) : (
        <>
          <div className="entries-list">
            {currentRows.map(r => (
              <div key={r.id} className={`entry-card ${selected.includes(r.id) ? "selected" : ""}`}>
                <div className="card-header">
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    className="checkbox"
                  />
                  <div className="slot-time">⏰ {r.time_slot}</div>
                </div>

                <div className="card-grid">
                  <div className="field">
                    <label>Customer</label>
                    {editingId === r.id ? (
                      <input
                        value={tempData.customer_name || ""}
                        onChange={e => updateTemp("customer_name", e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      <span className="value">{r.customer_name || "-"}</span>
                    )}
                  </div>

                                    <div className="field">
                    <label>MO Details</label>
                    {editingId === r.id ? (
                      <div className="mo-edit">
                        <select
                          value={tempData.mo_type || ""}
                          onChange={e => updateTemp("mo_type", e.target.value)}
                          className="edit-input small"
                        >
                          <option value="Fresh">Fresh</option>
                          <option value="Rework">Rework</option>
                        </select>
                        <input
                          value={tempData.mo_number || ""}
                          onChange={e => updateTemp("mo_number", e.target.value)}
                          className="edit-input"
                          placeholder="Enter MO"
                        />
                      </div>
                    ) : r.mo_type === "Fresh" && Array.isArray(r.moNumbers) && r.moNumbers.length > 0 ? (
                      <select
                        value={r.mo_number || ""}
                        onChange={e => {
                          // Supervisor mein rows update karne ka direct function nahi hai card view mein
                          // Isliye temp state use kar ke row update karenge
                          const updatedRows = rows.map(row => 
                            row.id === r.id ? { ...row, mo_number: e.target.value } : row
                          );
                          setRows(updatedRows);
                        }}
                        className="app-input"
                      >
                        <option value="">Select MO</option>
                        {r.moNumbers.map((mo, k) => {
                          const value = mo.mo_Number || mo.moNumber || mo.number || mo.id || "";
                          const display = mo.mo_Number || mo.moNumber || mo.number || `MO ${k + 1}`;
                          return (
                            <option key={k} value={value}>
                              {display}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <span className="value">
                        {r.mo_number || "-"} <small>({r.mo_type || "-"})</small>
                      </span>
                    )}
                  </div>

                  <div className="field highlight ok">
                    <label>OK Qty</label>
                    {editingId === r.id ? (
                      <input
                        type="number"
                        value={tempData.ok_qty || ""}
                        onChange={e => updateTemp("ok_qty", e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      <span className="value big">{r.ok_qty || 0}</span>
                    )}
                  </div>

                  <div className="field highlight nok">
                    <label>NOK Qty</label>
                    {editingId === r.id ? (
                      <input
                        type="number"
                        value={tempData.nok_qty || ""}
                        onChange={e => updateTemp("nok_qty", e.target.value)}
                        className="edit-input"
                      />
                    ) : (
                      <span className="value big">{r.nok_qty || 0}</span>
                    )}
                  </div>

                  <div className="field">
                    <label>Downtime</label>
                    {editingId === r.id ? (
                      <select
                        value={tempData.downtime || 0}
                        onChange={e => updateTemp("downtime", e.target.value)}
                        className="edit-input"
                      >
                        {[0, 5, 10, 15, 20, 30, 45, 60].map(v => (
                          <option key={v} value={v}>{v} min</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`value ${r.downtime > 30 ? "high" : r.downtime > 0 ? "medium" : ""}`}>
                        {r.downtime || 0} min
                      </span>
                    )}
                  </div>

                  <div className="field full">
                    <label>Downtime Reason</label>
                    {editingId === r.id ? (
                      <input
                        value={tempData.downtime_detail || ""}
                        onChange={e => updateTemp("downtime_detail", e.target.value)}
                        className="edit-input"
                        placeholder="Enter reason"
                      />
                    ) : (
                      <span className="value italic">{r.downtime_detail || "No downtime"}</span>
                    )}
                  </div>
                </div>

                <div className="card-actions">
                  {editingId === r.id ? (
                    <>
                      <button onClick={saveEdit} disabled={loading} className="action-btn save">
                        Save
                      </button>
                      <button onClick={cancelEdit} disabled={loading} className="action-btn cancel">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => approve(r.id)} disabled={loading} className="action-btn approve">
                        Approve
                      </button>
                      <button onClick={() => startEdit(r)} disabled={loading} className="action-btn edit">
                        Edit
                      </button>
                      <button onClick={() => reject(r.id)} disabled={loading} className="action-btn reject">
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="page-btn">
                Previous
              </button>
              <span className="page-info">
                Page <strong>{currentPage}</strong> of {totalPages}
              </span>
              <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="page-btn">
                Next
              </button>
            </div>
          )}
        </>
      )}

      <style jsx>{globalStyles}</style>
    </div>
  );
}

const globalStyles = `
  :root {
    --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    --glass-bg: rgba(30, 41, 59, 0.85);
    --glass-border: rgba(129, 140, 248, 0.25);
    --input-bg: rgba(15, 23, 42, 0.9);
    --input-border: rgba(129, 140, 248, 0.3);
    --text-primary: #e0e7ff;
    --text-secondary: #94a3b8;
    --accent: #818cf8;
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  .supervisor-container {
    min-height: 100vh;
    width: 100vw;
    background: 
      radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.25), transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(120, 219, 255, 0.25), transparent 50%),
      var(--bg-gradient);
    padding: clamp(16px, 4vw, 32px);
    color: var(--text-primary);
    font-family: system-ui, -apple-system, sans-serif;
  }

  .page-title {
    text-align: center;
    font-size: clamp(1.8rem, 5vw, 2.2rem);
    font-weight: 900;
    margin: 0 0 20px;
    background: linear-gradient(90deg, #c7d2fe, #818cf8, #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .user-info {
    text-align: center;
    color: #a78bfa;
    font-size: clamp(0.95rem, 3vw, 1.1rem);
    margin-bottom: 24px;
    font-weight: 600;
  }

  .user-info strong {
    color: var(--text-primary);
    font-weight: 800;
  }

  .export-btn {
    display: block;
    width: fit-content;
    margin: 0 auto 28px;
    padding: clamp(12px, 3vw, 16px) clamp(20px, 5vw, 32px);
    background: rgba(129, 140, 248, 0.15);
    color: #c4b5fd;
    border: 1.5px solid rgba(129, 140, 248, 0.3);
    border-radius: 20px;
    font-weight: 700;
    font-size: clamp(15px, 3.5vw, 17px);
    cursor: pointer;
    backdrop-filter: blur(12px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
  }

  .export-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 20px 50px rgba(129, 140, 248, 0.2);
  }

  .filters-card {
    background: var(--glass-bg);
    backdrop-filter: blur(32px);
    border-radius: 24px;
    padding: clamp(20px, 4vw, 28px);
    border: 1px solid var(--glass-border);
    box-shadow: 0 20px 50px rgba(0,0,0,0.4);
    margin-bottom: 28px;
  }

  .filters-grid {
    display: grid;
    gap: 20px;
    grid-template-columns: 1fr;
  }

  .input-group label {
    display: block;
    color: #c4b5fd;
    font-size: clamp(14px, 3vw, 15px);
    font-weight: 700;
    margin-bottom: 10px;
  }

  .app-input {
    width: 100%;
    padding: clamp(14px, 3.5vw, 18px) 18px;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    border-radius: 16px;
    color: var(--text-primary);
    font-size: clamp(15px, 3.5vw, 17px);
    backdrop-filter: blur(16px);
    outline: none;
    transition: all 0.3s ease;
  }

  .app-input:focus {
    border-color: #818cf8;
    box-shadow: 0 0 28px rgba(129, 140, 248, 0.3);
    transform: translateY(-2px);
  }

  .bulk-actions {
    background: var(--glass-bg);
    backdrop-filter: blur(32px);
    border-radius: 24px;
    padding: clamp(16px, 3vw, 20px);
    margin-bottom: 20px;
    border: 1px solid var(--glass-border);
    box-shadow: 0 16px 40px rgba(0,0,0,0.35);
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .selection-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .select-all-btn {
    padding: 10px 16px;
    background: rgba(129, 140, 248, 0.2);
    color: #818cf8;
    border: 1px solid rgba(129, 140, 248, 0.4);
    border-radius: 16px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    white-space: nowrap;
  }

  .selected-count {
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 15px;
  }

  .bulk-buttons {
    display: flex;
    gap: 16px;
    width: 100%;
  }

  .bulk-approve, .bulk-reject {
    flex: 1;
    padding: 5px 5px;
    border: none;
    border-radius: 10px;
    color: white;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 12px 32px rgba(0,0,0,0.4);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 60px;
  }

  .bulk-approve {
    background: linear-gradient(135deg, #10b981, #059669);
  }

  .bulk-reject {
    background: linear-gradient(135deg, #ef4444, #dc2626);
  }

  .bulk-approve:disabled, .bulk-reject:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .bulk-approve:hover:not(:disabled), .bulk-reject:hover:not(:disabled) {
    transform: translateY(-4px);
    box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  }

  .loading-state {
    text-align: center;
    padding: 80px 20px;
    color: var(--text-secondary);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(129,140,248,0.3);
    border-top-color: #818cf8;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: rgba(16, 185, 129, 0.15);
    border: 2px dashed rgba(16, 185, 129, 0.5);
    border-radius: 32px;
    margin: 20px auto;
    max-width: 500px;
  }

  .celebration {
    font-size: 5rem;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    font-size: clamp(1.4rem, 4vw, 1.8rem);
    color: #10b981;
    font-weight: 900;
    margin-bottom: 12px;
  }

  .empty-state p {
    color: var(--text-secondary);
    font-size: 16px;
  }

  .entries-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .entry-card {
    background: var(--glass-bg);
    backdrop-filter: blur(32px);
    border-radius: 24px;
    padding: clamp(18px, 4vw, 24px);
    border: 1px solid var(--glass-border);
    box-shadow: 0 20px 50px rgba(0,0,0,0.4);
    transition: all 0.3s ease;
  }

  .entry-card.selected {
    border-color: #818cf8;
    box-shadow: 0 0 40px rgba(129, 140, 248, 0.3);
  }

  .entry-card:hover {
    transform: translateY(-4px);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
  }

  .checkbox {
    width: 20px;
    height: 20px;
    accent-color: #818cf8;
  }

  .slot-time {
    font-size: clamp(1.3rem, 4vw, 1.5rem);
    font-weight: 800;
    color: #c4b5fd;
  }

  .card-grid {
    display: grid;
    gap: 18px;
    grid-template-columns: 1fr 1fr;
    margin-bottom: 24px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field.full {
    grid-column: 1 / -1;
  }

  .field.highlight {
    background: rgba(15, 23, 42, 0.4);
    padding: 14px;
    border-radius: 16px;
  }

  .field.ok .value.big {
    color: #10b981;
    font-weight: 900;
    font-size: 1.6rem;
  }

  .field.nok .value.big {
    color: #ef4444;
    font-weight: 900;
    font-size: 1.6rem;
  }

  .field label {
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 600;
  }

  .field .value {
    color: var(--text-primary);
    font-weight: 600;
    font-size: 16px;
  }

  .field .value.italic {
    font-style: italic;
    opacity: 0.8;
    font-size: 15px;
  }

  .field .value.high {
    color: #ef4444;
    font-weight: 800;
  }

  .field .value.medium {
    color: #f59e0b;
    font-weight: 700;
  }

  .mo-edit {
    display: flex;
    gap: 8px;
  }

  .edit-input {
    padding: 10px 14px;
    background: rgba(15, 23, 42, 0.95);
    border: 1.5px solid #818cf8;
    border-radius: 12px;
    color: white;
    font-size: 15px;
    outline: none;
  }

  .edit-input.small {
    width: 100px;
  }

  .card-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .action-btn {
    flex: 1;
    min-width: 100px;
    padding: clamp(12px, 3vw, 16px);
    border: none;
    border-radius: 16px;
    font-weight: 800;
    font-size: clamp(14px, 3.2vw, 16px);
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .action-btn.approve {
    background: linear-gradient(135deg, #10b981, #059669);
    color: white;
  }

  .action-btn.edit {
    background: linear-gradient(135deg, #60a5fa, #818cf8);
    color: white;
  }

  .action-btn.reject {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
  }

  .action-btn.save {
    background: #818cf8;
    color: white;
  }

  .action-btn.cancel {
    background: rgba(148, 163, 184, 0.3);
    color: #94a3b8;
  }

  .action-btn:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 16px 40px rgba(0,0,0,0.4);
  }

  .toast {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30,41,59,0.95);
    backdrop-filter: blur(20px);
    color: white;
    padding: 16px 32px;
    border-radius: 24px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    font-weight: 700;
    font-size: 16px;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid rgba(129,140,248,0.3);
    animation: slideDown 0.4s ease;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 20px;
    padding: 32px 0;
    flex-wrap: wrap;
  }

  .page-btn {
    padding: 12px 24px;
    background: rgba(30, 41, 59, 0.6);
    color: var(--text-primary);
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    min-width: 120px;
  }

  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    color: #64748b;
  }

  .page-info {
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 16px;
  }

  .page-info strong {
    color: #c4b5fd;
  }

  @keyframes slideDown {
    from { opacity: 0; transform: translateX(-50%) translateY(-40px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (min-width: 640px) {
    .filters-grid {
      grid-template-columns: repeat(3, 1fr);
    }
    
    .card-grid {
      grid-template-columns: repeat(4, 1fr);
    }
    
    .bulk-actions {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
    }
  }

  @media (min-width: 1024px) {
    .supervisor-container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .entries-list {
      gap: 24px;
    }
  }
`;