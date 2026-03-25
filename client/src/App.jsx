import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./pages/LandingPage";

import AdminLayout from "./layouts/AdminLayout";
import DashboardPage from "./pages/admin/DashboardPage";
import TeamsPage from "./pages/admin/TeamsPage";
import QuestionsPage from "./pages/admin/QuestionsPage";
import LeaderboardPage from "./pages/admin/LeaderboardPage";
import EventControlPage from "./pages/admin/EventControlPage";
import LifelinePage from "./pages/admin/LifelinePage";

import TeamLayout from "./layouts/TeamLayout";
import TeamDashboard from "./pages/team/TeamDashboard";
import Round1Page from "./pages/team/Round1Page";
import Round1TermsPage from "./pages/team/Round1TermsPage";
import Round1ArenaPage from "./pages/team/Round1ArenaPage";
import Round1ResultPage from "./pages/team/Round1ResultPage";
import Round2Page from "./pages/team/Round2Page";
import Round2TermsPage from "./pages/team/Round2TermsPage";
import Round2ArenaPage from "./pages/team/Round2ArenaPage";
import Round2ResultPage from "./pages/team/Round2ResultPage";
import Round3Page from "./pages/team/Round3Page";
import Round3TermsPage from "./pages/team/round3/Round3TermsPage";
import Round3LanguagePage from "./pages/team/round3/Round3LanguagePage";
import Round3ArenaPage from "./pages/team/round3/Round3ArenaPage";
import Round3ResultPage from "./pages/team/round3/Round3ResultPage";
import TeamLeaderboard from "./pages/team/TeamLeaderboard";
import { AdminRoute, TeamRoute } from "./routes/ProtectedRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="questions" element={<QuestionsPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="controls" element={<EventControlPage />} />
          <Route path="lifeline" element={<LifelinePage />} />
        </Route>

        <Route
          path="/team"
          element={
            <TeamRoute>
              <TeamLayout />
            </TeamRoute>
          }
        >
          <Route index element={<TeamDashboard />} />
          <Route path="round1" element={<Round1Page />}>
            <Route index element={<Round1TermsPage />} />
            <Route path="terms" element={<Round1TermsPage />} />
            <Route path="arena" element={<Round1ArenaPage />} />
            <Route path="result" element={<Round1ResultPage />} />
          </Route>
          <Route path="round2" element={<Round2Page />}>
            <Route index element={<Navigate to="terms" replace />} />
            <Route path="terms" element={<Round2TermsPage />} />
            <Route path="arena" element={<Round2ArenaPage />} />
            <Route path="result" element={<Round2ResultPage />} />
          </Route>
          <Route path="round3" element={<Round3Page />}>
            <Route index element={<Navigate to="terms" replace />} />
            <Route path="terms" element={<Round3TermsPage />} />
            <Route path="language" element={<Round3LanguagePage />} />
            <Route path="arena" element={<Round3ArenaPage />} />
            <Route path="result" element={<Round3ResultPage />} />
            <Route path="editor" element={<Navigate to="../arena" replace />} />
          </Route>
          <Route path="leaderboard" element={<TeamLeaderboard />} />
        </Route>
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
