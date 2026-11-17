// Regenerated from the Dev Hub by apps-sfdx/scripts/sfdx/docs-package-versions.mjs on every package release
import packageVersions from '@site/src/data/managed-package-versions.json';

interface PackageVersion {
  version: string;
  packageVersionId: string;
  releaseDate: string;
}

function getInstallUrl(loginHost: string, packageVersionId: string) {
  return `https://${loginHost}/packaging/installPackage.apexp?p0=${packageVersionId}`;
}

const InstallLinks = ({ packageVersionId }: Pick<PackageVersion, 'packageVersionId'>) => (
  <>
    <a href={getInstallUrl('login.salesforce.com', packageVersionId)} target="_blank" rel="noopener noreferrer">
      Production
    </a>
    {' · '}
    <a href={getInstallUrl('test.salesforce.com', packageVersionId)} target="_blank" rel="noopener noreferrer">
      Sandbox
    </a>
  </>
);

/** Released versions of Jetstream for Salesforce with install links, newest first */
export const ManagedPackageVersions = () => {
  const versions: PackageVersion[] = packageVersions;

  return (
    <table>
      <thead>
        <tr>
          <th>Version</th>
          <th>Released</th>
          <th>Install in</th>
          <th>Package version id</th>
        </tr>
      </thead>
      <tbody>
        {versions.map(({ version, packageVersionId, releaseDate }, i) => (
          <tr key={packageVersionId}>
            <td>
              {version}
              {i === 0 && <strong> (latest)</strong>}
            </td>
            <td>{releaseDate}</td>
            <td>
              <InstallLinks packageVersionId={packageVersionId} />
            </td>
            <td>
              <code>{packageVersionId}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ManagedPackageVersions;
