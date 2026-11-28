'use client';

import React, { useState, useEffect } from 'react';
import { createClient, Session } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import ParticipantsSelector, { SelectedAttendee } from './ParticipantsSelector';

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
	const [session, setSession] = useState<Session | null>(null);
	const [authLoading, setAuthLoading] = useState(true);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [authError, setAuthError] = useState('');
	const [signingIn, setSigningIn] = useState(false);

	const [title, setTitle] = useState('Réunion Ordinaire du CSE');
	const [date, setDate] = useState('');
	const [files, setFiles] = useState<File[]>([]);
	const [selectedAttendees, setSelectedAttendees] = useState<SelectedAttendee[]>([]);
	const [loading, setLoading] = useState(false);
	const [pvResult, setPvResult] = useState('');
	const [error, setError] = useState('');
	const [hasConsented, setHasConsented] = useState(false);

	useEffect(() => {
		setDate(new Date().toISOString().split('T')[0]);

		supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
			setSession(currentSession);
			setAuthLoading(false);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, updatedSession) => {
			setSession(updatedSession);
		});

		return () => subscription.unsubscribe();
	}, []);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setSigningIn(true);
		setAuthError('');

		const { error: signInError } = await supabase.auth.signInWithPassword({
			email: email.trim(),
			password,
		});

		if (signInError) {
			setAuthError('Identifiants invalides ou compte non activé. Vérifiez votre e-mail et votre mot de passe.');
		}
		setSigningIn(false);
	};

	const handleLogout = async () => {
		await supabase.auth.signOut();
		setPvResult('');
		setFiles([]);
		setError('');
	};

	const handleGenerate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (files.length === 0) {
			setError('Veuillez sélectionner au moins un fichier audio.');
			return;
		}
		if (!hasConsented) {
			setError('Veuillez cocher la case attestant de l’information des participants avant de générer le PV.');
			return;
		}

		setLoading(true);
		setError('');
		setPvResult('');
		const uploadedPaths: string[] = [];

		try {
			const {
				data: { session: activeSession },
				error: sessionError,
			} = await supabase.auth.getSession();

			if (sessionError || !activeSession?.access_token) {
				throw new Error('Session expirée ou non authentifiée. Veuillez vous reconnecter.');
			}

			const fileUrls: { url: string; mimeType: string; name: string; path: string }[] = [];

			for (const file of files) {
				const cleanName = `${activeSession.user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
				const { error: uploadError } = await supabase.storage
					.from('audios')
					.upload(cleanName, file);

				if (uploadError) {
					throw new Error(`Erreur envoi audio vers le stockage : ${uploadError.message}`);
				}
				uploadedPaths.push(cleanName);

				const { data: signedData, error: signedError } = await supabase.storage
					.from('audios')
					.createSignedUrl(cleanName, 3600);

				if (signedError || !signedData?.signedUrl) {
					throw new Error(`Impossible de générer le lien sécurisé pour "${file.name}".`);
				}

				fileUrls.push({
					url: signedData.signedUrl,
					mimeType: file.type || 'audio/mp4',
					name: file.name,
					path: cleanName,
				});
			}

			const res = await fetch('/api/generate-pv', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${activeSession.access_token}`,
				},
				body: JSON.stringify({
					title,
					date,
					fileUrls,
					attendees: selectedAttendees,
				}),
			});

			const rawText = await res.text();
			let data: any = {};
			try {
				data = JSON.parse(rawText);
			} catch {
				throw new Error(`Réponse serveur inattendue : ${rawText.slice(0, 120)}`);
			}

			if (!res.ok) throw new Error(data.error || 'Erreur lors de la génération');
			setPvResult(data.pv || '');
		} catch (err: any) {
			setError(err.message || 'Une erreur est survenue.');
		} finally {
			if (uploadedPaths.length > 0) {
				await supabase.storage.from('audios').remove(uploadedPaths);
			}
			setLoading(false);
		}
	};

	const handleDownloadWord = async () => {
		if (!pvResult) return;

		const lines = pvResult.split('\n');
		const children: Paragraph[] = [
			new Paragraph({
				text: `PROCÈS-VERBAL - ${title.toUpperCase()}`,
				heading: HeadingLevel.HEADING_1,
			}),
			new Paragraph({
				text: `Date de la séance : ${date}`,
				spacing: { after: 300 },
			}),
		];

		lines.forEach((line) => {
			const cleanLine = line.replace(/\*\*/g, '').trim();
			if (!cleanLine) {
				children.push(new Paragraph({ text: '' }));
			} else if (line.startsWith('### ')) {
				children.push(new Paragraph({
					text: cleanLine.replace(/^###\s*/, ''),
					heading: HeadingLevel.HEADING_3,
					spacing: { before: 200, after: 100 },
				}));
			} else if (line.startsWith('## ') || line.startsWith('# ')) {
				children.push(new Paragraph({
					text: cleanLine.replace(/^#+\s*/, ''),
					heading: HeadingLevel.HEADING_2,
					spacing: { before: 240, after: 120 },
				}));
			} else {
				children.push(new Paragraph({
					children: [new TextRun(cleanLine)],
					spacing: { after: 100 },
				}));
			}
		});

		const doc = new Document({ sections: [{ children }] });
		const blob = await Packer.toBlob(doc);
		saveAs(blob, `M_Labvox_PV_CSE_${date}.docx`);
	};

	if (authLoading) {
		return (
			<main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 flex items-center justify-center p-6">
				<p className="text-sm text-slate-400">Vérification de la session sécurisée...</p>
			</main>
		);
	}

	if (!session) {
		return (
			<main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 flex items-center justify-center p-6">
				<div className="w-full max-w-md bg-slate-900/90 backdrop-blur border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
					<div className="flex items-center gap-3">
						<span className="bg-blue-600 text-white font-bold p-2.5 rounded-xl text-lg shadow-lg shadow-blue-500/30">⚖️</span>
						<div>
							<h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
								M Labvox <span className="text-xs font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">MDIGITALLAB</span>
							</h1>
							<p className="text-slate-400 text-xs mt-0.5">Accès réservé aux élus et utilisateurs autorisés</p>
						</div>
					</div>

					<form onSubmit={handleLogin} className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-slate-300 mb-1.5">Adresse e-mail</label>
							<input
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="secretaire.cse@entreprise.fr"
								className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-blue-500 transition"
								required
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-slate-300 mb-1.5">Mot de passe</label>
							<input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-blue-500 transition"
								required
							/>
						</div>

						{authError && (
							<div className="p-3 bg-red-950/50 border border-red-800 text-red-300 rounded-xl text-xs">
								⚠️ {authError}
							</div>
						)}

						<button
							type="submit"
							disabled={signingIn}
							className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-blue-600/20"
						>
							{signingIn ? 'Connexion en cours...' : 'Se connecter à M Labvox'}
						</button>
					</form>
				</div>
			</main>
		);
	}

	return (
		<main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 p-6 md:p-12">
			<div className="max-w-4xl mx-auto space-y-8">
				<header className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 gap-4">
					<div>
						<div className="flex items-center gap-3">
							<span className="bg-blue-600 text-white font-bold p-2.5 rounded-xl text-lg shadow-lg shadow-blue-500/30">⚖️</span>
							<div>
								<h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
									M Labvox <span className="text-xs font-semibold px-2.5 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full">MDIGITALLAB</span>
								</h1>
								<p className="text-slate-400 text-sm mt-0.5">Plateforme sécurisée de retranscription et rédaction automatisée de PV de CSE</p>
							</div>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
						<div className="bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-xl text-xs text-slate-300">
							🔒 {session.user.email}
						</div>
						<button
							type="button"
							onClick={handleLogout}
							className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-200 transition cursor-pointer"
						>
							Déconnexion
						</button>
					</div>
				</header>

				<form onSubmit={handleGenerate} className="bg-slate-900/90 backdrop-blur border border-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl space-y-6">
					<h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-3 flex items-center gap-2">
						<span>🎙️</span> Paramètres de la séance
					</h2>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div>
							<label className="block text-sm font-medium text-slate-300 mb-2">Intitulé de la réunion</label>
							<input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-blue-500 transition" required />
						</div>
						<div>
							<label className="block text-sm font-medium text-slate-300 mb-2">Date de la séance</label>
							<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 focus:outline-none focus:border-blue-500 transition" required />
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-300 mb-2">Enregistrements audio (Sélectionnez un ou plusieurs fichiers MP3, WAV, M4A...)</label>
						<div className="border-2 border-dashed border-slate-700 hover:border-blue-500 transition rounded-2xl p-6 bg-slate-950 text-center cursor-pointer">
							<input type="file" accept="audio/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer" required />
							{files.length > 0 && <p className="text-xs text-blue-400 mt-3 font-medium">{files.length} fichier(s) sélectionné(s) : {files.map((f) => f.name).join(', ')}</p>}
						</div>
					</div>

					<ParticipantsSelector onSelectionChange={setSelectedAttendees} />

					{error && <div className="p-4 bg-red-950/50 border border-red-800 text-red-300 rounded-xl text-sm">⚠️ {error}</div>}

					<div className="flex items-start gap-2 my-4 p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-left">
						<input id="rgpd-consent" type="checkbox" checked={hasConsented} onChange={(e) => setHasConsented(e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-500 text-blue-500 focus:ring-blue-500 cursor-pointer" required />
						<label htmlFor="rgpd-consent" className="text-xs text-slate-300 cursor-pointer leading-relaxed">En important cet enregistrement, je certifie agir au nom du CSE et avoir préalablement informé l’ensemble des participants de la réunion de l’enregistrement audio et de son traitement automatisé.</label>
					</div>

					<button type="submit" disabled={loading || !hasConsented} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold py-4 rounded-xl transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3 text-base">
						{loading ? (
							<>
								<svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
								Envoi vers le stockage sécurisé et rédaction en cours...
							</>
						) : (<>⚡ Générer le Procès-Verbal unifié</>)}
					</button>
				</form>

				{pvResult && (
					<section className="bg-slate-900/90 backdrop-blur border border-slate-800 p-6 md:p-8 rounded-2xl shadow-2xl space-y-4">
						<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
							<div>
								<h2 className="text-xl font-bold text-white flex items-center gap-2"><span>📄</span> Projet de Procès-Verbal généré</h2>
								<p className="text-xs text-slate-400 mt-0.5">Vous pouvez relire, modifier directement le texte ou le télécharger.</p>
							</div>
							<div className="flex items-center gap-3">
								<button type="button" onClick={handleDownloadWord} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition shadow-lg shadow-emerald-600/20 flex items-center gap-2"><span>📥</span> Télécharger en Word (.docx)</button>
								<button type="button" onClick={() => { const ok = window.confirm('Voulez-vous vraiment effacer ce procès-verbal ? Cette action est irréversible.'); if (ok) { setPvResult(''); setFiles([]); setError(''); } }} className="px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600/80 hover:bg-red-600 text-white transition cursor-pointer">Effacer le PV</button>
							</div>
						</div>
						<textarea value={pvResult} onChange={(e) => setPvResult(e.target.value)} rows={22} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs md:text-sm text-slate-300 leading-relaxed focus:outline-none focus:border-blue-500 transition" />
					</section>
				)}
			</div>
		</main>
	);
}
