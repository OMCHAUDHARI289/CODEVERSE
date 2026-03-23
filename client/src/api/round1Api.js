import httpClient from "./httpClient";

const ROUND1_BASE = "/api/round/round1";

export const getRound1Status = async () => {
  const { data } = await httpClient.get(`${ROUND1_BASE}/status`);
  return data;
};

export const startRound1 = async () => {
  const { data } = await httpClient.post(`${ROUND1_BASE}/start`);
  return data;
};

export const getRound1Questions = async () => {
  const { data } = await httpClient.get(`${ROUND1_BASE}/questions`);
  return data;
};

export const submitRound1 = async (payload) => {
  const { data } = await httpClient.post(`${ROUND1_BASE}/submit`, payload);
  return data;
};

export const addRound1Warning = async (payload = {}) => {
  const { data } = await httpClient.post(`${ROUND1_BASE}/warn`, payload);
  return data;
};
