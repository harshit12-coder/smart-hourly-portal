// Admin.js - PREMIUM MOBILE-APP LIKE & FULLY RESPONSIVE VERSION
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 12; // Slightly more on mobile for better feel

  async function loadUsers() {
    setLoading(true);

    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("id, role");

    if (rolesError) {
      alert("Error loading roles: " + rolesError.message);
      setLoading(false);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, name, department, phone");

    if (profilesError) {
      alert("Error loading profiles: " + profilesError.message);
      setLoading(false);
      return;
    }

    const { data: { user: currentAuthUser } } = await supabase.auth.getUser();

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
    <div className="admin-container">
      <h1 className="admin-title">SmartHourly User Management</h1>

      {/* SEARCH BAR */}
      <div className="search-container">
        <input
          type="text"
          placeholder="🔍 Search by name, email, department or phone..."
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="search-input"
        />
      </div>

      {/* MAIN CONTENT */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading users...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="empty-state">
          <span>📋 No users found</span>
        </div>
      ) : (
        <>
          {/* USER LIST - CARD VIEW (MOBILE + TABLET) */}
          <div className="users-list">
            {currentUsers.map(u => (
              <div key={u.id} className="user-card">
                <div className="user-header">
                  <div className="user-info">
                    <h3 className="user-name">
                      {u.name}
                      {u.isCurrentUser && <span className="you-tag">(You)</span>}
                    </h3>
                    <p className="user-email">{u.email}</p>
                  </div>
                  <span className={`role-badge ${u.role}`}>
                    {u.role.toUpperCase()}
                  </span>
                </div>

                <div className="user-details">
                  <div className="detail-item">
                    <span className="label">Department</span>
                    <span className="value">{u.department}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Phone</span>
                    <span className="value">{u.phone}</span>
                  </div>
                </div>

                <div className="role-change">
                  <label>Change Role</label>
                  <select
                    value={u.role}
                    onChange={e => changeRole(u.id, e.target.value)}
                    className="role-select"
                  >
                    <option value="operator">Operator</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className="page-btn"
          >
            Previous
          </button>

          <span className="page-info">
            Page <strong>{currentPage}</strong> of {totalPages}
          </span>

          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="page-btn"
          >
            Next
          </button>
        </div>
      )}

      {/* FOOTER INFO */}
      <div className="footer-info">
        👥 Total Users: <strong>{users.length}</strong> | 
        Showing: <strong>{currentUsers.length}</strong> on this page
      </div>

      <style>{globalStyles}</style>
    </div>
  );
}

/* PREMIUM MOBILE-FIRST GLASSMORPHISM CSS */
const globalStyles = `
  :root {
    --bg-gradient: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    --glass-bg: rgba(30, 41, 59, 0.85);
    --glass-border: rgba(129, 140, 248, 0.25);
    --input-bg: rgba(15, 23, 42, 0.9);
    --input-border: rgba(129, 140, 248, 0.3);
    --text-primary: #e0e7ff;
    --text-secondary: #94a3b8;
    --accent-purple: #818cf8;
    --accent-blue: #60a5fa;
  }

  * { box-sizing: border-box; }

  .admin-container {
    min-height: 100vh;
    width: 100vw;
    background: 
      radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.25), transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(120, 219, 255, 0.25), transparent 50%),
      var(--bg-gradient);
    padding: clamp(16px, 4vw, 24px);
    color: var(--text-primary);
    font-family: system-ui, -apple-system, sans-serif;
  }

  .admin-title {
    text-align: center;
    font-size: clamp(1.8rem, 5vw, 2.2rem);
    font-weight: 900;
    margin: 0 0 28px;
    background: linear-gradient(90deg, #c7d2fe, #818cf8, #60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.5px;
  }

  .search-container {
    max-width: 600px;
    margin: 0 auto 28px auto;
  }

  .search-input {
    width: 100%;
    padding: clamp(14px, 3.5vw, 18px) 20px;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    border-radius: 20px;
    color: var(--text-primary);
    font-size: clamp(15px, 3.5vw, 17px);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    outline: none;
    transition: all 0.3s ease;
    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
  }

  .search-input::placeholder {
    color: #64748b;
  }

  .search-input:focus {
    border-color: #818cf8;
    box-shadow: 0 0 32px rgba(129, 140, 248, 0.35);
    transform: translateY(-2px);
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
    padding: 80px 20px;
    background: rgba(129,140,248,0.08);
    border: 2px dashed rgba(129,140,248,0.3);
    border-radius: 28px;
    color: #818cf8;
    font-size: clamp(1.2rem, 4vw, 1.5rem);
    font-weight: 700;
    margin: 20px 0;
  }

  .users-list {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 1000px;
    margin: 0 auto;
  }

  .user-card {
    background: var(--glass-bg);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border-radius: 24px;
    padding: clamp(18px, 4vw, 24px);
    border: 1px solid var(--glass-border);
    box-shadow: 0 20px 50px rgba(0,0,0,0.4);
    animation: fadeUp 0.5s ease both;
    transition: transform 0.3s ease;
  }

  .user-card:hover {
    transform: translateY(-4px);
  }

  .user-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
  }

  .user-info {
    flex: 1;
  }

  .user-name {
    font-size: clamp(1.1rem, 3.5vw, 1.3rem);
    font-weight: 800;
    color: #c4b5fd;
    margin: 0 0 6px 0;
  }

  .you-tag {
    color: #60a5fa;
    font-size: 0.8rem;
    margin-left: 8px;
    font-weight: 600;
  }

  .user-email {
    color: #a78bfa;
    font-size: clamp(0.9rem, 3vw, 1rem);
    margin: 0;
  }

  .role-badge {
    padding: 8px 16px;
    border-radius: 16px;
    font-weight: 700;
    font-size: 0.8rem;
    text-transform: uppercase;
  }

  .role-badge.admin {
    background: rgba(167, 139, 250, 0.3);
    color: #c4b5fd;
    border: 1px solid rgba(196, 181, 253, 0.3);
  }

  .role-badge.supervisor {
    background: rgba(34, 197, 94, 0.3);
    color: #86efac;
    border: 1px solid rgba(134, 239, 172, 0.3);
  }

  .role-badge.operator {
    background: rgba(59, 130, 246, 0.3);
    color: #93c5fd;
    border: 1px solid rgba(147, 197, 253, 0.3);
  }

  .user-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    padding: 16px 0;
    border-top: 1px solid rgba(129, 140, 248, 0.15);
    border-bottom: 1px solid rgba(129, 140, 248, 0.15);
    margin-bottom: 20px;
  }

  .detail-item .label {
    display: block;
    color: var(--text-secondary);
    font-size: 0.85rem;
    margin-bottom: 4px;
    font-weight: 600;
  }

  .detail-item .value {
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 600;
  }

  .role-change {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .role-change label {
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .role-select {
    padding: clamp(12px, 3vw, 16px) 16px;
    background: var(--input-bg);
    border: 1.5px solid var(--input-border);
    border-radius: 16px;
    color: var(--text-primary);
    font-size: clamp(15px, 3.2vw, 16px);
    font-weight: 600;
    cursor: pointer;
    backdrop-filter: blur(12px);
    transition: all 0.3s ease;
  }

  .role-select:focus {
    border-color: #818cf8;
    box-shadow: 0 0 24px rgba(129, 140, 248, 0.3);
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
    transition: all 0.3s ease;
    min-width: 120px;
  }

  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    color: #64748b;
  }

  .page-btn:not(:disabled):hover {
    background: rgba(129, 140, 248, 0.2);
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(129, 140, 248, 0.2);
  }

  .page-info {
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 15px;
  }

  .page-info strong {
    color: #c4b5fd;
  }

  .footer-info {
    text-align: center;
    padding: 20px 0 40px;
    color: var(--text-secondary);
    font-size: 15px;
    font-weight: 600;
  }

  .footer-info strong {
    color: #c4b5fd;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Tablet & Desktop Enhancements */
  @media (min-width: 768px) {
    .user-details {
      grid-template-columns: repeat(4, 1fr);
    }
    
    .role-change {
      flex-direction: row;
      align-items: center;
    }
    
    .role-select {
      flex: 1;
      max-width: 300px;
    }
  }

  @media (min-width: 1024px) {
    .admin-container {
      padding: 40px;
    }
    
    .users-list {
      gap: 24px;
    }
    
    .user-card:hover {
      box-shadow: 0 30px 80px rgba(0,0,0,0.5);
    }
  }
`;