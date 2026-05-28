import axios from "axios";
const API = axios.create({
  baseURL: "https://luciagram-backend.onrender.com/api",
  timeout: 15000, // 15 second timeout
  headers: { "Content-Type": "application/json" }
});
API.interceptors.request.use((req) => { const token = localStorage.getItem("token"); if (token) req.headers.Authorization = "Bearer " + token; return req; });
export default API;

// Simple in-memory cache for profile data
const profileCache = {};
export const getCachedProfile = async (username) => {
  if (profileCache[username] && Date.now() - profileCache[username].time < 5 * 60 * 1000) {
    return profileCache[username].data;
  }
  try {
    const res = await API.get("/users/" + username);
    profileCache[username] = { data: res.data, time: Date.now() };
    return res.data;
  } catch { return null; }
};

// LuciaStore media loader
const mediaCache = {};

export const loadMedia = async (mediaId, mediaType) => {
  if (!mediaId) return null;
  if (mediaCache[mediaId]) return mediaCache[mediaId];
  try {
    const res = await API.get("/media/" + mediaId);
    mediaCache[mediaId] = res.data.url;
    return res.data.url;
  } catch {
    return null;
  }
};
