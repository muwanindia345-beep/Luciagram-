import axios from "axios";
const API = axios.create({ baseURL: "https://luciagram-backend.onrender.com/api" });
API.interceptors.request.use((req) => { const token = localStorage.getItem("token"); if (token) req.headers.Authorization = "Bearer " + token; return req; });
export default API;

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
