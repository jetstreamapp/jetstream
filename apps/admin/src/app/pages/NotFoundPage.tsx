import { ButtonLink } from '../components/Button';
import { EmptyState } from '../components/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you are looking for does not exist."
      action={
        <ButtonLink to="/" variant="secondary">
          Back to dashboard
        </ButtonLink>
      }
    />
  );
}
