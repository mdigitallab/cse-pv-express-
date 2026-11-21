import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface FileUrlItem {
	url: string;
	mimeType?: string;
	name?: string;
}

async function generateWithRetry(
	contents: any[],
	model = 'gemini-3.8-flash',
	maxRetries = 2
) {
	let lastError: any;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await ai.models.generateContent({
				model,
				contents,
			});
		} catch (err: any) {
			lastError = err;
			const msg = String(err?.message || '');
			const isTemporaryOverload =
				err?.status === 503 ||
				err?.code === 503 ||
				msg.includes('503') ||
				msg.includes('UNAVAILABLE') ||
				msg.includes('high demand');

			if (!isTemporaryOverload || attempt === maxRetries) {
				throw err;
			}

			await new Promise((resolve) => setTimeout(resolve, 1500));
		}
	}

	throw lastError || new Error('Échec de la génération après plusieurs tentatives.');
}

export async function POST(req: NextRequest) {
	const uploadedFilesMeta: any[] = [];

	try {
		const body = await req.json();
		const fileUrls = (body.fileUrls || []) as FileUrlItem[];
		const meetingTitle = (body.title as string) || 'Réunion CSE';
		const meetingDate = (body.date as string) || new Date().toISOString().split('T')[0];

		if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
			return NextResponse.json({ error: 'Aucun fichier audio fourni.' }, { status: 400 });
		}

		// 1. Téléchargement de chaque audio depuis Supabase Storage + upload vers l'API File de Gemini
		for (const item of fileUrls) {
			const audioRes = await fetch(item.url);
			if (!audioRes.ok) {
				throw new Error(`Impossible de récupérer le fichier audio (${item.name || item.url}).`);
			}

			const arrayBuffer = await audioRes.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const mimeType = item.mimeType || audioRes.headers.get('content-type') || 'audio/mp4';
			const blob = new Blob([buffer], { type: mimeType });

			const uploaded = await ai.files.upload({
				file: blob,
				mimeType,
			} as any);
			uploadedFilesMeta.push(uploaded);
		}

		// 2. Préparation des références de fichiers pour le prompt
		const fileParts = uploadedFilesMeta.map((f) => ({
			fileData: {
				fileUri: f.uri,
				mimeType: f.mimeType,
			},
		}));

		// 3. Prompt de rédaction globale
		const prompt = `Tu es un rédacteur juridique spécialisé dans les Procès-Verbaux de Comité Social et Économique (CSE) en France.
Analyse l'intégralité des enregistrements audio fournis (qui se suivent chronologiquement) pour la réunion du CSE intitulée "${meetingTitle}" du ${meetingDate}.

Rédige un Procès-Verbal unifié, complet, fidèle, neutre et juridiquement rigoureux comprenant :
1. L'en-tête officiel (Titre, Date, Participants identifiés si mentionnés, Ordre du jour déduit).
2. Le déroulé détaillé point par point de toute la réunion :
  - Présentation et informations de la Direction.
  - Questions, remarques et débats des élus du CSE.
  - Réponses et engagements précis de la Direction.
  - Résultats des éventuels votes ou consultations (Pour / Contre / Abstention).
3. Le relevé synthétique des décisions et actions à suivre.

Adopte un style professionnel, clair, structuré avec des titres et des listes à puces.`;

		// 4. Génération du PV avec relance rapide en cas de 503
		const response = await generateWithRetry([...fileParts, prompt], 'gemini-3.8-flash', 2);
		const pvText = response.text || '';

		// 5. Sauvegarde sécurisée du PV unifié dans Supabase
		const { data: meetingRecord, error: dbError } = await supabase
			.from('meetings')
			.insert({
				title: meetingTitle,
				meeting_date: meetingDate,
				pv_content: pvText,
				status: 'completed',
			})
			.select()
			.single();

		if (dbError) {
			console.error('Erreur insertion DB :', dbError);
		}

		return NextResponse.json({
			success: true,
			pv: pvText,
			meeting: meetingRecord,
		});
	} catch (error: any) {
		console.error('Erreur génération PV multiple :', error);
		return NextResponse.json(
			{ error: error.message || 'Erreur interne lors de la génération du PV.' },
			{ status: 500 }
		);
	} finally {
		// 6. Suppression systématique des fichiers sur Gemini (RGPD), même en cas d'erreur
		for (const f of uploadedFilesMeta) {
			if (f?.name) {
				try {
					await ai.files.delete({ name: f.name });
				} catch (cleanupErr) {
					console.error('Erreur suppression fichier Gemini :', cleanupErr);
				}
			}
		}
	}
}
