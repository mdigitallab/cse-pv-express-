 'use client';

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [isSignUp, setIsSignUp] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const handleAuth = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError('');
		setMessage('');

		try {
			if (isSignUp) {
				const { error } = await supabase.auth.signUp({ email, password });
				if (error) throw error;
				setMessage('Inscription réussie ! Vérifie tes e-mails pour confirmer ton compte.');
			} else {
				const { error } = await supabase.auth.signInWithPassword({ email, password });
				if (error) throw error;
				router.push('/');
				router.refresh();
			}
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-slate-100 flex items-center justify-center p-6">
			<div className="max-w-md w-full bg-slate-900/90 backdrop-blur border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
				<div className="text-center space-y-2">
					<span className="bg-blue-600 text-white font-bold p-3 rounded-2xl text-xl shadow-lg shadow-blue-500/30 inline-block mb-2">⚖️</span>
					<h1 className="text-2xl font-extrabold tracking-tight text-white">CSE-PV Express</h1>
					<p className="text-xs text-slate-400">Espace sécurisé - M DIGITAL LAB</p>
				</div>

				<form onSubmit={handleAuth} className="space-y-4">
					<div>
						<label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1">Adresse e-mail</label>
						<input
							id="email"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition"
							required
						/>
					</div>

					<div>
						<label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1">Mot de passe</label>
						<input
							id="password"
							type="password"
							autoComplete={isSignUp ? 'new-password' : 'current-password'}
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition"
							required
						/>
					</div>

					{error && (
						<div role="alert" className="p-3 bg-red-950/50 border border-red-800 text-red-300 rounded-xl text-xs">
							⚠️ {error}
						</div>
					)}

					{message && (
						<div role="status" className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-xl text-xs">
							✨ {message}
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-600/20 text-sm disabled:opacity-60"
					>
						{loading ? 'Patientez...' : isSignUp ? "S'inscrire" : 'Se connecter'}
					</button>
				</form>

				<div className="text-center">
					<button
						type="button"
						onClick={() => {
							setIsSignUp(!isSignUp);
							setError('');
							setMessage('');
						}}
						className="text-xs text-blue-400 hover:underline"
					>
						{isSignUp ? 'Déjà un compte ? Connecte-toi' : "Pas encore de compte ? S'inscrire"}
					</button>
				</div>
			</div>
		</main>
	);
}
