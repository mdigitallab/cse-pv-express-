import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const PRIMARY_MODEL = 'gemini-3.7-flash';

interface AudioItem {
	url: string;
	name?: string;
	mimeType?: string;
}

function guessMimeType(fileName?: string, url?: string, providedType?: string): string {
	if (providedType?.startsWith('audio/')) return providedType;
	const target = (fileName || url || '').toLowerCase();
	if (target.endsWith('.mp3')) return 'audio/mpeg';
	if (target.endsWith('.wav')) return 'audio/wav';
	if (target.endsWith('.m4a')) return 'audio/mp4';
	if (target.endsWith('.aac')) return 'audio/aac';
	if (target.endsWith('.ogg')) return 'audio/ogg';
	if (target.endsWith('.webm')) return 'audio/webm';
	return 'audio/mp4';
}

function normalizeAudios(body: any): AudioItem[] {
	const rawItems =
		body?.fileUrls ??
		body?.audios ??
		body?.audioUrls ??
		body?.urls ??
		body?.files ??
		(body?.audioUrl ? [{ url: body.audioUrl }] : []);
	if (!Array.isArray(rawItems)) return [];

	return rawItems
		.map((entry: any): AudioItem | null => {
			if (typeof entry === 'string' && entry.trim()) return { url: entry.trim() };
			if (entry && typeof entry === 'object') {
				const url = entry.url || entry.publicUrl || entry.signedUrl || entry.fileUrl;
				if (typeof url === 'string' && url.trim()) {
					return {
						url: url.trim(),
						name: typeof entry.name === 'string' ? entry.name : undefined,
						mimeType: typeof entry.mimeType === 'string' ? entry.mimeType : undefined,
					};
				}
			}
			return null;
		})
		.filter((item): item is AudioItem => item !== null);
}

export async function POST(req: NextRequest) {
	const uploadedGeminiFiles: string[] = [];
	try {
		if (!process.env.GEMINI_API_KEY) {
			return NextResponse.json({ error: 'Clé GEMINI_API_KEY manquante sur le serveur.' }, { status: 500 });
		}

		const body = await req.json();
		const meetingTitle =
			typeof body?.meetingTitle === 'string' && body.meetingTitle.trim()
				? body.meetingTitle.trim()
				: typeof body?.title === 'string' && body.title.trim()
					? body.title.trim()
					: 'Réunion du CSE';
		const meetingDate =
			typeof body?.meetingDate === 'string'
				? body.meetingDate
				: typeof body?.date === 'string'
					? body.date
					: '';
		const audios = normalizeAudios(body);
		if (!audios.length) {
			return NextResponse.json({ error: 'Aucun fichier audio fourni.' }, { status: 400 });
		}

		const requestedModel = body?.model;
		const modelToUse =
			typeof requestedModel === 'string' && requestedModel.trim()
				? requestedModel.replace(/^models\//, '').trim()
				: PRIMARY_MODEL;
		const contentsParts: any[] = [];

		for (let i = 0; i < audios.length; i++) {
			const item = audios[i];
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
			const uploadedFile = await ai.files.upload({
				file: new Blob([arrayBuffer], { type: mimeType }),
				config: { mimeType, displayName: item.name || `audio-${i + 1}` },
			});
			if (uploadedFile?.name) uploadedGeminiFiles.push(uploadedFile.name);
			contentsParts.push({
				fileData: { fileUri: uploadedFile.uri, mimeType: uploadedFile.mimeType || mimeType },
			});
		}

		contentsParts.push(`Tu es un assistant juridique et administratif spécialisé dans la rédaction de Procès-Verbaux (PV) de Comité Social et Économique (CSE) en France.
À partir des enregistrements audio fournis, rédige un Procès-Verbal structuré, fidèle, clair et professionnel en français.

Informations de séance :
- Intitulé : ${meetingTitle}
- Date : ${meetingDate || 'Non précisée'}

Consignes :
1. Respecte strictement les propos, décisions, engagements et votes entendus dans l'audio (n'invente aucun fait).
2. Structure le PV avec des titres clairs : En-tête / Participants mentionnés, Points de l'ordre du jour, Décisions / Votes / Engagements, Clôture de séance.
3. Si un passage est inaudible ou ambigu, indique-le brièvement entre crochets ([passage inaudible]).
4. Utilise un ton neutre, formel et exploitable pour un PV officiel.`);

		const response = await ai.models.generateContent({ model: modelToUse, contents: contentsParts });
		const pvText = response?.text?.trim();
		if (!pvText) return NextResponse.json({ error: 'Le modèle a renvoyé une réponse vide.' }, { status: 502 });
		return NextResponse.json({ pv: pvText, modelUsed: modelToUse });
	} catch (error: any) {
		const rawMessage = String(error?.message || '');
		const statusCode =
			Number(error?.status || error?.code) ||
			(rawMessage.includes('429') ? 429 : rawMessage.includes('503') ? 503 : 500);
		const message =
			statusCode === 429
				? 'Quota journalier Gemini atteint (429 RESOURCE_EXHAUSTED). Réessaie après réinitialisation du quota ou avec un autre modèle disponible.'
				: statusCode === 503
					? 'Le modèle Gemini est temporairement surchargé (503 UNAVAILABLE). Réessaie dans un instant.'
					: error?.message || 'Erreur interne lors de la génération du PV.';
		return NextResponse.json({ error: message, code: statusCode }, {
			status: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
		});
	} finally {
		for (const fileName of uploadedGeminiFiles) {
			try {
				await ai.files.delete({ name: fileName });
			} catch {
				// Ignore cleanup errors so they do not mask the main response.
			}
		}
	}
}
