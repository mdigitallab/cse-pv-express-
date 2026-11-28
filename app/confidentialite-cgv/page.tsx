import Link from 'next/link';

export default function ConfidentialiteCgvPage() {
	return (
		<main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 p-6 md:p-12">
			<div className="max-w-3xl mx-auto bg-slate-900/90 backdrop-blur border border-slate-800 p-6 md:p-10 rounded-2xl shadow-2xl space-y-8">
				<div className="flex items-center justify-between border-b border-slate-800 pb-4">
					<h1 className="text-2xl md:text-3xl font-extrabold text-white">
						Politique de confidentialité &amp; CGV / CGU
					</h1>
					<Link href="/" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition">
						← Retour à M Lab Vox
					</Link>
				</div>

				{/* PARTIE I : RGPD */}
				<div className="space-y-4 text-sm text-slate-300 leading-relaxed">
					<h2 className="text-xl font-bold text-blue-400 border-b border-slate-800 pb-2">
						I. Politique de confidentialité et engagement RGPD (CSE)
					</h2>

					<div className="space-y-2">
						<h3 className="text-base font-semibold text-white">1. Rôles respectifs au sens du RGPD</h3>
						<p>
							Lorsqu’un Comité Social et Économique (CSE) ou une organisation cliente importe l’enregistrement audio d’une réunion dans <strong>M Lab Vox</strong>, le client agit en qualité de <strong>Responsable de traitement</strong> vis-à-vis des personnes enregistrées et mentionnées, tandis que <strong>M Digital Lab</strong> (Michel Bénard, 62 RD 11 rue Adrien Lagourgue, 97424 Saint-Leu — SIRET 10774374200010) agit en qualité de <strong>Sous-traitant technique</strong> au sens de l’article 28 du Règlement Général sur la Protection des Données (RGPD).
						</p>
					</div>

					<div className="space-y-2">
						<h3 className="text-base font-semibold text-white">2. Obligation d’information préalable des participants</h3>
						<p>
							Le client certifie, avant tout envoi de fichier audio, avoir préalablement informé l’ensemble des participants de la séance de l’enregistrement sonore et du traitement automatisé mis en œuvre pour établir un projet de procès-verbal, conformément au Code du travail et aux règles internes du CSE.
						</p>
					</div>

					<div className="space-y-2">
						<h3 className="text-base font-semibold text-white">3. Données traitées et cycle de vie strict des fichiers audio</h3>
						<ul className="list-disc pl-5 space-y-1">
							<li>
								<strong>Données de compte :</strong> adresse e-mail et identifiants d’authentification nécessaires à l’accès sécurisé au service.
							</li>
							<li>
								<strong>Données de séance :</strong> enregistrements audio importés, intitulé et date de la réunion, liste des participants/intervenants sélectionnés et projet de procès-verbal généré.
							</li>
							<li>
								<strong>Hébergement en Ouest de l’Union européenne &amp; suppression immédiate :</strong> les fichiers audio transitent via des connexions chiffrées (HTTPS/TLS) vers un espace de stockage privé hébergé dans l’<strong>Ouest de l’Union européenne</strong> (Supabase). Ils sont supprimés automatiquement dès la fin de la génération du projet de procès-verbal afin de réduire au strict minimum leur durée de conservation.
							</li>
							<li>
								<strong>Absence d’entraînement public :</strong> les données audio et textuelles transmises via l’API payante Google Cloud / Gemini ne sont pas utilisées pour entraîner des modèles publics.
							</li>
						</ul>
					</div>

					<div className="space-y-2">
						<h3 className="text-base font-semibold text-white">4. Sous-traitants et transferts de données</h3>
						<p>
							Le fonctionnement de <strong>M Lab Vox</strong> repose sur <strong>Supabase</strong> (authentification et stockage temporaire en Ouest de l’Union européenne), <strong>Vercel</strong> (hébergement applicatif), <strong>Google Cloud / Gemini API</strong> (traitement audio et génération du texte), ainsi que les prestataires de paiement et de gestion commerciale utilisés par <strong>M Digital Lab</strong> (Stripe / Systeme.io). Certains prestataires peuvent opérer depuis les États-Unis dans le cadre des garanties prévues par le RGPD (clauses contractuelles types et cadres d’adéquation applicables).
						</p>
					</div>

					<div className="space-y-2">
						<h3 className="text-base font-semibold text-white">5. Exercice des droits et réclamation</h3>
						<p>
							Conformément au RGPD, toute personne concernée dispose d’un droit d’accès, de rectification, d’effacement, de limitation et d’opposition sur ses données, ainsi que du droit d’introduire une réclamation auprès de la <strong>CNIL</strong> (www.cnil.fr). Toute demande peut être adressée à : <strong>mdigitallab69@gmail.com</strong> ou par téléphone au <strong>06 92 70 23 39</strong>.
						</p>
					</div>
				</div>

				{/* PARTIE II : CGV / CGU */}
				<div className="space-y-4 text-sm text-slate-300 leading-relaxed pt-4 border-t border-slate-800">
					<h2 className="text-xl font-bold text-blue-400 border-b border-slate-800 pb-2">
						II. Conditions Générales de Vente et d’Utilisation (CGV / CGU)
					</h2>

					<div className="space-y-1">
						<h3 className="text-base font-semibold text-white">Article 1 — Objet et public visé</h3>
						<p>
							Les présentes Conditions Générales régissent l’accès et l’utilisation de la plateforme SaaS <strong>M Lab Vox</strong>, éditée par <strong>M Digital Lab</strong>, destinée aux Comités Sociaux et Économiques (CSE), élus du personnel, organisations syndicales et professionnels souhaitant automatiser la préparation de leurs projets de procès-verbaux à partir d’enregistrements audio.
						</p>
					</div>

					<div className="space-y-1">
						<h3 className="text-base font-semibold text-white">Article 2 — Nature du document produit et obligation de relecture</h3>
						<p>
							<strong>M Lab Vox</strong> génère un <strong>projet de procès-verbal</strong> assisté par intelligence artificielle. Ce document constitue un support préparatoire de travail et <strong>ne dispense pas</strong> le Secrétaire et les membres du CSE de le relire, de vérifier l’exactitude des propos, chiffres, votes et identités, et de le soumettre à adoption formelle conformément au Code du travail et au règlement intérieur du CSE.
						</p>
					</div>

					<div className="space-y-1">
						<h3 className="text-base font-semibold text-white">Article 3 — Accès au compte et sécurité</h3>
						<p>
							L’accès à la plateforme est strictement personnel et protégé par authentification. Le client est responsable de la confidentialité de ses identifiants, de la licéité des enregistrements importés et du respect de l’information préalable des participants.
						</p>
					</div>

					<div className="space-y-1">
						<h3 className="text-base font-semibold text-white">Article 4 — Tarifs, facturation et statut fiscal</h3>
						<p>
							Les abonnements mensuels sont facturés selon la formule souscrite (comprise entre 49 € et 89 € HT/mois selon le volume d’heures inclus). En application du régime de la franchise en base de TVA (micro-entreprise) : <strong>« TVA non applicable, art. 293 B du CGI »</strong>.
						</p>
					</div>

					<div className="space-y-1">
						<h3 className="text-base font-semibold text-white">Article 5 — Durée, renouvellement et résiliation</h3>
						<p>
							L’abonnement est conclu pour une durée mensuelle reconduite tacitement de mois en mois. Le client peut résilier son abonnement à tout moment avant la date de renouvellement suivante depuis son espace client ou par demande écrite à <strong>mdigitallab69@gmail.com</strong>. Tout mois commencé demeure dû.
						</p>
					</div>

					<div className="space-y-1">
						<h3 className="text-base font-semibold text-white">Article 6 — Disponibilité et limites techniques</h3>
						<p>
							<strong>M Digital Lab</strong> met en œuvre les moyens raisonnables pour assurer l’accessibilité de <strong>M Lab Vox</strong>, sans garantir une disponibilité ininterrompue ni l’absence de contraintes techniques liées aux hébergeurs, aux réseaux ou aux API tierces (notamment concernant la durée maximale des fichiers traités en une seule opération). La responsabilité de l’éditeur ne saurait être engagée au titre des dommages indirects.
						</p>
					</div>

					<div className="space-y-1">
						<h3 className="text-base font-semibold text-white">Article 7 — Propriété intellectuelle</h3>
						<p>
							Le client conserve l’entière propriété de ses enregistrements audio et des procès-verbaux générés. <strong>M Digital Lab</strong> demeure seul titulaire des droits de propriété intellectuelle relatifs à l’application <strong>M Lab Vox</strong>, son code, son interface et ses méthodes de traitement.
						</p>
					</div>

					<div className="space-y-1">
						<h3 className="text-base font-semibold text-white">Article 8 — Droit applicable et juridiction compétente</h3>
						<p>
							Les présentes CGV/CGU sont soumises au droit français. En cas de différend n’ayant pu faire l’objet d’un règlement amiable, les juridictions françaises seront seules compétentes.
						</p>
					</div>
				</div>

				<div className="pt-4 border-t border-slate-800 flex flex-wrap gap-4 text-xs text-slate-400">
					<Link href="/mentions-legales" className="text-blue-400 hover:underline">
						Voir les Mentions légales
					</Link>
				</div>
			</div>
		</main>
	);
}
