const TOKEN_KEY = "codeverse_token";
const ROLE_KEY = "codeverse_role";
const USER_KEY = "codeverse_user";

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const getAuthRole = () => localStorage.getItem(ROLE_KEY);
export const getAuthSession = () => ({
  token: getAuthToken(),
  role: getAuthRole()
});
export const isAuthenticated = () => Boolean(getAuthToken());

export const setAuthSession = ({ token, role, user }) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  if (role) {
    localStorage.setItem(ROLE_KEY, role);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_KEY);
};
