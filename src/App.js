import React, { useEffect, useState } from "react";
import API from "./api";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from "react-router-dom";
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
import Notifications from "./pages/Notifications";
import GroupChat from "./pages/GroupChat";
import GroupChatRoom from "./pages/GroupChatRoom";
import BottomNav from "./components/BottomNav";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function NotifBadge() {
  const [count, setCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const res = await API.get("/notifications/unread");
        setCount(res.data.count || 0);
      } catch {}
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (!count) return null;
  return (
    <div style={{
      position: "fixed", top: 8, right: 8,
      background: "linear-gradient(135deg,#7c3aed,#db2777)",
      borderRadius: "50%", width: 20, height: 20,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "0.6rem", fontWeight: "bold", color: "white",
      zIndex: 9999, pointerEvents: "none"
    }}>
      {count > 99 ? "99+" : count}
    </div>
  );
}

function PageWrapper({ children }) {
  const location = useLocation();
  const navType = useNavigationType();
  const [cls, setCls] = useState("");

  useEffect(() => {
    setCls(navType === "POP" ? "page-back" : "page-enter");
    const t = setTimeout(() => setCls(""), 250);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return (
    <div className={cls} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}

const AUTH_PATHS = ["/login", "/register"];

function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const isAuth = AUTH_PATHS.includes(location.pathname);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <NotifBadge />
      <PageWrapper>
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
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/user/:username" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
          <Route path="/groupchat" element={<PrivateRoute><GroupChat /></PrivateRoute>} />
          <Route path="/group/:groupId" element={<PrivateRoute><GroupChatRoom /></PrivateRoute>} />
        </Routes>
      </PageWrapper>
      {!isAuth && user && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </AuthProvider>
  );
}
