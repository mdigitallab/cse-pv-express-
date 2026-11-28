import Link from 'next/link';

export default function MentionsLegalesPage() {
	return (
		<main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 p-6 md:p-12">
			<div className="max-w-3xl mx-auto bg-slate-900/90 backdrop-blur border border-slate-800 p-6 md:p-10 rounded-2xl shadow-2xl space-y-6">
				<div className="flex items-center justify-between border-b border-slate-800 pb-4">
					<h1 className="text-2xl md:text-3xl font-extrabold text-white">Mentions légales</h1>
					<Link href="/" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition">
						← Retour à M Lab Vox
					</Link>
				</div>

				<section className="space-y-2 text-sm text-slate-300 leading-relaxed">
					<h2 className="text-lg font-semibold text-white">1. Éditeur du service</h2>
					<p>
						Le service <strong>M Lab Vox</strong> est édité par <strong>Michel Bénard</strong>, entrepreneur individuel (micro-entreprise), exerçant sous le nom commercial <strong>M Digital Lab</strong>.
					</p>
					<ul className="list-disc pl-5 space-y-1 text-slate-300">
						<li><strong>Adresse professionnelle :</strong> 62 RD 11, rue Adrien Lagourgue, 97424 Saint-Leu, La Réunion</li>
						<li><strong>Numéro SIRET :</strong> 10774374200010</li>
						<li><strong>Adresse e-mail de contact :</strong> mdigitallab69@gmail.com</li>
						<li><strong>Téléphone :</strong> 06 92 70 23 39</li>
						<li><strong>Directeur de la publication :</strong> Michel Bénard</li>
					</ul>
				</section>

				<section className="space-y-2 text-sm text-slate-300 leading-relaxed">
					<h2 className="text-lg font-semibold text-white">2. Hébergement de l’application et des données</h2>
					<ul className="list-disc pl-5 space-y-1 text-slate-300">
						<li>
							<strong>Hébergement applicatif :</strong> Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.
						</li>
						<li>
							<strong>Authentification, base de données et stockage temporaire des fichiers :</strong> Supabase Inc. (infrastructure localisée en <strong>Ouest de l’Union européenne</strong>).
						</li>
						<li>
							<strong>Traitement audio et génération de texte par intelligence artificielle :</strong> Google LLC / Google Cloud (API Gemini).
						</li>
					</ul>
				</section>

				<section className="space-y-2 text-sm text-slate-300 leading-relaxed">
					<h2 className="text-lg font-semibold text-white">3. Propriété intellectuelle</h2>
					<p>
						L’ensemble des éléments composant l’application <strong>M Lab Vox</strong> (interface, architecture logicielle, textes, visuels, prompts et marque) est la propriété exclusive de <strong>M Digital Lab</strong> (Michel Bénard), sous réserve des droits appartenant à ses prestataires techniques ou aux clients sur leurs propres contenus. Toute reproduction, représentation ou exploitation non autorisée est interdite.
					</p>
				</section>

				<div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4 text-xs text-slate-400">
					<Link href="/confidentialite-cgv" className="text-blue-400 hover:underline">
						Politique de confidentialité (RGPD) &amp; CGV / CGU
					</Link>
				</div>
			</div>
		</main>
	);
}
