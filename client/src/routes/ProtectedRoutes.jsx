import { Navigate } from "react-router-dom";
import { getAuthSession } from "../api/session";

const RoleRoute = ({ children, allowedRole }) => {
  const { token, role } = getAuthSession();

  if (!token || role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export const AdminRoute = ({ children }) => (
  <RoleRoute allowedRole="admin">{children}</RoleRoute>
);

export const TeamRoute = ({ children }) => (
  <RoleRoute allowedRole="team">{children}</RoleRoute>
);
