import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://searomjf.github.io/gestao-de-custos/'),
  title: 'Gestão de Custos',
  description: 'Controle financeiro compartilhado, simples e acessível em qualquer dispositivo.',
  openGraph: {
    title: 'Gestão de Custos',
    description: 'Controle financeiro simples para sua casa.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gestão de Custos',
    description: 'Controle financeiro simples para sua casa.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

