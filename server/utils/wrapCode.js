const safeJsonParse = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const serializeInputLiteral = (input) => {
  const parsed = safeJsonParse(input);
  return JSON.stringify(parsed ?? String(input ?? ""));
};

export const wrapCode = (userCode, input, options = {}) => {
  const { wrapperTemplate = "" } = options;

  if (!userCode || !String(userCode).trim()) {
    return "";
  }

  if (!wrapperTemplate || typeof wrapperTemplate !== "string") {
    return userCode;
  }

  const inputLiteral = serializeInputLiteral(input);
  const withUserCode = wrapperTemplate.includes("{{USER_CODE}}")
    ? wrapperTemplate.replaceAll("{{USER_CODE}}", userCode)
    : `${userCode}\n\n${wrapperTemplate}`;

  return withUserCode.replaceAll("{{INPUT}}", inputLiteral);
};
