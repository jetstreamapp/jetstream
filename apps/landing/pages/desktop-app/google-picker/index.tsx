import { GooglePickerContent } from '../../../components/GooglePickerContent';
import Layout from '../../../components/layouts/Layout';
import { useDesktopGooglePickerState } from '../../../hooks/desktop-google-picker.hooks';

export default function Page() {
  const pickerState = useDesktopGooglePickerState();
  return <GooglePickerContent {...pickerState} />;
}

Page.getLayout = function getLayout(page) {
  return <Layout title="Google Drive Picker | Jetstream">{page}</Layout>;
};
