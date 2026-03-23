export const roleOptions = {
  team: {
    label: "Team",
    field: {
      name: "teamId",
      label: "Team ID",
      placeholder: "Enter your team id"
    },
    endpoint: "/api/auth/team/login"
  },
  admin: {
    label: "Admin",
    field: {
      name: "email",
      label: "Admin Email",
      placeholder: "admin@codeverse.com"
    },
    endpoint: "/api/auth/admin/login"
  }
};
