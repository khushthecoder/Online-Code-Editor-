import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidV4 } from "uuid";
import toast from "react-hot-toast";
import "./HomePage.css";

const HomePage = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomId.trim()) {
      toast.error("Please enter a Room ID");
      return;
    }
    navigate(`/editor/${roomId}`);
  };

  const handleCreate = async () => {
    try {
      const newRoomId = uuidV4();
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.post(
        "http://localhost:5001/api/room/create",
        { roomId: newRoomId },
        config,
      );
      toast.success("New room created!");
      navigate(`/editor/${newRoomId}`);
    } catch (error) {
      console.error("Error creating room", error);
      toast.error("Failed to create room. Please try again.");
    }
  };

  return (
    <div className="homePageWrapper">
      <h1 className="headerTitle">
        Compile<span>X</span>
      </h1>

      <div className="formWrapper">
        <h2>Join a Room</h2>
        <form onSubmit={handleJoin} className="inputBox">
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter Room ID"
          />
          <button type="submit" className="btn joinBtn">
            Join
          </button>
        </form>
      </div>

      <button onClick={handleCreate} className="btn createBtn">
        Create a New Room
      </button>

      <div className="logoutBox">
        <button className="btn logoutBtn" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default HomePage;
