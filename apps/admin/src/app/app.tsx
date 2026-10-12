import { BrowserRouter, Route, Routes } from 'react-router';
import { AppLayout } from './layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProvisionTeamPage } from './pages/provision-team/ProvisionTeamPage';
import { TeamDetailPage } from './pages/team-detail/TeamDetailPage';
import { TeamsPage } from './pages/TeamsPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { UsersPage } from './pages/UsersPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="teams/new" element={<ProvisionTeamPage />} />
          <Route path="teams/:teamId" element={<TeamDetailPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:userId" element={<UserDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
