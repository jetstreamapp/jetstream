import { GooglePickerContent } from '../../../components/GooglePickerContent';
import Layout from '../../../components/layouts/Layout';
import { useExternalGooglePickerState } from '../../../hooks/external-google-picker.hooks';

export default function Page() {
  const pickerState = useExternalGooglePickerState();
  return <GooglePickerContent {...pickerState} />;
}

Page.getLayout = function getLayout(page) {
  return <Layout title="Google Drive Picker | Jetstream">{page}</Layout>;
};
