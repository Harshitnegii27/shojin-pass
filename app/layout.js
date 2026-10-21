export const metadata = { title: 'Shojin Pass' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#fff', color: '#111' }}>{children}</body>
    </html>
  );
}
