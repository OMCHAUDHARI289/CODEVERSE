import httpClient from "./httpClient";

export const getDashboardSummary = async () => {
  const { data } = await httpClient.get("/api/admin/dashboard-summary");
  return data;
};

export const getTeamMonitor = async (params = {}) => {
  const { data } = await httpClient.get("/api/admin/team-monitor", {
    params
  });
  return data;
};

export const getAdminLeaderboard = async (params = {}) => {
  const { data } = await httpClient.get("/api/admin/leaderboard", {
    params
  });
  return data;
};

export const getAdminQuestions = async (params = {}) => {
  const { data } = await httpClient.get("/api/admin/questions", {
    params
  });
  return data;
};

export const getLifelineRequests = async (status = "pending") => {
  const { data } = await httpClient.get("/api/admin/lifeline-requests", {
    params: { status }
  });
  return data;
};

export const approveLifelineRequest = async (requestId, note = "") => {
  const { data } = await httpClient.patch(`/api/admin/lifeline-requests/${requestId}/approve`, {
    note
  });
  return data;
};

export const rejectLifelineRequest = async (requestId, note = "") => {
  const { data } = await httpClient.patch(`/api/admin/lifeline-requests/${requestId}/reject`, {
    note
  });
  return data;
};
