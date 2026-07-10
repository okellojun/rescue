import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RescueRoute — Real-Time Disaster Relief Canvas',
  description:
    'A real-time, hyper-local disaster relief and mutual aid canvas. Frictionless UX under panic.',
  themeColor: '#020617',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            style: {
              background: 'rgb(15 23 42)',
              border: '1px solid rgb(30 41 59)',
              color: 'rgb(248 250 252)',
            },
          }}
        />
      </body>
    </html>
  );
}
