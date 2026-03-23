import httpClient from "./httpClient";

export const loginTeam = async (payload) => {
  try {
    const { data } = await httpClient.post("/api/auth/team/login", payload);
    return data;
  } catch (error) {
    // Backward compatibility for servers still exposing /api/auth/login.
    if (error?.response?.status === 404) {
      const { data } = await httpClient.post("/api/auth/login", payload);
      return data;
    }
    throw error;
  }
};

export const loginAdmin = async (payload) => {
  const { data } = await httpClient.post("/api/auth/admin/login", payload);
  return data;
};

export const logoutUser = async () => {
  const { data } = await httpClient.post("/api/auth/logout");
  return data;
};

export const getCurrentUser = async () => {
  const { data } = await httpClient.get("/api/auth/me");
  return data;
};
