import React, { useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const DevHome = () => {
  const [resp, setResp] = useState(null);
  const [err, setErr] = useState(null);

  const ping = async () => {
    try {
      setErr(null);
      const r = await axios.get(`${API_URL}/api/ping`);
      
      setResp(r.data);
    } catch (e) {
      setErr(e.message || "Error");
      setResp(null);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Dev Home</h2>
      <p>This route helps verify CORS and routing quickly.</p>
      <button onClick={ping}>Ping Server</button>
      {resp && (
        <pre style={{ marginTop: 12 }}>{JSON.stringify(resp, null, 2)}</pre>
      )}
      {err && <pre style={{ marginTop: 12, color: "red" }}>{String(err)}</pre>}
    </div>
  );
};

export default DevHome;