import { ArrowRightStartOnRectangleIcon, ChartBarIcon, PlusIcon, UserGroupIcon, UsersIcon } from '@heroicons/react/20/solid';
import { ADMIN_LOGOUT_PATH, AdminSessionUser } from '@jetstream/admin/types';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { apiPost, LOGIN_ROUTE, useApiQuery } from '../api/admin-api-client';
import { ButtonLink } from '../components/Button';
import { ErrorAlert } from '../components/ErrorAlert';
import { PageSpinner, Spinner } from '../components/Spinner';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { classNames } from '../utils/class-names';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', Icon: ChartBarIcon, end: true },
  { to: '/teams', label: 'Teams', Icon: UserGroupIcon, end: false },
  { to: '/users', label: 'Users', Icon: UsersIcon, end: false },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { data: adminUser, error, loading, reload } = useApiQuery<AdminSessionUser>('/api/me');
  const {
    run: signOut,
    loading: signingOut,
    error: signOutError,
  } = useAsyncAction(async () => {
    await apiPost(ADMIN_LOGOUT_PATH);
    return true;
  });

  // The session cookie is only cleared by a successful logout, so a failure must not look signed out
  async function handleSignOut() {
    if (await signOut()) {
      navigate(LOGIN_ROUTE);
    }
  }

  if (!adminUser) {
    if (error) {
      return (
        <div className="mx-auto max-w-lg p-8">
          <ErrorAlert error={error} title="Unable to load your admin session" onRetry={reload} />
        </div>
      );
    }
    if (loading) {
      return <PageSpinner />;
    }
  }

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          <span className="text-sm font-semibold text-slate-900">Jetstream Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                classNames(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium',
                  isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          <div className="mt-4 border-t border-slate-200 pt-4">
            <ButtonLink to="/teams/new" variant="primary" className="w-full">
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              Provision team
            </ButtonLink>
          </div>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 md:px-6">
          <nav className="flex gap-3 text-sm md:hidden">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => (isActive ? 'font-semibold text-slate-900' : 'text-slate-600')}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-600" title={adminUser?.name ?? undefined}>
              {adminUser?.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {signingOut ? <Spinner size="sm" /> : <ArrowRightStartOnRectangleIcon className="h-4 w-4" aria-hidden="true" />}
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6">
          <div className="mx-auto max-w-7xl">
            {signOutError && (
              <div className="mb-4">
                <ErrorAlert error={signOutError} title="Unable to sign out" onRetry={handleSignOut} />
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
