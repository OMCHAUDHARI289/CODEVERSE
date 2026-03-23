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
