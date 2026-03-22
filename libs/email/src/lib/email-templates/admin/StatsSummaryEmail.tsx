import { Body, Container, Head, Heading, Html, Preview, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

export interface PlatformStats {
  activeSessions: number;
  newUsersLast7d: number;
  newUsersLast30d: number;
  newUsersYtd: number;
  activeUsersLast7d: number;
  salesforceOrgsTotal: number;
  salesforceOrgsNew7d: number;
  salesforceOrgsNew30d: number;
  payingIndividualUsers: number;
  payingTeams: number;
  passwordResetRequests7d: number;
}

export interface EnrichedSecurityCheckRow {
  ipAddress?: string | null;
  location?: string | null;
  [key: string]: unknown;
}

export interface SecurityCheckResult {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  rows: EnrichedSecurityCheckRow[];
}

export interface StatsSummaryEmailProps {
  stats: PlatformStats;
  securityResults: SecurityCheckResult[];
  generatedAt: string;
}

/** Colors used when a check HAS findings */
const FINDING_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#d97706',
};

const FINDING_BG: Record<'high' | 'medium' | 'low', string> = {
  high: '#fef2f2',
  medium: '#fffbeb',
  low: '#fffbeb',
};

/** Colors used when a check has NO findings */
const CLEAR_COLOR = '#16a34a';
const CLEAR_BG = '#f0fdf4';

/**
 * For the "Login Failure Rate" check, escalate severity based on the actual percentage:
 *   >15% → high (red), >7% → medium (yellow), otherwise keep original severity.
 */
function getEffectiveSeverity(result: SecurityCheckResult): 'high' | 'medium' | 'low' {
  if (result.title === 'Login Failure Rate (7 days)' && result.rows.length > 0) {
    const pct = parseFloat(String(result.rows[0].failureRatePct ?? '0'));
    if (pct > 15) {
      return 'high';
    }
    if (pct > 7) {
      return 'medium';
    }
  }
  return result.severity;
}

/** Formats a camelCase or snake_case key into a human-readable label */
function formatColumnLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

/** Gets the ordered display columns for a set of rows, always putting ipAddress + location first */
function getDisplayColumns(rows: EnrichedSecurityCheckRow[]): string[] {
  const allKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      allKeys.add(key);
    }
  }
  allKeys.delete('ipAddress');
  allKeys.delete('location');

  const ordered: string[] = [];
  if (rows.some((row) => 'ipAddress' in row)) {
    ordered.push('ipAddress');
  }
  if (rows.some((row) => 'location' in row)) {
    ordered.push('location');
  }
  ordered.push(...Array.from(allKeys));
  return ordered;
}

function renderCellValue(_key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return String(value);
}

export const StatsSummaryEmail = ({ stats, securityResults, generatedAt }: StatsSummaryEmailProps): React.ReactElement => {
  const hasAnySecurityFindings = securityResults.some((result) => result.rows.length > 0);

  const platformStatRows: Array<[string, string | number]> = [
    ['Active Sessions', stats.activeSessions],
    ['New Users (7 days)', stats.newUsersLast7d],
    ['New Users (30 days)', stats.newUsersLast30d],
    ['New Users (YTD)', stats.newUsersYtd],
    ['Active Users (7 days)', stats.activeUsersLast7d],
    ['Salesforce Orgs (total)', stats.salesforceOrgsTotal],
    ['Salesforce Orgs Connected (7 days)', stats.salesforceOrgsNew7d],
    ['Salesforce Orgs Connected (30 days)', stats.salesforceOrgsNew30d],
    ['Paying Individual Users', stats.payingIndividualUsers],
    ['Paying Teams', stats.payingTeams],
    ['Password Reset Requests (7 days)', stats.passwordResetRequests7d],
  ];

  return (
    <Html>
      <Head />
      <Preview>Jetstream Platform Stats — {generatedAt}</Preview>
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <EmailLogo />
          <Heading style={EMAIL_STYLES.title}>Platform Stats Summary</Heading>
          <Text style={subtitleText}>Generated {generatedAt}</Text>

          {/* Platform Stats Table */}
          <Section style={sectionStyle}>
            <Text style={sectionHeading}>Platform Stats</Text>
            <table style={tableStyle}>
              <tbody>
                {platformStatRows.map(([label, value]) => (
                  <tr key={label} style={tableRowStyle}>
                    <td style={tableLabelCell}>{label}</td>
                    <td style={tableValueCell}>{value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Security Section */}
          <Section style={sectionStyle}>
            <Text style={sectionHeading}>
              Security Checks{' '}
              {hasAnySecurityFindings ? (
                <span style={{ color: '#dc2626' }}>⚠ Findings Detected</span>
              ) : (
                <span style={{ color: '#16a34a' }}>✓ All Clear</span>
              )}
            </Text>

            {securityResults.map((result, index) => {
              const displayColumns = getDisplayColumns(result.rows);
              const hasFindings = result.rows.length > 0;
              const effectiveSeverity = getEffectiveSeverity(result);
              const bgColor = hasFindings ? FINDING_BG[effectiveSeverity] : CLEAR_BG;
              const badgeColor = hasFindings ? FINDING_COLOR[effectiveSeverity] : CLEAR_COLOR;

              return (
                <Section key={index} style={{ ...checkSectionStyle, backgroundColor: bgColor }}>
                  <Row>
                    <Text style={checkTitleStyle}>
                      <span style={{ color: badgeColor, fontWeight: 700 }}>[{result.severity.toUpperCase()}]</span> {result.title}
                    </Text>
                  </Row>
                  <Text style={checkDescriptionStyle}>{result.description}</Text>

                  {result.rows.length === 0 ? (
                    <Text style={noIssuesStyle}>✓ No issues found</Text>
                  ) : (
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          {displayColumns.map((col) => (
                            <th key={col} style={tableHeaderCell}>
                              {col === 'location' ? 'Location' : formatColumnLabel(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} style={tableRowStyle}>
                            {displayColumns.map((col) => (
                              <td key={col} style={tableDataCell}>
                                {renderCellValue(col, row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Section>
              );
            })}
          </Section>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default StatsSummaryEmail;

StatsSummaryEmail.PreviewProps = {
  generatedAt: new Date().toLocaleString(),
  stats: {
    activeSessions: 412,
    newUsersLast7d: 18,
    newUsersLast30d: 74,
    newUsersYtd: 312,
    activeUsersLast7d: 203,
    salesforceOrgsTotal: 1840,
    salesforceOrgsNew7d: 23,
    salesforceOrgsNew30d: 91,
    payingIndividualUsers: 87,
    payingTeams: 12,
    passwordResetRequests7d: 5,
  },
  securityResults: [
    {
      title: 'Brute Force — Failed Logins by IP (24h)',
      description: 'IPs with 10+ failed login attempts in the last 24 hours',
      severity: 'high',
      rows: [{ ipAddress: '1.2.3.4', location: 'Moscow, RU', failedAttempts: 47 }],
    },
    {
      title: 'CAPTCHA Failures by IP (24h)',
      description: 'IPs with 5+ CAPTCHA failures in the last 24 hours',
      severity: 'high',
      rows: [],
    },
    {
      title: 'Currently Locked Accounts',
      description: 'Accounts locked due to too many failed login attempts',
      severity: 'medium',
      rows: [{ email: 'user@example.com', failedLoginAttempts: 6, lockedUntil: '2026-03-11T14:30:00.000Z' }],
    },
    {
      title: 'Login Token Reuse (7 days)',
      description: 'Desktop or web extension login tokens that were reused',
      severity: 'high',
      rows: [],
    },
    {
      title: 'Login Failure Rate (7 days)',
      description: 'Overall login failure rate for the past 7 days',
      severity: 'low',
      rows: [],
    },
  ],
} as StatsSummaryEmailProps;

// Styles
const subtitleText: React.CSSProperties = {
  textAlign: 'center',
  color: '#6b7280',
  fontSize: 12,
  marginTop: 0,
};

const sectionStyle: React.CSSProperties = {
  marginTop: 24,
  marginBottom: 8,
};

const sectionHeading: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#111827',
  marginBottom: 8,
  marginTop: 0,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const tableRowStyle: React.CSSProperties = {
  borderBottom: '1px solid #e5e7eb',
};

const tableLabelCell: React.CSSProperties = {
  padding: '6px 8px',
  color: '#374151',
  fontWeight: 500,
  textAlign: 'left',
  width: '60%',
};

const tableValueCell: React.CSSProperties = {
  padding: '6px 8px',
  color: '#111827',
  fontWeight: 700,
  textAlign: 'right',
};

const tableHeaderCell: React.CSSProperties = {
  padding: '6px 8px',
  backgroundColor: '#f3f4f6',
  color: '#374151',
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'uppercase',
  textAlign: 'left',
  letterSpacing: '0.05em',
};

const tableDataCell: React.CSSProperties = {
  padding: '6px 8px',
  color: '#374151',
  fontSize: 12,
  textAlign: 'left',
  verticalAlign: 'top',
  wordBreak: 'break-word',
};

const checkSectionStyle: React.CSSProperties = {
  borderRadius: 4,
  padding: '10px 12px',
  marginBottom: 12,
  border: '1px solid #e5e7eb',
};

const checkTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#111827',
  margin: 0,
  marginBottom: 2,
};

const checkDescriptionStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  margin: 0,
  marginBottom: 8,
};

const noIssuesStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#16a34a',
  fontWeight: 600,
  margin: 0,
};
