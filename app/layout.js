// Root layout for every page: the app screens in app/(screens) and the /dev console.
// Self-hosted fonts (no Google Fonts call at build or runtime); system-ui stays the fallback.
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/inter';
import '@fontsource/noto-serif-jp/japanese-400.css';
import '@fontsource/noto-serif-jp/japanese-700.css';
import './globals.css';

export const metadata = {
  title: { default: 'Shojin Pass — Japan is made for us', template: '%s · Shojin Pass' },
  applicationName: 'Shojin Pass',
  description: 'Scan any Japanese label or menu and know if you can eat it — vegetarian, eggless or Jain. Curated Shojin Routes through Kyoto’s temple cuisine.',
  openGraph: { title: 'Shojin Pass 精進パス', description: 'A food-trust layer for Indian travellers in Japan.' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
