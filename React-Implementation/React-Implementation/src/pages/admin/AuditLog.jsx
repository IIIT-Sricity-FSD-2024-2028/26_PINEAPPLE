import React, { useState, useEffect, useMemo } from "react";
import { adminApi } from "../../services/adminApi";
import "./AuditLog.css";

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const fetchedLogs = await adminApi.getAuditLog();
      // Ensure we get an array
      let logsArray = [];
      if (Array.isArray(fetchedLogs)) logsArray = fetchedLogs;
      else if (fetchedLogs && Array.isArray(fetchedLogs.logs)) logsArray = fetchedLogs.logs;
      
      // Normalize and sort
      logsArray = logsArray.map((log, index) => ({
        id: String(log.id || log.correlationId || `audit-${index}`),
        type: String(log.type || "system").toLowerCase(),
        event: String(log.event || log.action || "Event"),
        actor: String(log.actor || log.user || log.ip || "System"),
        target: String(log.target || "-"),
        details: String(log.details || log.message || "-"),
        timestamp: log.timestamp || log.time || new Date().toISOString(),
      }));

      logsArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(logsArray);
    } catch (error) {
      console.error("Could not fetch audit logs:", error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getAuditTypeLabel = (type) => {
    const labels = {
      all: "All",
      task: "Task",
      xp: "XP",
      reputation: "Reputation",
      warning: "Warning",
      suspension: "Suspension",
      mentor: "Mentor",
      system: "System",
      request: "REQUEST",
      error: "ERROR",
    };
    return labels[type] || type.toUpperCase();
  };

  const getAuditTypeClass = (type) => {
    if (["task", "xp", "reputation", "warning", "suspension", "mentor", "system"].includes(type)) {
      return type;
    }
    if (type === "error") return "suspension";
    return "system";
  };

  const allTypes = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.type)));
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesType = activeFilter === "all" || log.type === activeFilter;
      if (!matchesType) return false;

      if (!query) return true;
      return (
        log.event.toLowerCase().includes(query) ||
        log.actor.toLowerCase().includes(query) ||
        log.target.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query)
      );
    });
  }, [logs, activeFilter, searchQuery]);

  return (
    <div className="admin-page">
      <h1>Audit Log</h1>
      <div className="admin-audit-head-row mt-1">
        <p className="page-subtitle">Immutable record of all significant platform events.</p>
        <span className="admin-audit-readonly">Read-only · Cannot be modified</span>
      </div>

      <div className="admin-audit-toolbar mt-3">
        <div className="admin-audit-search-wrap">
          <span className="admin-audit-search-icon">⌕</span>
          <input
            className="admin-audit-search"
            type="text"
            placeholder="Search events, actors, targets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="admin-audit-filters">
          <button
            className={`admin-audit-filter-chip ${activeFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveFilter("all")}
          >
            ALL ({logs.length})
          </button>
          {allTypes.map((type) => {
            const count = logs.filter((l) => l.type === type).length;
            return (
              <button
                key={type}
                className={`admin-audit-filter-chip ${activeFilter === type ? "active" : ""}`}
                onClick={() => setActiveFilter(type)}
              >
                {getAuditTypeLabel(type).toUpperCase()} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="admin-audit-count mt-2">
        {filteredLogs.length} event{filteredLogs.length === 1 ? "" : "s"} shown &nbsp;
        <button
          onClick={fetchLogs}
          className="refresh-btn"
        >
          Refresh
        </button>
      </div>

      <div className="admin-audit-table-wrap mt-2">
        {isLoading ? (
          <div className="admin-users-empty">Loading audit logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="admin-users-empty">No audit events found.</div>
        ) : (
          <table className="admin-audit-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <span className={`admin-audit-type ${getAuditTypeClass(entry.type)}`}>
                      {entry.type.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div className="admin-audit-event">{entry.event}</div>
                    <div className="admin-audit-time">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </td>
                  <td>{entry.actor}</td>
                  <td>{entry.target}</td>
                  <td>{entry.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
