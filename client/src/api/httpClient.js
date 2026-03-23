import axios from "axios";
import { getAuthToken } from "./session";

const apiBase = import.meta.env.VITE_API_BASE || "";

const httpClient = axios.create({
  baseURL: apiBase,
  headers: {
    "Content-Type": "application/json"
  }
});

httpClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getApiErrorMessage = (error, fallback = "Something went wrong.") =>
  error?.response?.data?.message || error?.message || fallback;

export default httpClient;
