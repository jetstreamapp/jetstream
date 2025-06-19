import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Alert from '../../../components/Alert';
import { MfaEnrollment } from '../../../components/auth/MfaEnrollment';
import Layout from '../../../components/layouts/Layout';
import { useCsrfToken, useOtpEnrollment } from '../../../hooks/auth.hooks';
import { SIGN_IN_ERRORS } from '../../../utils/environment';

export default function Page() {
  const router = useRouter();
  const { csrfToken, isLoadingCsrfToken } = useCsrfToken();
  const { error, fetchEnrollmentData, isLoading: isLoadingMfa, otp2fa, submitEnrollmentData } = useOtpEnrollment(true);

  const isLoading = isLoadingCsrfToken || isLoadingMfa;

  useEffect(() => {
    fetchEnrollmentData();
  }, [fetchEnrollmentData]);

  useEffect(() => {
    if (isLoading) {
      return;
    }
  }, [isLoading, router]);

  if (error) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert message={SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.default} />
      </div>
    );
  }

  if (isLoading || !csrfToken || !otp2fa) {
    return null;
  }

  return <MfaEnrollment csrfToken={csrfToken} otp2fa={otp2fa} onSaveOtpFactor={submitEnrollmentData} />;
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Verify Authentication | Jetstream" omitFooter omitNavigation>
      {page}
    </Layout>
  );
};
