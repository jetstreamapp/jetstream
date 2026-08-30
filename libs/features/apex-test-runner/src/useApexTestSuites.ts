import { getErrorMessage } from '@jetstream/shared/utils';
import type { ApexTestSuiteRecord, SalesforceOrgUi, TestSuiteMembershipRecord } from '@jetstream/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createTestSuite,
  deleteTestSuite,
  fetchTestSuiteMemberships,
  fetchTestSuites,
  renameTestSuite,
  updateTestSuiteMembership,
} from './apex-test-runner-data.utils';

export function useApexTestSuites(org: SalesforceOrgUi, apiVersion: string) {
  const isMounted = useRef(true);
  const [suites, setSuites] = useState<ApexTestSuiteRecord[]>([]);
  const [memberships, setMemberships] = useState<TestSuiteMembershipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadSuites = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const [suiteRecords, membershipRecords] = await Promise.all([fetchTestSuites(org), fetchTestSuiteMemberships(org)]);
      if (isMounted.current) {
        setSuites(suiteRecords);
        setMemberships(membershipRecords);
        setLoading(false);
      }
    } catch (ex) {
      if (isMounted.current) {
        setErrorMessage(getErrorMessage(ex));
        setLoading(false);
      }
    }
  }, [org]);

  useEffect(() => {
    setSuites([]);
    setMemberships([]);
    loadSuites();
  }, [loadSuites]);

  const membershipsBySuiteId = useMemo(() => {
    const bySuiteId = new Map<string, TestSuiteMembershipRecord[]>();
    for (const membership of memberships) {
      const existing = bySuiteId.get(membership.ApexTestSuiteId);
      if (existing) {
        existing.push(membership);
      } else {
        bySuiteId.set(membership.ApexTestSuiteId, [membership]);
      }
    }
    return bySuiteId;
  }, [memberships]);

  const createSuite = useCallback(
    async (testSuiteName: string) => {
      const suiteId = await createTestSuite(org, testSuiteName);
      await loadSuites();
      return suiteId;
    },
    [org, loadSuites],
  );

  const renameSuite = useCallback(
    async (suiteId: string, testSuiteName: string) => {
      await renameTestSuite(org, suiteId, testSuiteName);
      await loadSuites();
    },
    [org, loadSuites],
  );

  const removeSuite = useCallback(
    async (suiteId: string) => {
      await deleteTestSuite(org, suiteId);
      await loadSuites();
    },
    [org, loadSuites],
  );

  /** Replace a suite's membership with the provided class ids, applied as a diff */
  const saveSuiteMembership = useCallback(
    async (suiteId: string, classIds: Set<string>) => {
      const currentMemberships = membershipsBySuiteId.get(suiteId) ?? [];
      const currentClassIds = new Set(currentMemberships.map(({ ApexClassId }) => ApexClassId));
      const addClassIds = Array.from(classIds).filter((classId) => !currentClassIds.has(classId));
      const removeMembershipIds = currentMemberships.filter(({ ApexClassId }) => !classIds.has(ApexClassId)).map(({ Id }) => Id);
      await updateTestSuiteMembership(org, apiVersion, suiteId, { addClassIds, removeMembershipIds });
      await loadSuites();
    },
    [org, apiVersion, membershipsBySuiteId, loadSuites],
  );

  return { suites, membershipsBySuiteId, loading, errorMessage, loadSuites, createSuite, renameSuite, removeSuite, saveSuiteMembership };
}
