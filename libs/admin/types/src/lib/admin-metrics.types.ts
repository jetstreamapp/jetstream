export interface DashboardSummary {
  totalUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  /** Distinct users with a successful LOGIN in the last 7 days */
  activeUsersLast7Days: number;
  activeWebSessions: number;
  activeWebSessionUsers: number;
  activeExternalSessions: number;
  totalTeams: number;
  activeTeams: number;
  payingUsers: number;
  payingTeams: number;
  salesforceOrgs: number;
  generatedAt: string;
}
