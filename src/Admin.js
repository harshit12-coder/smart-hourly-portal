// Admin.js - FULL PREMIUM WITH PROFILES & ROLES (REAL DATA)
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  async function loadUsers() {
    setLoading(true);

    // Step 1: Load all user_roles
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("id, role");

    if (rolesError) {
      alert("Error loading roles: " + rolesError.message);
      setLoading(false);
      return;
    }

    // Step 2: Load all profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, department, phone");

    if (profilesError) {
      alert("Error loading profiles: " + profilesError.message);
      setLoading(false);
      return;
    }

    // Step 3: Get current logged-in user email
    const { data: { user: currentAuthUser } } = await supabase.auth.getUser();

    // Step 4: Merge everything
    const mergedUsers = rolesData.map(roleEntry => {
      const profile = profilesData.find(p => p.id === roleEntry.id);
      const isCurrentUser = currentAuthUser?.id === roleEntry.id;

      return {
        id: roleEntry.id,
        role: roleEntry.role || "operator",
        name: profile?.name || (isCurrentUser ? currentAuthUser?.user_metadata?.full_name || currentAuthUser?.email?.split("@")[0] || "Unknown" : "Unknown User"),
        email: isCurrentUser ? currentAuthUser?.email || "unknown@email.com" : "hidden@email.com",
        department: profile?.department || "-",
        phone: profile?.phone || "-",
        isCurrentUser
      };
    });

    // Sort by name
    mergedUsers.sort((a, b) => a.name.localeCompare(b.name));

    setUsers(mergedUsers);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function changeRole(userId, newRole) {
    const currentAdmins = users.filter(u => u.role === "admin");
    if (currentAdmins.length === 1 && currentAdmins[0].id === userId && newRole !== "admin") {
      alert("❌ Cannot remove the last admin!");
      return;
    }

    if (!window.confirm(`Change role to "${newRole.toUpperCase()}"?`)) return;

    setLoading(true);
    const { error } = await supabase
      .from("user_roles")
      .upsert({ id: userId, role: newRole });

    setLoading(false);
    if (error) {
      alert("Update failed: " + error.message);
    } else {
      alert("✅ Role updated successfully!");
      loadUsers();
    }
  }

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.department?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search)
  );

  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const currentUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div style={{ padding: "1.5rem 1rem", maxWidth: "1400px", width: "98%", margin: "0 auto" }}>
      <h1 style={{
        fontSize: "clamp(1.5rem, 4vw, 1.8rem)",
        fontWeight: "900",
        textAlign: "center",
        marginBottom: "1.5rem",
        background: "linear-gradient(90deg, #c4b5fd, #818cf8, #60a5fa)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        textShadow: "0 0 25px rgba(196, 181, 253, 0.4)",
        animation: "reveal 0.8s ease both"
      }}>
        SmartHourly User Management
      </h1>

      {/* SEARCH */}
      <div style={{ maxWidth: "500px", margin: "0 auto 1.5rem auto", animation: "reveal 0.8s ease both", animationDelay: "0.1s" }}>
        <input
          type="text"
          placeholder="🔍 Search users..."
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            width: "100%",
            padding: "0.6rem 1.2rem",
            background: "rgba(30, 41, 59, 0.4)",
            border: "1px solid rgba(129, 140, 248, 0.15)",
            borderRadius: "0.75rem",
            color: "#e0e7ff",
            fontSize: "0.85rem",
            backdropFilter: "blur(16px)",
            transition: "all 0.3s ease",
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
          }}
        />
      </div>

      {/* TABLE CARD */}
      <div style={{
        background: "rgba(30, 41, 59, 0.7)",
        backdropFilter: "blur(24px)",
        borderRadius: "24px",
        overflow: "hidden",
        border: "1px solid rgba(129, 140, 248, 0.2)",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5)"
      }}>
        {loading ? (
          <div style={{ padding: "80px", textAlign: "center", color: "#94a3b8", fontSize: "20px" }}>
            🔄 Loading user data...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: "80px", textAlign: "center", color: "#818cf8", fontSize: "24px" }}>
            📋 No users found
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: "rgba(51, 65, 85, 0.9)" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Department</th>
                  <th style={thStyle}>Phone</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Change Role</th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(129, 140, 248, 0.1)" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: "700", fontSize: "14px" }}>
                        {u.name}
                        {u.isCurrentUser && <span style={{ color: "#60a5fa", fontSize: "11px", marginLeft: "8px" }}>(You)</span>}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ color: "#a78bfa", fontSize: "13px" }}>{u.email}</div>
                    </td>
                    <td style={tdStyle}>{u.department}</td>
                    <td style={tdStyle}>{u.phone}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "6px 12px",
                        borderRadius: "10px",
                        fontWeight: "700",
                        fontSize: "12px",
                        background: u.role === "admin"
                          ? "rgba(167, 139, 250, 0.3)"
                          : u.role === "supervisor"
                            ? "rgba(34, 197, 94, 0.3)"
                            : "rgba(59, 130, 246, 0.3)",
                        color: u.role === "admin" ? "#c4b5fd" : u.role === "supervisor" ? "#86efac" : "#93c5fd"
                      }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.id, e.target.value)}
                        style={{
                          padding: "6px 12px",
                          background: "rgba(15, 23, 42, 0.9)",
                          border: "1px solid rgba(129, 140, 248, 0.4)",
                          borderRadius: "10px",
                          color: "#e0e7ff",
                          fontSize: "13px",
                          fontWeight: "600",
                          cursor: "pointer",
                          backdropFilter: "blur(12px)"
                        }}
                      >
                        <option value="operator">Operator</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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

      <div style={{
        padding: "16px",
        textAlign: "center",
        color: "#94a3b8",
        fontSize: "14px",
        fontWeight: "600"
      }}>
        👥 Total Users: {users.length} | Showing: {currentUsers.length} on this page
      </div>
    </div>
  );
}

const thStyle = {
  padding: "1rem 1.25rem",
  textAlign: "left",
  color: "#c4b5fd",
  fontWeight: "800",
  fontSize: "0.85rem",
  textTransform: "uppercase",
  letterSpacing: "1px"
};

const tdStyle = {
  padding: "1rem 1.25rem",
  color: "#e0e7ff",
  fontSize: "0.9rem",
  verticalAlign: "middle"
};