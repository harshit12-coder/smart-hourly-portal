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
    const { data, error } = await supabase
      .from("production_entries")
      .select("*")
      .eq("approver_status", "approved")
      .order("date", { ascending: false })
      .order("time_slot");

    if (error) alert(error.message);
    setEntries(data || []);
    setFiltered(data || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    let t = entries;

    if (filters.startDate) t = t.filter(e => e.date >= filters.startDate);
    if (filters.endDate) t = t.filter(e => e.date <= filters.endDate);
    if (filters.line) t = t.filter(e => e.line === filters.line);
    if (filters.shift) t = t.filter(e => e.shift === filters.shift);

    if (search)
      t = t.filter(e =>
        (e.mo_number || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
        (e.line || "").toLowerCase().includes(search.toLowerCase())
      );

    setFiltered(t);
    setCurrentPage(1);
  }, [filters, search, entries]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const currentFiltered = filtered.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const exportToExcel = () => {
    if (!filtered.length) return alert("No data");
    const ws = utils.json_to_sheet(filtered);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Report");
    writeFile(wb, `SmartHourly_${Date.now()}.xlsx`);
  };

  const totalOK = filtered.reduce((s, e) => s + (e.ok_qty || 0), 0);
  const totalNOK = filtered.reduce((s, e) => s + (e.nok_qty || 0), 0);
  const totalProduced = totalOK + totalNOK;
  const okPct = totalProduced ? ((totalOK / totalProduced) * 100).toFixed(1) : 0;

  const chartData = Object.values(
    filtered.reduce((a, e) => {
      const k = e.time_slot;
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
      if (!a[e.line]) a[e.line] = { name: e.line, minutes: 0 };
      a[e.line].minutes += e.downtime || 0;
      return a;
    }, {})
  ).sort((a, b) => b.minutes - a.minutes).slice(0, 8);

  return (
    <div className="wrap">
      <h1 className="title">SmartHourly Dashboard</h1>

      <button className="export-btn" onClick={exportToExcel}>📥 Export Report</button>

      {/* METRICS */}
      <div className="metrics">
        <div className="metric">
          <p>Total Units</p>
          <strong>{totalProduced}</strong>
        </div>
        <div className="metric">
          <p>OK Units</p>
          <strong>{totalOK}</strong>
        </div>
        <div className="metric">
          <p>OK %</p>
          <strong>{okPct}%</strong>
        </div>
      </div>

      {/* CHARTS */}
      <div className="charts">
        <div className="chart-card">
          <h4>📈 Production Trend</h4>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area dataKey="total" stroke="#818cf8" fill="#818cf866" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h4>🎯 Quality Ratio</h4>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={qualityData} dataKey="value" innerRadius={50} outerRadius={75}>
                {qualityData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h4 style={{ display: "flex", alignItems: "center", gap: 6 }}>
            ⏱ Downtime by Line
          </h4>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={downtimeByLine} layout="vertical" barCategoryGap={12}>
              <defs>
                <linearGradient id="downtimeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="2 4" opacity={0.25} />

              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={70}
                tick={{ fill: "#cbd5ff", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />

              <Tooltip
                contentStyle={{
                  background: "rgba(15, 23, 42, .95)",
                  borderRadius: "10px",
                  border: "1px solid #4f46e540",
                  color: "white"
                }}
                formatter={(v) => [`${v} min`, "Downtime"]}
              />

              <Bar
                dataKey="minutes"
                name="Minutes"
                fill="url(#downtimeGrad)"
                radius={[4, 4, 4, 4]}
                barSize={18}
                label={{ position: "right", fill: "#e5e7ff", fontSize: 11 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* FILTERS — CLEAN UI */}
      <div className="clean-filters">

        <div className="filter-row">
          <div>
            <label>From</label>
            <input type="date"
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>

          <div>
            <label>To</label>
            <input type="date"
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
        </div>

        <div className="filter-row">
          <div>
            <label>Line</label>
            <select
              value={filters.line}
              onChange={e => setFilters({ ...filters, line: e.target.value })}
            >
              <option value="">All</option>
              {LINES.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label>Shift</label>
            <select
              value={filters.shift}
              onChange={e => setFilters({ ...filters, shift: e.target.value })}
            >
              <option value="">All</option>
              <option>A</option><option>B</option><option>C</option>
            </select>
          </div>
        </div>

        <input
          className="search"
          placeholder="🔍 Search MO / Line / Customer…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* TABLE */}
      <div className="table-box">
        {loading ? (
          <div className="empty">Loading…</div>
        ) : !filtered.length ? (
          <div className="empty">No data</div>
        ) : (
          <>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    {["Date","Line","Shift","Slot","MO","OK","NOK","Downtime"]
                      .map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {currentFiltered.map((e,i)=>(
                    <tr key={i}>
                      <td>{e.date}</td>
                      <td>{e.line}</td>
                      <td>{e.shift}</td>
                      <td>{e.time_slot}</td>
                      <td>{e.mo_number}</td>
                      <td className="ok">{e.ok_qty}</td>
                      <td className="nok">{e.nok_qty}</td>
                      <td>{e.downtime||0}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages>1 && (
              <div className="pager">
                <button disabled={currentPage===1}
                  onClick={()=>setCurrentPage(p=>p-1)}>Prev</button>
                <span>{currentPage}/{totalPages}</span>
                <button disabled={currentPage===totalPages}
                  onClick={()=>setCurrentPage(p=>p+1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* STYLES */}
      <style>{`
        .wrap{max-width:1100px;margin:auto;padding:14px}

        .title{text-align:center;font-weight:900;
          background:linear-gradient(90deg,#c7d2fe,#818cf8);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;
          margin-bottom:10px}

        .export-btn{background:#6366f1;color:white;padding:9px 16px;
          border-radius:12px;border:none;font-weight:700;
          display:block;margin:8px auto 14px}

        .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        .metric{background:#0f172abf;border:1px solid #4f46e550;
          padding:12px;border-radius:16px;text-align:center}
        .metric p{margin:0;color:#a9b1ff;font-size:12px}
        .metric strong{font-size:22px}

        .charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));
          gap:12px;margin:14px 0}

        .chart-card{
          background:linear-gradient(180deg,#0f172a,#020617);
          padding:14px;border-radius:18px;
          border:1px solid #4f46e533;
          box-shadow:0 18px 40px rgba(0,0,0,.35)
        }

        .chart-card h4{margin:0 0 8px;color:#dbe3ff}

        /* FILTER CARD */
        .clean-filters{
          background:rgba(10,15,30,.75);
          border-radius:18px;
          border:1px solid rgba(129,140,248,.25);
          box-shadow:0 18px 40px rgba(0,0,0,.25);
          padding:12px 14px;
          margin:14px 0;
        }

        .filter-row{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-bottom:10px;
        }

        .clean-filters label{
          font-size:11px;
          color:#9aa7ff;
          margin-bottom:4px;
          display:block;
        }

        .clean-filters input,
        .clean-filters select{
          width:100%;
          background:#020617;
          border:1px solid #334155;
          border-radius:10px;
          padding:9px 10px;
          color:white;
        }

        .clean-filters .search{
          margin-top:4px;
          padding:10px 12px;
        }

        .table-box{background:#0f172acc;border-radius:18px;padding:10px;margin-top:8px}
        table{width:100%;font-size:13px}

        table thead{background:rgba(30,41,59,.6)}
        th{color:#a5b4fc;text-align:left;padding:8px;border-bottom:1px solid rgba(129,140,248,.3)}

        td{padding:8px}
        .scroll{overflow-x:auto}

        .pager{display:flex;gap:10px;justify-content:center;padding:10px}

        .ok{color:#22c55e;font-weight:700}
        .nok{color:#ef4444;font-weight:700}

        .empty{text-align:center;padding:30px;color:#9aa3c9}

        @media(max-width:900px){
          .wrap{padding:10px}
          .metrics{grid-template-columns:repeat(2,1fr)}
          .charts{grid-template-columns:1fr}
          table{font-size:12px}
        }
      `}</style>
    </div>
  );
}
