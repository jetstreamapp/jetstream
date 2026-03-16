import { GooglePickerContent } from '../../../components/GooglePickerContent';
import Layout from '../../../components/layouts/Layout';
import { useWebExtensionGooglePickerState } from '../../../hooks/web-extension-google-picker.hooks';

export default function Page() {
  const pickerState = useWebExtensionGooglePickerState();
  return <GooglePickerContent {...pickerState} />;
}

Page.getLayout = function getLayout(page) {
  return <Layout title="Google Drive Picker | Jetstream">{page}</Layout>;
};
