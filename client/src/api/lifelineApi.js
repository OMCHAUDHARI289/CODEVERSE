import httpClient from "./httpClient";

const LIFELINE_BASE = "/api/lifeline";

export const getMyLifelineStatus = async (round = "round3") => {
  const { data } = await httpClient.get(`${LIFELINE_BASE}/status`, {
    params: { round }
  });
  return data;
};

export const markLifelineRoundStart = async (round = "round3") => {
  const { data } = await httpClient.post(`${LIFELINE_BASE}/round-start`, { round });
  return data;
};

export const requestLifeline = async (round = "round3") => {
  const { data } = await httpClient.post(`${LIFELINE_BASE}/request`, { round });
  return data;
};
