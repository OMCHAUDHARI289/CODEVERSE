import httpClient from "./httpClient";

export const getEventStatus = async () => {
  const { data } = await httpClient.get("/api/event/status");
  return data;
};

export const getEventLeaderboard = async (params = {}) => {
  const { data } = await httpClient.get("/api/event/leaderboard", {
    params
  });
  return data;
};

export const setEventStatus = async (isLive) => {
  const { data } = await httpClient.put("/api/event/status", { isLive });
  return data;
};

export const startEvent = async () => setEventStatus(true);

export const stopEvent = async () => setEventStatus(false);

export const startLeaderboardReveal = async (intervalSeconds = 10) => {
  const { data } = await httpClient.put("/api/event/leaderboard-reveal/start", {
    intervalSeconds
  });
  return data;
};

export const revealNextLeaderboardTeam = async () => {
  const { data } = await httpClient.put("/api/event/leaderboard-reveal/next");
  return data;
};

export const completeLeaderboardReveal = async () => {
  const { data } = await httpClient.put("/api/event/leaderboard-reveal/complete");
  return data;
};

export const resetLeaderboardReveal = async () => {
  const { data } = await httpClient.put("/api/event/leaderboard-reveal/reset");
  return data;
};
