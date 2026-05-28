import axios from "axios";

const API = axios.create({
  baseURL: "https://luciagram-backend.onrender.com/api",
  timeout: 15000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

export default API;

const profileCache = {};
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
