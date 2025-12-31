import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { utils, writeFile } from "xlsx";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area
} from "recharts";

const globalStyles = `
  @keyframes reveal {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`;

const LINES = Array.from({ length: 18 }).map(
  (_, i) => `Line-${String(i + 1).padStart(2, "0")}`
);

export default function Report() {
  const [entries, setEntries] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Pagination
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
    const { data, error } = await supabase
      .from("production_entries")
      .select("*")
      .eq("approver_status", "approved")
      .order("date", { ascending: false })
      .order("time_slot");

    if (error) {
      alert("Error loading report: " + error.message);
      setLoading(false);
      return;
    }

    setEntries(data || []);
    setFiltered(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let temp = entries;

    if (filters.startDate) temp = temp.filter(e => e.date >= filters.startDate);
    if (filters.endDate) temp = temp.filter(e => e.date <= filters.endDate);
    if (filters.line) temp = temp.filter(e => e.line === filters.line);
    if (filters.shift) temp = temp.filter(e => e.shift === filters.shift);
    if (search) {
      temp = temp.filter(e =>
        e.mo_number?.toLowerCase().includes(search.toLowerCase()) ||
        e.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        e.line?.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFiltered(temp);
    setCurrentPage(1); // Reset to page 1 on filter
  }, [filters, search, entries]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const currentFiltered = filtered.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
    // Smooth scroll to table start or just keep view
  };

  const exportToExcel = () => {
    if (filtered.length === 0) return alert("No data to export");

    const dataToExport = filtered.map(e => ({
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
    utils.book_append_sheet(workbook, worksheet, "Production Report");
    writeFile(workbook, `SmartHourly_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Summary Calculations
  const totalOK = filtered.reduce((sum, e) => sum + (e.ok_qty || 0), 0);
  const totalNOK = filtered.reduce((sum, e) => sum + (e.nok_qty || 0), 0);
  const totalProduced = totalOK + totalNOK;
  const okPercentage = totalProduced > 0 ? ((totalOK / totalProduced) * 100).toFixed(2) : 0;
  const totalDowntime = filtered.reduce((sum, e) => sum + (e.downtime || 0), 0) / 60;

  // CHART DATA: Production Trend
  const chartData = Object.values(filtered.reduce((acc, e) => {
    const key = e.time_slot;
    if (!acc[key]) acc[key] = { time: key, ok: 0, nok: 0, total: 0 };
    acc[key].ok += (e.ok_qty || 0);
    acc[key].nok += (e.nok_qty || 0);
    acc[key].total += (e.ok_qty || 0) + (e.nok_qty || 0);
    return acc;
  }, {})).sort((a, b) => a.time.localeCompare(b.time));

  // CHART DATA: Quality Distribution
  const qualityPieData = [
    { name: "OK Quantity", value: totalOK, color: "#10b981" },
    { name: "NOK Quantity", value: totalNOK, color: "#ef4444" }
  ];

  // CHART DATA: Downtime by Line
  const downtimeByLine = Object.values(filtered.reduce((acc, e) => {
    const key = e.line;
    if (!acc[key]) acc[key] = { name: key, minutes: 0 };
    acc[key].minutes += (e.downtime || 0);
    return acc;
  }, {})).sort((a, b) => b.minutes - a.minutes).slice(0, 10);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: "rgba(15, 23, 42, 0.9)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(129, 140, 248, 0.3)",
          padding: "12px",
          borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)"
        }}>
          <p style={{ color: "#c4b5fd", fontWeight: "bold", margin: 0 }}>{label}</p>
          {payload.map((p, i) => (
            <p key={i} style={{ color: p.color, margin: "4px 0", fontSize: "14px" }}>
              {p.name}: {p.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: "1.5rem 1rem", maxWidth: "1200px", width: "98%", margin: "0 auto" }}>
      <h1 style={{
        fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
        fontWeight: "900",
        textAlign: "center",
        marginBottom: "2rem",
        background: "linear-gradient(90deg, #c4b5fd, #818cf8, #60a5fa)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        textShadow: "0 0 25px rgba(196, 181, 253, 0.4)"
      }}>
        SmartHourly Analytics
      </h1>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
        <button
          onClick={exportToExcel}
          style={{
            padding: "0.6rem 1.25rem",
            background: "linear-gradient(135deg, #818cf8, #6366f1)",
            color: "white",
            border: "none",
            borderRadius: "0.75rem",
            fontWeight: "700",
            fontSize: "0.85rem",
            cursor: "pointer",
            boxShadow: "0 8px 20px rgba(99, 102, 241, 0.3)",
            transition: "all 0.4s ease",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            animation: "reveal 0.8s ease both",
            animationDelay: "0.05s"
          }}
          onMouseEnter={e => e.target.style.transform = "translateY(-2px) scale(1.02)"}
          onMouseLeave={e => e.target.style.transform = "translateY(0) scale(1)"}
        >
          📥 Export Production Report
        </button>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "16px",
        marginBottom: "30px"
      }}>
        <div style={{ ...metricCardStyle("#10b981", "Total Produced"), animation: "reveal 0.8s ease both", animationDelay: "0.1s" }}>
          <div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "4px" }}>Total Units</div>
          <div style={{ fontSize: "24px", fontWeight: "900" }}>{totalProduced.toLocaleString()}</div>
        </div>

        <div style={{ ...metricCardStyle("#60a5fa", "OK Quantity"), animation: "reveal 0.8s ease both", animationDelay: "0.2s" }}>
          <div style={{ fontSize: "13px", opacity: 0.8, marginBottom: "4px" }}>Good Production</div>
          <div style={{ fontSize: "24px", fontWeight: "900" }}>{totalOK.toLocaleString()}</div>
        </div>

        <div style={metricCardStyle(okPercentage >= 95 ? "#10b981" : okPercentage >= 90 ? "#f59e0b" : "#ef4444", "OK %")}>
          <div style={{ fontSize: "13px", opacity: 0.9, marginBottom: "4px" }}>Quality Rate</div>
          <div style={{ fontSize: "24px", fontWeight: "900" }}>{okPercentage}%</div>
        </div>

        <div style={metricCardStyle(totalDowntime > 5 ? "#ef4444" : "#f59e0b", "Downtime")}>
          <div style={{ fontSize: "13px", opacity: 0.9, marginBottom: "4px" }}>Total Hours</div>
          <div style={{ fontSize: "24px", fontWeight: "900" }}>{totalDowntime.toFixed(1)}h</div>
        </div>
      </div>

      {/* VISUAL CHARTS SECTION */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
        gap: "30px",
        marginBottom: "40px",
        animation: "reveal 0.8s ease both",
        animationDelay: "0.5s"
      }}>
        {/* Production Trend Line Chart */}
        <div style={{
          background: "rgba(30, 41, 59, 0.4)",
          backdropFilter: "blur(20px)",
          borderRadius: "20px",
          padding: "20px",
          border: "1px solid rgba(129, 140, 248, 0.15)",
          minHeight: "280px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
        }}>
          <h3 style={{ color: "#c4b5fd", marginBottom: "15px", fontSize: "16px", fontWeight: "800", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>📈</span> Production Trend
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.05)" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(129, 140, 248, 0.05)' }} />
              <Area
                type="monotone"
                dataKey="total"
                name="Total Units"
                stroke="#818cf8"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorTotal)"
                animationBegin={800}
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Quality Pie & Downtime Bar */}
        <div style={{
          display: "grid",
          gridTemplateRows: "auto auto",
          gap: "16px"
        }}>
          <div style={{
            background: "rgba(30, 41, 59, 0.4)",
            backdropFilter: "blur(20px)",
            borderRadius: "20px",
            padding: "16px",
            border: "1px solid rgba(129, 140, 248, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
          }}>
            <div>
              <h3 style={{ color: "#c4b5fd", marginBottom: "8px", fontSize: "16px", fontWeight: "800" }}>🎯 Quality Ratio</h3>
              <p style={{ color: "#94a3b8", fontSize: "12px" }}>Overall OK vs NOK</p>
            </div>
            <ResponsiveContainer width={150} height={120}>
              <PieChart>
                <Pie
                  data={qualityPieData}
                  innerRadius={35}
                  outerRadius={50}
                  paddingAngle={5}
                  dataKey="value"
                  animationBegin={1000}
                  animationDuration={1200}
                >
                  {qualityPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            background: "rgba(30, 41, 59, 0.4)",
            backdropFilter: "blur(20px)",
            borderRadius: "20px",
            padding: "16px",
            border: "1px solid rgba(129, 140, 248, 0.15)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
          }}>
            <h3 style={{ color: "#c4b5fd", marginBottom: "16px", fontSize: "16px", fontWeight: "800" }}>⏱️ Line Downtime (Top Lines)</h3>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={downtimeByLine} layout="vertical">
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(129, 140, 248, 0.05)' }} />
                <Bar
                  dataKey="minutes"
                  name="Downtime (min)"
                  fill="#f59e0b"
                  radius={[0, 4, 4, 0]}
                  barSize={12}
                  animationBegin={1200}
                  animationDuration={1500}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* FILTERS CARD */}
      <div style={{ ...filterCardStyle, animation: "reveal 0.8s ease both", animationDelay: "0.5s" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "20px",
          marginBottom: "20px"
        }}>
          <div>
            <label style={labelStyle}>Start Date</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>End Date</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Line</label>
            <select value={filters.line} onChange={e => setFilters({ ...filters, line: e.target.value })} style={inputStyle}>
              <option value="">All Lines</option>
              {LINES.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Shift</label>
            <select value={filters.shift} onChange={e => setFilters({ ...filters, shift: e.target.value })} style={inputStyle}>
              <option value="">All Shifts</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
        </div>

        <input
          type="text"
          placeholder="🔍 Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, padding: "14px 20px", fontSize: "16px" }}
        />
      </div>

      {/* DATA TABLE */}
      {loading ? (
        <div style={emptyStateStyle}>🔄 Loading production data...</div>
      ) : filtered.length === 0 ? (
        <div style={emptyStateStyle}>📊 No approved entries found for selected filters</div>
      ) : (
        <div style={tableContainerStyle}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: "rgba(51, 65, 85, 0.9)" }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Line</th>
                  <th style={thStyle}>Shift</th>
                  <th style={thStyle}>Slot</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>MO Details</th>
                  <th style={thStyle}>OK Qty</th>
                  <th style={thStyle}>NOK Qty</th>
                  <th style={thStyle}>Downtime</th>
                  <th style={thStyle}>Approved By</th>
                </tr>
              </thead>
              <tbody>
                {currentFiltered.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(129, 140, 248, 0.1)" }}>
                    <td style={tdStyle}>{e.date}</td>
                    <td style={tdStyle}>{e.line}</td>
                    <td style={tdStyle}>{e.shift}</td>
                    <td style={tdStyle}>{e.time_slot}</td>
                    <td style={tdStyle}>{e.customer_name || "-"}</td>
                    <td style={tdStyle}>{e.mo_number || "-"} <span style={{ opacity: 0.7 }}>({e.mo_type})</span></td>
                    <td style={{ ...tdStyle, color: "#10b981", fontWeight: "700" }}>{e.ok_qty}</td>
                    <td style={{ ...tdStyle, color: "#ef4444", fontWeight: "700" }}>{e.nok_qty}</td>
                    <td style={tdStyle}>{e.downtime || 0} min</td>
                    <td style={tdStyle}>{e.approved_by || "Supervisor"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "12px",
              padding: "20px",
              background: "rgba(15, 23, 42, 0.2)"
            }}>
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  padding: "6px 14px",
                  background: "rgba(30, 41, 59, 0.5)",
                  color: currentPage === 1 ? "#475569" : "#e0e7ff",
                  border: "1px solid rgba(129, 140, 248, 0.2)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: currentPage === 1 ? "default" : "pointer"
                }}
              >
                Previous
              </button>

              <div style={{ color: "#94a3b8", fontWeight: "600", fontSize: "13px" }}>
                Page <span style={{ color: "#c4b5fd" }}>{currentPage}</span> of {totalPages}
              </div>

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  padding: "6px 14px",
                  background: "rgba(30, 41, 59, 0.5)",
                  color: currentPage === totalPages ? "#475569" : "#e0e7ff",
                  border: "1px solid rgba(129, 140, 248, 0.2)",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: currentPage === totalPages ? "default" : "pointer"
                }}
              >
                Next
              </button>
            </div>
          )}

          <div style={{ padding: "16px", textAlign: "center", color: "#94a3b8", fontSize: "15px", fontWeight: "600" }}>
            📈 Showing {currentFiltered.length} of {filtered.length} entries
          </div>
        </div>
      )}
    </div>
  );
}

// Premium Styles
const metricCardStyle = (accentColor, title) => ({
  background: "rgba(15, 23, 42, 0.3)",
  backdropFilter: "blur(20px)",
  borderRadius: "1rem",
  padding: "1rem",
  textAlign: "center",
  border: `1px solid ${accentColor}40`,
  boxShadow: `0 10px 30px rgba(0,0,0,0.1), 0 0 15px ${accentColor}05`,
  transition: "all 0.4s ease"
});

const filterCardStyle = {
  background: "rgba(30, 41, 59, 0.75)",
  backdropFilter: "blur(20px)",
  borderRadius: "1rem",
  padding: "1rem",
  border: "1px solid rgba(129, 140, 248, 0.3)",
  boxShadow: "0 15px 40px rgba(0,0,0,0.3)",
  marginBottom: "1.25rem"
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
  padding: "0.75rem 1.25rem",
  background: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(129, 140, 248, 0.4)",
  borderRadius: "0.75rem",
  color: "#e0e7ff",
  fontSize: "0.9rem",
  backdropFilter: "blur(12px)",
  transition: "all 0.3s ease"
};

const tableContainerStyle = {
  background: "rgba(30, 41, 59, 0.7)",
  backdropFilter: "blur(20px)",
  borderRadius: "1.5rem",
  overflow: "hidden",
  border: "1px solid rgba(129, 140, 248, 0.2)",
  boxShadow: "0 25px 70px rgba(0,0,0,0.5)"
};

const thStyle = {
  padding: "1rem 1.25rem",
  textAlign: "left",
  color: "#c4b5fd",
  fontWeight: "800",
  fontSize: "0.9rem",
  borderBottom: "2px solid rgba(129, 140, 248, 0.3)"
};

const tdStyle = {
  padding: "0.85rem 1.25rem",
  color: "#e0e7ff",
  fontSize: "0.85rem"
};

const emptyStateStyle = {
  textAlign: "center",
  padding: "7.5rem 2.5rem",
  background: "rgba(129, 140, 248, 0.1)",
  borderRadius: "2rem",
  border: "2px dashed rgba(129, 140, 248, 0.3)",
  color: "#818cf8",
  fontSize: "1.75rem",
  fontWeight: "600"
};