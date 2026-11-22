import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
	title: 'M Labvox — MDigitalLab',
	description: 'Plateforme sécurisée de retranscription et rédaction automatisée de PV de CSE',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="fr">
			<body>{children}</body>
		</html>
	);
}
