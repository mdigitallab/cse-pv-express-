import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Modèle principal (tu peux le remplacer par 'gemini-2.5-flash' ou 'gemini-3.6-flash')
const PRIMARY_MODEL = 'gemini-3.7-flash';

interface AudioItem {
	url: string;
	name?: string;
	mimeType?: string;
}

function guessMimeType(fileName?: string, url?: string, providedType?: string): string {
	if (providedType && providedType.startsWith('audio/')) {
		return providedType;
	}
	const target = (fileName || url || '').toLowerCase();
	if (target.endsWith('.mp3')) return 'audio/mpeg';
	if (target.endsWith('.wav')) return 'audio/wav';
	if (target.endsWith('.m4a')) return 'audio/mp4';
	if (target.endsWith('.aac')) return 'audio/aac';
	if (target.endsWith('.ogg')) return 'audio/ogg';
	if (target.endsWith('.webm')) return 'audio/webm';
	return 'audio/mp4';
}

export async function POST(req: NextRequest) {
	const uploadedGeminiFiles: string[] = [];

	try {
		if (!process.env.GEMINI_API_KEY) {
			return NextResponse.json(
				{ error: 'Clé GEMINI_API_KEY manquante sur le serveur.' },
				{ status: 500 }
			);
		}

		const body = await req.json();
		const {
			meetingTitle = 'Réunion du CSE',
			meetingDate = '',
			audios = [] as AudioItem[],
			model: requestedModel,
		} = body;

		if (!Array.isArray(audios) || audios.length === 0) {
			return NextResponse.json(
				{ error: 'Aucun fichier audio fourni.' },
				{ status: 400 }
			);
		}

		const modelToUse =
			typeof requestedModel === 'string' && requestedModel.trim().length > 0
				? requestedModel.replace(/^models\//, '').trim()
				: PRIMARY_MODEL;

		const contentsParts: any[] = [];

		for (let i = 0; i < audios.length; i++) {
			const item = audios[i];
			if (!item?.url) continue;

			const audioResponse = await fetch(item.url);
			if (!audioResponse.ok) {
				return NextResponse.json(
					{
						error: `Impossible de récupérer l'audio "${item.name || `fichier ${i + 1}`}" depuis le stockage (HTTP ${audioResponse.status}).`,
					},
					{ status: 400 }
				);
			}

			const arrayBuffer = await audioResponse.arrayBuffer();
			const mimeType = guessMimeType(
				item.name,
				item.url,
				item.mimeType || audioResponse.headers.get('content-type') || undefined
			);

			const fileBlob = new Blob([arrayBuffer], { type: mimeType });
			const uploadedFile = await ai.files.upload({
				file: fileBlob,
				config: {
					mimeType,
					displayName: item.name || `audio-${i + 1}`,
				},
			});

			if (uploadedFile?.name) {
				uploadedGeminiFiles.push(uploadedFile.name);
			}

			contentsParts.push({
				fileData: {
					fileUri: uploadedFile.uri,
					mimeType: uploadedFile.mimeType || mimeType,
				},
			});
		}

		if (contentsParts.length === 0) {
			return NextResponse.json(
				{ error: 'Aucun flux audio valide à traiter.' },
				{ status: 400 }
			);
		}

		const prompt = `Tu es un assistant juridique et administratif spécialisé dans la rédaction de Procès-Verbaux (PV) de Comité Social et Économique (CSE) en France.
À partir des enregistrements audio fournis, rédige un Procès-Verbal structuré, fidèle, clair et professionnel en français.

Informations de séance :
- Intitulé : ${meetingTitle}
- Date : ${meetingDate || 'Non précisée'}

Consignes :
1. Respecte strictement les propos, décisions, engagements et votes entendus dans l'audio (n'invente aucun fait).
2. Structure le PV avec des titres clairs : En-tête / Participants mentionnés, Points de l'ordre du jour, Décisions / Votes / Engagements, Clôture de séance.
3. Si un passage est inaudible ou ambigu, indique-le brièvement entre crochets ([passage inaudible]).
4. Utilise un ton neutre, formel et exploitable pour un PV officiel.`;

		contentsParts.push(prompt);

		const response = await ai.models.generateContent({
			model: modelToUse,
			contents: contentsParts,
		});

		const pvText = response?.text?.trim();
		if (!pvText) {
			return NextResponse.json(
				{ error: 'Le modèle a renvoyé une réponse vide.' },
				{ status: 502 }
			);
		}

		return NextResponse.json({
			pv: pvText,
			modelUsed: modelToUse,
		});
	} catch (error: any) {
		const statusCode =
			Number(error?.status || error?.code) ||
			(String(error?.message || '').includes('429') ? 429 : 500);

		const message =
			statusCode === 429
				? 'Quota journalier Gemini atteint (429 RESOURCE_EXHAUSTED). Réessaie après réinitialisation du quota ou avec un autre modèle disponible.'
				: statusCode === 503
					? 'Le modèle Gemini est temporairement surchargé (503 UNAVAILABLE). Réessaie dans un instant ou change de modèle.'
					: error?.message || 'Erreur interne lors de la génération du PV.';

		return NextResponse.json(
			{
				error: message,
				code: statusCode,
			},
			{ status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 }
		);
	} finally {
		// Nettoyage systématique des fichiers temporaires déposés sur l'API Files Gemini (RGPD / hygiène)
		for (const fileName of uploadedGeminiFiles) {
			try {
				await ai.files.delete({ name: fileName });
			} catch {
				// On ignore une erreur de suppression pour ne pas masquer la réponse principale
			}
		}
	}
}
