import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { v4 as uuidV4 } from "uuid";
import toast from "react-hot-toast";

const HomePage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomId.trim()) {
      toast.error("Please enter a Room ID");
      return;
    }
    navigate(`/editor/${roomId.trim()}`);
  };

  const handleCreate = async () => {
    if (isCreating) return; // guard against double-submit creating two rooms
    setIsCreating(true);
    try {
      const newRoomId = uuidV4();
      await api.post("/api/room/create", { roomId: newRoomId });
      toast.success("New room created!");
      navigate(`/editor/${newRoomId}`);
    } catch (error) {
      console.error("Error creating room", error);
      toast.error("Failed to create room.");
      setIsCreating(false);
    }
  };

  return (
    <div className="authPageWrapper">

      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>

      <div className="authContent">
        <div className="brandHeader">
          <h1 className="brandLogo">Compile<span>X</span></h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "0.5rem" }}>
            Welcome back, <span style={{ color: "var(--text-primary)", fontWeight: "600" }}>{user?.username || "Guest"}</span>
          </p>
        </div>

        <div className="authCard">
          <h2 style={{ textAlign: "center", marginBottom: "1.5rem", fontSize: "1.4rem" }}>Join a Collaboration Room</h2>

          <form onSubmit={handleJoin}>
            <div className="inputGroup">
              <div className="inputIconWrapper">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter Room ID"
                  className="customInput"
                />
              </div>
            </div>

            <button type="submit" className="btn primaryBtn">
              Join Room
            </button>
          </form>

          <div className="orDivider">
            <span>OR</span>
          </div>

          <button onClick={handleCreate} disabled={isCreating} className="btn" style={{
            background: "transparent",
            border: "1px solid var(--accent-primary)",
            color: "var(--accent-primary)",
            opacity: isCreating ? 0.6 : 1,
            cursor: isCreating ? "not-allowed" : "pointer"
          }}>
            {isCreating ? "Creating…" : "Create New Room"}
          </button>

          <div className="formFooter">
            <button
              onClick={logout}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "0.9rem"
              }}
              onMouseOver={(e) => e.currentTarget.style.color = "var(--text-error, #ff4757)"}
              onMouseOut={(e) => e.currentTarget.style.color = "var(--text-muted)"}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;