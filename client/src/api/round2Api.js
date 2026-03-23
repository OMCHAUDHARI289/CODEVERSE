import httpClient from "./httpClient";

const ROUND2_BASE = "/api/round/round2";

export const getRound2Result = async () => {
  const { data } = await httpClient.get(`${ROUND2_BASE}/result`);
  return data;
};

export const startRound2SubA = async (payload) => {
  const { data } = await httpClient.post(`${ROUND2_BASE}/start-subA`, payload);
  return data;
};

export const submitRound2SubA = async (payload) => {
  const { data } = await httpClient.post(`${ROUND2_BASE}/submit-subA`, payload);
  return data;
};

export const startRound2SubB = async (payload) => {
  const { data } = await httpClient.post(`${ROUND2_BASE}/start-subB`, payload);
  return data;
};

export const submitRound2SubB = async (payload) => {
  const { data } = await httpClient.post(`${ROUND2_BASE}/submit-subB`, payload);
  return data;
};
