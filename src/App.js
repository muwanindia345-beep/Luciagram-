import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Upload from "./pages/Upload";
import Profile from "./pages/Profile";
import Reels from "./pages/Reels";
import EditProfile from "./pages/EditProfile";
import Messages from "./pages/Messages";
import Chat from "./pages/Chat";
import Comments from "./pages/Comments";
import Search from "./pages/Search";
import UserProfile from "./pages/UserProfile";
import Settings from "./pages/Settings";
import GroupChat from "./pages/GroupChat";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/upload" element={<PrivateRoute><Upload /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/reels" element={<PrivateRoute><Reels /></PrivateRoute>} />
          <Route path="/edit-profile" element={<PrivateRoute><EditProfile /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
          <Route path="/chat/:userId" element={<PrivateRoute><Chat /></PrivateRoute>} />
          <Route path="/comments/:postId" element={<PrivateRoute><Comments /></PrivateRoute>} />
          <Route path="/search" element={<PrivateRoute><Search /></PrivateRoute>} />
          <Route path="/channels" element={<PrivateRoute><Channel /></PrivateRoute>} />
          <Route path="/groupchat" element={<PrivateRoute><GroupChat /></PrivateRoute>} />
          <Route path="/user/:username" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
