// Report.js - MOBILE CARD VIEW + DESKTOP TABLE (Perfect for Mobile)
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { utils, writeFile } from "xlsx";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area
} from "recharts";

const LINES = Array.from({ length: 18 }).map(
  (_, i) => `Line-${String(i + 1).padStart(2, "0")}`
);

export default function Report() {
  const [entries, setEntries] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    line: "",
    shift: ""
  });

  async function loadData() {
    setLoading(true);
    try {
      let query = supabase
        .from("production_entries")
        .select("*")
        .eq("approver_status", "approved")
        .order("date", { ascending: false })
        .order("time_slot", { ascending: true });

      if (filters.startDate) query = query.gte("date", filters.startDate);
      if (filters.endDate) query = query.lte("date", filters.endDate);
      if (filters.line) query = query.eq("line", filters.line);
      if (filters.shift) query = query.eq("shift", filters.shift);

      const { data, error } = await query;
      if (error) throw error;

      setEntries(data || []);
      setFiltered(data || []);
    } catch (err) {
      alert("Error loading data: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters.startDate, filters.endDate, filters.line, filters.shift]);

  useEffect(() => {
    let t = entries;
    if (search) {
      const lower = search.toLowerCase();
      t = t.filter(e =>
        (e.mo_number || "").toLowerCase().includes(lower) ||
        (e.customer_name || "").toLowerCase().includes(lower) ||
        (e.line || "").toLowerCase().includes(lower)
      );
    }
    setFiltered(t);
    setCurrentPage(1);
  }, [search, entries]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const currentFiltered = filtered.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const exportToExcel = () => {
    if (!filtered.length) return alert("No data to export");
    const ws = utils.json_to_sheet(filtered);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Report");
    writeFile(wb, `SmartHourly_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const totalOK = filtered.reduce((s, e) => s + (e.ok_qty || 0), 0);
  const totalNOK = filtered.reduce((s, e) => s + (e.nok_qty || 0), 0);
  const totalProduced = totalOK + totalNOK;
  const okPct = totalProduced ? ((totalOK / totalProduced) * 100).toFixed(1) : 0;

  const chartData = Object.values(
    filtered.reduce((a, e) => {
      const k = e.time_slot || "Unknown";
      if (!a[k]) a[k] = { time: k, total: 0 };
      a[k].total += (e.ok_qty || 0) + (e.nok_qty || 0);
      return a;
    }, {})
  ).sort((a, b) => a.time.localeCompare(b.time));

  const qualityData = [
    { name: "OK", value: totalOK, color: "#22c55e" },
    { name: "NOK", value: totalNOK, color: "#ef4444" }
  ];

  const downtimeByLine = Object.values(
    filtered.reduce((a, e) => {
      const l = e.line || "Unknown";
      if (!a[l]) a[l] = { name: l, minutes: 0 };
      a[l].minutes += e.downtime || 0;
      return a;
    }, {})
  ).sort((a, b) => b.minutes - a.minutes).slice(0, 8);

  return (
    <div className="report-container">
      <h1 className="page-title">SmartHourly Dashboard</h1>

      <div className="top-actions">
        <button className="export-btn" onClick={exportToExcel}>
          📥 Export Report
        </button>
        
      </div>

      {/* METRICS */}
      <div className="metrics">
        <div className="metric">
          <p>Total Units</p>
          <strong>{totalProduced.toLocaleString()}</strong>
        </div>
        <div className="metric">
          <p>OK Units</p>
          <strong>{totalOK.toLocaleString()}</strong>
        </div>
        <div className="metric">
          <p>OK %</p>
          <strong>{okPct}%</strong>
        </div>
      </div>

      {/* CHARTS */}
      <div className="charts">
        <div className="chart-card">
          <h4
  style={{
    color: "#7dcf96",
    margin: "0 0 12px",
    textAlign: "center"
  }}
>
  📈 Production by Slot
</h4>

          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #4f46e5" }} />
              <Area type="monotone" dataKey="total" stroke="#818cf8" fill="#818cf899" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
         <h4
  style={{
    color: "#f4c542",
    margin: "0 0 12px",
    textAlign: "center"
  }}
>
  🎯 Quality Ratio
</h4>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={qualityData} dataKey="value" innerRadius={60} outerRadius={90}>
                {qualityData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
         <h4
  style={{
    color: "#ea7575ff",
    margin: "0 0 12px",
    textAlign: "center",
    fontWeight: "800",
  }}
>
  ⏱ Top Downtime Lines
</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={downtimeByLine} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" />
              <YAxis dataKey="name" type="category" width={80} stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Bar dataKey="minutes" fill="#f97316" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FILTERS */}
      <div className="filters-card">
        <div className="filter-grid">
          <div className="input-group">
            <label>From Date</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} />
          </div>
          <div className="input-group">
            <label>To Date</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} />
          </div>
          <div className="input-group">
            <label>Line</label>
            <select value={filters.line} onChange={e => setFilters({ ...filters, line: e.target.value })}>
              <option value="">All Lines</option>
              {LINES.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label>Shift</label>
            <select value={filters.shift} onChange={e => setFilters({ ...filters, shift: e.target.value })}>
              <option value="">All Shifts</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
        </div>

        <input
          className="search-input"
          placeholder="🔍 Search by MO, Customer, Line..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="mobile-entries">
        {loading ? (
          <div className="loading">🔄 Loading...</div>
        ) : !filtered.length ? (
          <div className="empty-state">📭 No approved entries found</div>
        ) : (
          currentFiltered.map((e, i) => (
            <div key={i} className="entry-card">
              <div className="card-header">
                <div className="main-info">
                  <div className="date">{e.date}</div>
                  <div className="slot">⏰ {e.time_slot}</div>
                </div>
                <div className="line-shift">
                  <div className="line">{e.line}</div>
                  <div className="shift">Shift {e.shift}</div>
                </div>
              </div>

              <div className="card-body">
                <div className="info-row">
                  <span className="label">Customer</span>
                  <span className="value">{e.customer_name || "-"}</span>
                </div>
                <div className="info-row">
                  <span className="label">MO Number</span>
                  <span className="value">{e.mo_number || "-"} ({e.mo_type || "-"})</span>
                </div>
                <div className="qty-row">
                  <div className="qty ok">
                    <span className="label">OK</span>
                    <strong>{e.ok_qty || 0}</strong>
                  </div>
                  <div className="qty nok">
                    <span className="label">NOK</span>
                    <strong>{e.nok_qty || 0}</strong>
                  </div>
                  <div className="qty">
                    <span className="label">Downtime</span>
                    <strong>{e.downtime || 0}m</strong>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="desktop-table">
        {loading ? (
          <div className="empty">🔄 Loading...</div>
        ) : !filtered.length ? (
          <div className="empty">📭 No approved entries</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Line</th>
                  <th>Shift</th>
                  <th>Slot</th>
                  <th>Customer</th>
                  <th>MO Number</th>
                  <th>OK</th>
                  <th>NOK</th>
                  <th>Downtime</th>
                </tr>
              </thead>
              <tbody>
                {currentFiltered.map((e, i) => (
                  <tr key={i}>
                    <td>{e.date}</td>
                    <td>{e.line}</td>
                    <td>{e.shift}</td>
                    <td>{e.time_slot}</td>
                    <td>{e.customer_name || "-"}</td>
                    <td>{e.mo_number || "-"} ({e.mo_type || "-"})</td>
                    <td className="ok">{e.ok_qty || 0}</td>
                    <td className="nok">{e.nok_qty || 0}</td>
                    <td>{e.downtime || 0}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
            Previous
          </button>
          <span>{currentPage} / {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
            Next
          </button>
        </div>
      )}

      <style jsx>{`
        .report-container {
          padding: clamp(5px, 1vw, 10px);
          max-width: 1600px;
          margin: 0;;
          width: 100%;
        }

        .page-title {
          text-align: center;
          font-weight: 900;
          font-size: clamp(1.8rem, 5vw, 2.4rem);
          background: linear-gradient(90deg, #c7d2fe, #818cf8, #60a5fa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 20px;
        }

        .top-actions {
          text-align: center;
          margin-bottom: 24px;
        }

       .export-btn {
  background: #27ae60;   /* premium green */
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 20px;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  margin: 0 8px;
  box-shadow: 0 6px 14px rgba(39, 174, 96, 0.25);
  transition: 0.25s ease;
}

.export-btn:hover {
  background: #34a063ff;   /* slightly darker on hover */
  transform: translateY(-1px);
}

        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin: 24px 0;
        }

        .metric {
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(129, 140, 248, 0.3);
          padding: 20px;
          border-radius: 20px;
          text-align: center;
          backdrop-filter: blur(12px);
        }

        .metric p {
          margin: 0 0 8px;
          color: #94a3b8;
          font-size: 14px;
        }

        .metric strong {
          font-size: 28px;
          color: #e0e7ff;
        }

      .charts {
    display: grid;
    grid-template-columns: 1fr; /* Mobile pe single column full width */
    gap: 20px;
    margin: 20px 0;
  }

       .chart-card {
    background: rgba(15, 23, 42, 0.9);
    padding: 20px;
    border-radius: 24px;
    border: 1px solid rgba(129, 140, 248, 0.2);
    box-shadow: 0 20px 50px rgba(0,0,0,0.4);
    width: 100%;           /* Critical */
    max-width: none;       /* Remove any restriction */
    margin: 0;             /* No extra margin */
  }

        .chart-card h4 {
    margin: 0 0 12px;
    color: #7dcf96ff;
    text-align: center;
  }

        .filters-card {
          background: rgba(15, 23, 42, 0.9);
          border-radius: 24px;
          padding: 24px;
          border: 1px solid rgba(129, 140, 248, 0.25);
          margin: 20px 0 30px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.3);
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }

        .input-group label {
          display: block;
          color: #c4b5fd;
          font-size: 14px;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .input-group input, .input-group select {
          width: 100%;
          padding: 14px 16px;
          background: rgba(10, 15, 25, 0.9);
          border: 1.5px solid rgba(129, 140, 248, 0.3);
          border-radius: 16px;
          color: #e0e7ff;
          font-size: 15px;
        }

        .search-input {
          width: 100%;
          padding: 16px 20px;
          background: rgba(10, 15, 25, 0.9);
          border: 1.5px solid rgba(129, 140, 248, 0.3);
          border-radius: 20px;
          color: #e0e7ff;
          font-size: 16px;
        }

        /* MOBILE CARD VIEW */
        .mobile-entries {
          display: block;
          
        }

        .desktop-table {
          display: none;
        }

        .entry-card {
          background: rgba(30, 41, 59, 0.85);
          backdrop-filter: blur(32px);
          border-radius: 24px;
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid rgba(129, 140, 248, 0.2);
          box-shadow: 0 16px 40px rgba(0,0,0,0.35);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(129, 140, 248, 0.15);
        }

        .main-info .date {
          font-size: 18px;
          font-weight: 800;
          color: #c4b5fd;
        }

        .main-info .slot {
          color: #94a3b8;
          font-size: 15px;
          margin-top: 4px;
        }

        .line-shift {
          text-align: right;
        }

        .line-shift .line {
          font-size: 18px;
          font-weight: 700;
          color: #e0e7ff;
        }

        .line-shift .shift {
          color: #818cf8;
          font-size: 15px;
        }

        .card-body .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .info-row .label {
          color: #94a3b8;
          font-size: 14px;
        }

        .info-row .value {
          color: #e0e7ff;
          font-weight: 600;
          text-align: right;
        }

        .qty-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
          margin-top: 16px;
        }

        .qty {
          text-align: center;
          background: rgba(15, 23, 42, 0.6);
          padding: 12px;
          border-radius: 16px;
        }

        .qty .label {
          display: block;
          color: #94a3b8;
          font-size: 13px;
          margin-bottom: 4px;
        }

        .qty strong {
          font-size: 22px;
          font-weight: 900;
        }

        .qty.ok strong {
          color: #22c55e;
        }

        .qty.nok strong {
          color: #ef4444;
        }

        /* DESKTOP TABLE */
        @media (min-width: 768px) {
        .charts {
      grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
      gap: 24px;
    }
          .mobile-entries {
            display: none;
          }

          .desktop-table {
            display: block;
          }

          .table-wrapper {
            background: rgba(15, 23, 42, 0.9);
            border-radius: 24px;
            overflow: hidden;
            border: 1px solid rgba(129, 140, 248, 0.2);
            box-shadow: 0 20px 50px rgba(0,0,0,0.4);
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          thead {
            background: rgba(51, 65, 85, 0.8);
          }

          th {
            padding: 16px 12px;
            text-align: left;
            color: #c4b5fd;
            font-weight: 700;
            font-size: 13px;
            text-transform: uppercase;
          }

          td {
            padding: 14px 12px;
            border-bottom: 1px solid rgba(129, 140, 248, 0.1);
            color: #e0e7ff;
          }

          .ok {
            color: #22c55e;
            font-weight: 700;
            text-align: center;
          }

          .nok {
            color: #ef4444;
            font-weight: 700;
            text-align: center;
          }
        }

        .loading, .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #94a3b8;
          font-size: 18px;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 20px;
          padding: 32px 0;
        }

        .pagination button {
          padding: 12px 24px;
          background: rgba(30, 41, 59, 0.6);
          color: #e0e7ff;
          border: 1px solid rgba(129, 140, 248, 0.3);
          border-radius: 16px;
          cursor: pointer;
          font-weight: 600;
        }

        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pagination span {
          color: #94a3b8;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}