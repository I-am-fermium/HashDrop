import '../styles/globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'HashDrop',
  description: 'Decentralized on-chain content publishing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-background text-primary font-mono">
      <body className="min-h-screen flex flex-col">
        <div className="flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}