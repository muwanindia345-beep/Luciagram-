import axios from "axios";

const CLOUD_URL = "https://luciagram-backend.onrender.com/api";
const LOCAL_URL = "http://localhost:8890/api";

let currentBase = navigator.onLine ? CLOUD_URL : LOCAL_URL;

window.addEventListener("online", () => {
  const wasCloud = currentBase === CLOUD_URL;
  currentBase = CLOUD_URL;
  if (!wasCloud) console.log("[Muwan] Network switched -> " + currentBase);
});

window.addEventListener("offline", () => {
  const wasCloud = currentBase === CLOUD_URL;
  currentBase = LOCAL_URL;
  if (wasCloud) console.log("[Muwan] Network switched -> " + currentBase);
});

const API = axios.create({
  timeout: 15000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

API.interceptors.request.use(config => {
  config.baseURL = currentBase;
  return config;
});

API.interceptors.response.use(
  res => res,
  async err => {
    if (err.code === "ECONNREFUSED" && currentBase === LOCAL_URL) {
      console.log("[Muwan] Local failed, falling back to cloud...");
      currentBase = CLOUD_URL;
      err.config.baseURL = CLOUD_URL;
      return axios(err.config);
    }
    if (err.response?.status === 401) {
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
