import axios from "axios";

const API = axios.create({
  baseURL: "https://luciagram-backend.onrender.com/api",
  timeout: 60000, // Render cold start ke liye
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

// Global 401 handler — token expire hone pe auto logout
API.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      // Auth context tak direct access nahi hai yahan
      // Event dispatch karo — AuthContext sun lega
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
    return Promise.reject(err);
  }
);

export default API;

let profileCache = {};
export const clearProfileCache = () => { profileCache = {}; };
export const getCachedProfile = async (username) => {
  if (profileCache[username] && Date.now() - profileCache[username].time < 5*60*1000) {
    return profileCache[username].data;
  }
  try {
    const res = await API.get("/users/" + username);
    profileCache[username] = { data: res.data, time: Date.now() };
    return res.data;
  } catch { return null; }
};
