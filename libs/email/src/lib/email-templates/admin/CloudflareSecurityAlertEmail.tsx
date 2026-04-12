import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

export interface CloudflareAlertTotals {
  blocked: number;
  challenged: number;
  managed: number;
  total: number;
}

export interface CloudflareAlertSpikeInfo {
  currentCount: number;
  baselineMean: number;
  baselineStdev: number;
  zScore: number;
  thresholdStdev: number;
  minEvents: number;
}

export interface CloudflareAlertTopRule {
  ruleId: string | null;
  source: string | null;
  action: string;
  count: number;
}

export interface CloudflareAlertTopIp {
  ip: string;
  count: number;
  country: string | null;
  location: string | null;
}

export interface CloudflareAlertTopValue {
  value: string;
  count: number;
}

export interface CloudflareAlertZone {
  zoneId: string;
  label: string;
}

export interface CloudflareSecurityAlertEmailProps {
  mode: 'spike' | 'digest';
  generatedAt: string;
  windowDescription: string;
  zones: CloudflareAlertZone[];
  totals: CloudflareAlertTotals;
  spikeInfo?: CloudflareAlertSpikeInfo;
  topRules: CloudflareAlertTopRule[];
  topIps: CloudflareAlertTopIp[];
  topCountries: CloudflareAlertTopValue[];
  topHosts: CloudflareAlertTopValue[];
  topPaths: CloudflareAlertTopValue[];
}

const subtitleText: React.CSSProperties = {
  textAlign: 'center',
  color: '#6b7280',
  fontSize: 12,
  marginTop: 0,
};

const sectionStyle: React.CSSProperties = {
  marginTop: 20,
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

const tableHeaderCellRight: React.CSSProperties = {
  ...tableHeaderCell,
  textAlign: 'right',
};

const tableDataCell: React.CSSProperties = {
  padding: '6px 8px',
  color: '#374151',
  fontSize: 12,
  textAlign: 'left',
  verticalAlign: 'top',
  wordBreak: 'break-word',
};

const tableDataCellRight: React.CSSProperties = {
  ...tableDataCell,
  textAlign: 'right',
  fontWeight: 600,
};

const calloutBox: React.CSSProperties = {
  borderRadius: 4,
  padding: '10px 12px',
  marginBottom: 12,
  border: '1px solid #fca5a5',
  backgroundColor: '#fef2f2',
};

const calloutBoxDigest: React.CSSProperties = {
  ...calloutBox,
  border: '1px solid #bfdbfe',
  backgroundColor: '#eff6ff',
};

const calloutLabel: React.CSSProperties = {
  fontSize: 12,
  color: '#6b7280',
  margin: 0,
};

const calloutValue: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#111827',
  margin: 0,
};

const emptyStateStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#16a34a',
  fontWeight: 600,
  margin: 0,
  padding: '8px 12px',
  backgroundColor: '#f0fdf4',
  borderRadius: 4,
  border: '1px solid #bbf7d0',
};

function renderCount(count: number): string {
  return count.toLocaleString();
}

function renderCellText(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return value;
}

function TotalsTable({ totals }: { totals: CloudflareAlertTotals }): React.ReactElement {
  const rows: Array<[string, number]> = [
    ['Block', totals.blocked],
    ['Managed challenge', totals.managed],
    ['Challenge / JS challenge', totals.challenged],
    ['Total', totals.total],
  ];
  return (
    <table style={tableStyle}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} style={tableRowStyle}>
            <td style={tableLabelCell}>{label}</td>
            <td style={tableValueCell}>{renderCount(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SpikeCallout({ spikeInfo }: { spikeInfo: CloudflareAlertSpikeInfo }): React.ReactElement {
  return (
    <Section style={calloutBox}>
      <Text style={calloutLabel}>Current hour blocked + challenged + managed challenge events</Text>
      <Text style={calloutValue}>{renderCount(spikeInfo.currentCount)}</Text>
      <Text style={{ ...calloutLabel, marginTop: 8 }}>
        Baseline mean ± stdev (trailing 24h): {spikeInfo.baselineMean.toFixed(1)} ± {spikeInfo.baselineStdev.toFixed(1)}
      </Text>
      <Text style={calloutLabel}>
        Z-score {spikeInfo.zScore.toFixed(2)} · threshold ≥ {spikeInfo.thresholdStdev}σ · floor ≥ {spikeInfo.minEvents} events/hr
      </Text>
    </Section>
  );
}

function TopRulesTable({ rows }: { rows: CloudflareAlertTopRule[] }): React.ReactElement {
  if (rows.length === 0) {
    return <Text style={emptyStateStyle}>✓ No rule matches in this window</Text>;
  }
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={tableHeaderCell}>Rule ID</th>
          <th style={tableHeaderCell}>Source</th>
          <th style={tableHeaderCell}>Action</th>
          <th style={tableHeaderCellRight}>Count</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} style={tableRowStyle}>
            <td style={tableDataCell}>{renderCellText(row.ruleId)}</td>
            <td style={tableDataCell}>{renderCellText(row.source)}</td>
            <td style={tableDataCell}>{row.action}</td>
            <td style={tableDataCellRight}>{renderCount(row.count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TopIpsTable({ rows }: { rows: CloudflareAlertTopIp[] }): React.ReactElement {
  if (rows.length === 0) {
    return <Text style={emptyStateStyle}>✓ No blocked requests by client IP in this window</Text>;
  }
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={tableHeaderCell}>IP</th>
          <th style={tableHeaderCell}>Location</th>
          <th style={tableHeaderCellRight}>Count</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} style={tableRowStyle}>
            <td style={tableDataCell}>{row.ip}</td>
            <td style={tableDataCell}>{renderCellText(row.location || row.country)}</td>
            <td style={tableDataCellRight}>{renderCount(row.count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TopValueTable({ rows, label }: { rows: CloudflareAlertTopValue[]; label: string }): React.ReactElement {
  if (rows.length === 0) {
    return <Text style={emptyStateStyle}>✓ No data for {label} in this window</Text>;
  }
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={tableHeaderCell}>{label}</th>
          <th style={tableHeaderCellRight}>Count</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} style={tableRowStyle}>
            <td style={tableDataCell}>{renderCellText(row.value)}</td>
            <td style={tableDataCellRight}>{renderCount(row.count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const CloudflareSecurityAlertEmail = ({
  mode,
  generatedAt,
  windowDescription,
  zones,
  totals,
  spikeInfo,
  topRules,
  topIps,
  topCountries,
  topHosts,
  topPaths,
}: CloudflareSecurityAlertEmailProps): React.ReactElement => {
  const isSpike = mode === 'spike';
  const wideContainer: React.CSSProperties = {
    ...EMAIL_STYLES.container,
    width: '960px',
  };

  const headingText = isSpike ? '⚠ WAF Spike Detected' : 'WAF Daily Digest';
  const headingColor = isSpike ? '#dc2626' : '#111827';
  const previewText = isSpike
    ? `Cloudflare WAF spike detected — ${renderCount(totals.total)} events in ${windowDescription}`
    : `Cloudflare WAF daily digest — ${renderCount(totals.total)} events in ${windowDescription}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={EMAIL_STYLES.main}>
        <Container style={wideContainer}>
          <EmailLogo />
          <Heading style={{ ...EMAIL_STYLES.title, color: headingColor }}>{headingText}</Heading>
          <Text style={subtitleText}>
            {windowDescription} · generated {generatedAt}
          </Text>

          {isSpike && spikeInfo ? (
            <Section style={sectionStyle}>
              <Text style={sectionHeading}>Spike details</Text>
              <SpikeCallout spikeInfo={spikeInfo} />
            </Section>
          ) : (
            <Section style={sectionStyle}>
              <Section style={calloutBoxDigest}>
                <Text style={calloutLabel}>Total blocked / challenged / managed challenge events</Text>
                <Text style={calloutValue}>{renderCount(totals.total)}</Text>
              </Section>
            </Section>
          )}

          <Section style={sectionStyle}>
            <Text style={sectionHeading}>Totals by action</Text>
            <TotalsTable totals={totals} />
          </Section>

          <Section style={sectionStyle}>
            <Text style={sectionHeading}>Top rules</Text>
            <TopRulesTable rows={topRules} />
          </Section>

          <Section style={sectionStyle}>
            <Text style={sectionHeading}>Top client IPs</Text>
            <TopIpsTable rows={topIps} />
          </Section>

          <Section style={sectionStyle}>
            <Text style={sectionHeading}>Top countries</Text>
            <TopValueTable rows={topCountries} label="Country" />
          </Section>

          <Section style={sectionStyle}>
            <Text style={sectionHeading}>Top hosts</Text>
            <TopValueTable rows={topHosts} label="Host" />
          </Section>

          <Section style={sectionStyle}>
            <Text style={sectionHeading}>Top request paths</Text>
            <TopValueTable rows={topPaths} label="Path" />
          </Section>

          <Section style={sectionStyle}>
            <Text style={{ ...calloutLabel, textAlign: 'center' }}>
              Zones monitored: {zones.map((zone) => zone.label).join(', ') || '(none)'}
            </Text>
          </Section>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default CloudflareSecurityAlertEmail;

CloudflareSecurityAlertEmail.PreviewProps = {
  mode: 'spike',
  generatedAt: new Date().toLocaleString(),
  windowDescription: 'Last hour (UTC 14:00–15:00)',
  zones: [{ zoneId: 'abc123', label: 'getjetstream.app' }],
  totals: { blocked: 812, challenged: 140, managed: 203, total: 1155 },
  spikeInfo: {
    currentCount: 1155,
    baselineMean: 124.8,
    baselineStdev: 38.2,
    zScore: 26.96,
    thresholdStdev: 3,
    minEvents: 50,
  },
  topRules: [
    { ruleId: 'rl_bot_protection', source: 'firewallManaged', action: 'block', count: 512 },
    { ruleId: 'rl_waf_sqli', source: 'firewallManaged', action: 'block', count: 301 },
    { ruleId: null, source: 'securityLevel', action: 'managed_challenge', count: 203 },
  ],
  topIps: [
    { ip: '203.0.113.42', count: 412, country: 'RU', location: 'Moscow, RU' },
    { ip: '198.51.100.17', count: 188, country: 'CN', location: 'Beijing, CN' },
    { ip: '192.0.2.99', count: 94, country: 'BR', location: 'São Paulo, BR' },
  ],
  topCountries: [
    { value: 'RU', count: 512 },
    { value: 'CN', count: 301 },
    { value: 'BR', count: 140 },
  ],
  topHosts: [
    { value: 'getjetstream.app', count: 900 },
    { value: 'api.getjetstream.app', count: 255 },
  ],
  topPaths: [
    { value: '/login', count: 400 },
    { value: '/wp-admin.php', count: 230 },
    { value: '/.env', count: 110 },
  ],
} as CloudflareSecurityAlertEmailProps;
