// Example component showing how to use the proxy endpoints
// Import and use this as a reference in your components

import { useState, useEffect } from 'react';
import { getProxyClients, getMeterReportsByClient, getMeterReportsMultiple } from './api';

export function ClientsWithMeters() {
  const [clients, setClients] = useState([]);
  const [meterReports, setMeterReports] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all clients on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get all clients from proxy
        const clientsData = await getProxyClients();
        console.log('Clients data:', clientsData);
        
        setClients(clientsData.result || clientsData || []);
      } catch (err) {
        console.error('Error fetching clients:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch meter reports when clients load
  const handleGetMeterReports = async () => {
    try {
      if (clients.length === 0) {
        setError('No clients available');
        return;
      }

      // Get client IDs
      const clientIds = clients
        .map(c => c.id || c.ID)
        .filter(Boolean);

      if (clientIds.length === 0) {
        setError('Could not extract client IDs');
        return;
      }

      // Fetch meter reports for all clients at once
      const reports = await getMeterReportsMultiple(clientIds);
      console.log('Meter reports:', reports);
      
      setMeterReports(reports);
      setError(null);
    } catch (err) {
      console.error('Error fetching meter reports:', err);
      setError(err.message);
    }
  };

  // Fetch meter report for single client
  const handleGetSingleMeterReport = async (clientId) => {
    try {
      const report = await getMeterReportsByClient(clientId);
      console.log(`Meter report for client ${clientId}:`, report);
      
      setMeterReports(prev => ({
        ...prev,
        [clientId]: report
      }));
      setError(null);
    } catch (err) {
      console.error(`Error fetching meter report for client ${clientId}:`, err);
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Clients & Meter Reports</h1>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#fee',
          color: '#c00',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          Error: {error}
        </div>
      )}

      {loading ? (
        <p>Loading clients...</p>
      ) : (
        <>
          <h2>Clients ({clients.length})</h2>
          
          <button 
            onClick={handleGetMeterReports}
            style={{
              padding: '10px 20px',
              marginBottom: '20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Fetch All Meter Reports
          </button>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {clients.map(client => {
              const clientId = client.id || client.ID;
              return (
                <div 
                  key={clientId}
                  style={{
                    border: '1px solid #ddd',
                    padding: '15px',
                    borderRadius: '8px',
                    backgroundColor: '#f9f9f9'
                  }}
                >
                  <h3>{client.name || client.NAME}</h3>
                  <p><strong>ID:</strong> {clientId}</p>
                  {client.email && <p><strong>Email:</strong> {client.email}</p>}
                  
                  <button
                    onClick={() => handleGetSingleMeterReport(clientId)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginTop: '10px'
                    }}
                  >
                    Get Meter Reports
                  </button>

                  {meterReports[clientId] && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px',
                      backgroundColor: '#e8f5e9',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      <strong>Meter Reports:</strong>
                      <pre style={{ overflow: 'auto', maxHeight: '150px' }}>
                        {JSON.stringify(meterReports[clientId], null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Export as default
export default ClientsWithMeters;
