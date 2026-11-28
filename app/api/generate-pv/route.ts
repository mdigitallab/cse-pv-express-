import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const SINGLE_MODEL = 'gemini-3.1-flash-lite';

interface AudioItem {
	url: string;
	name?: string;
	mimeType?: string;
}

interface AttendeeItem {
	name: string;
	role?: string;
	group?: 'bureau_elus' | 'intervenants';
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

function normalizeAttendees(body: any): AttendeeItem[] {
	if (!Array.isArray(body?.attendees)) return [];
	return body.attendees
		.map((item: any): AttendeeItem | null => {
			if (!item || typeof item !== 'object') return null;
			const name = typeof item.name === 'string' ? item.name.trim() : '';
			if (!name) return null;
			const role = typeof item.role === 'string' ? item.role.trim() : '';
			const group =
				item.group === 'bureau_elus' || item.group === 'intervenants'
					? item.group
					: undefined;
			return { name, role: role || undefined, group };
		})
		.filter((a: AttendeeItem | null): a is AttendeeItem => a !== null);
}

async function waitForGeminiFileActive(fileName: string, maxAttempts = 20): Promise<any> {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const info = await ai.files.get({ name: fileName });
		const state = String((info as any)?.state || '').toUpperCase();
		if (!state || state === 'ACTIVE') return info;
		if (state === 'FAILED') {
			throw new Error(`Le traitement du fichier audio "${fileName}" a échoué côté Gemini.`);
		}
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}
	throw new Error('Délai dépassé lors de la préparation du fichier audio sur Gemini.');
}

function cleanPvFormatting(text: string): string {
	return text
		.replace(/\*\*/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
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
			return NextResponse.json(
				{ error: 'Aucun fichier audio fourni.' },
				{ status: 400 }
			);
		}

		const attendees = normalizeAttendees(body);
		const modelToUse =
			typeof body?.model === 'string' && body.model.trim()
				? body.model.replace(/^models\//, '').trim()
				: SINGLE_MODEL;
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

			let readyFile = uploadedFile;
			if (uploadedFile?.name) {
				uploadedGeminiFiles.push(uploadedFile.name);
				readyFile = await waitForGeminiFileActive(uploadedFile.name);
			}

			contentsParts.push({
				fileData: {
					fileUri: readyFile?.uri || uploadedFile.uri,
					mimeType: readyFile?.mimeType || uploadedFile.mimeType || mimeType,
				},
			});
		}

		const attendeesSection =
			attendees.length > 0
				? `Personnes présentes / intervenants cochés pour cette séance (respecte strictement ces noms et fonctions) :
${attendees.map((a: AttendeeItem) => `- ${a.name}${a.role ? ` — ${a.role}` : ''}`).join('\n')}`
				: `Aucune liste de présents n'a été cochée : mentionne uniquement les noms et fonctions explicitement audibles dans l'audio sans en inventer.`;

		const promptInstruction = `Tu es un rédacteur professionnel spécialisé dans les procès-verbaux de réunions de Comité Social et Économique (CSE) en droit français.
Rédige un Procès-Verbal COMPLET, DÉTAILLÉ, STRUCTURÉ et FIDÈLE en français à partir des enregistrements audio fournis (qui peuvent représenter plusieurs heures de séance ou plusieurs pistes).

Séance : ${meetingTitle} | Date : ${meetingDate || 'Non précisée'}.

${attendeesSection}

Exigences de fond et de détail :
- Ne fais PAS un résumé raccourci de quelques lignes : développe chaque sujet et chaque point abordé dans l'ordre chronologique ou selon l'ordre du jour.
- Restitue fidèlement les faits, chiffres, montants, dates, questions posées, réponses apportées, arguments de la Direction et positions des élus.
- Détaille clairement les décisions prises, les votes (indiquer pour / contre / abstention / unanimité lorsque mentionnés) et les engagements (qui s'engage, sur quoi, et avec quelle échéance si précisée).

Règles strictes :
- N'invente aucun fait, chiffre, vote, nom ou propos absent de l'audio.
- Utilise l'orthographe exacte des personnes listées ci-dessus lorsqu'elles interviennent ou sont présentes.
- Si l'identité d'un intervenant est incertaine malgré la liste, indique [identité à confirmer].
- Signale les passages incompréhensibles par [passage inaudible].
- Garde un ton formel, neutre et institutionnel.
- N'utilise pas d'astérisques doubles (**) pour le gras : structure les titres et sous-titres proprement avec des numéros, des tirets ou des majuscules sobres afin que le texte soit propre à l'affichage et à l'export Word.

Structure attendue :
1. En-tête de la séance et liste des participants / intervenants présents (avec leur fonction exacte lorsqu'elle est connue)
2. Déroulement et points abordés (détaillés point par point, avec échanges, questions et réponses)
3. Décisions, votes et engagements (en distinguant nettement les engagements de la Direction et ceux des élus du CSE)
4. Clôture de la séance (heure de fin si mentionnée et conclusion de séance)`;

		contentsParts.push(promptInstruction);

		const response = await ai.models.generateContent({
			model: modelToUse,
			contents: contentsParts,
		});

		const rawText = response?.text?.trim();
		if (!rawText) {
			return NextResponse.json(
				{ error: 'Le modèle a renvoyé une réponse vide.' },
				{ status: 502 }
			);
		}

		const pvText = cleanPvFormatting(rawText);
		return NextResponse.json({ pv: pvText, modelUsed: modelToUse });
	} catch (error: any) {
		const rawMessage = String(error?.message || '');
		const statusCode =
			Number(error?.status || error?.code) ||
			(rawMessage.includes('429') ? 429 : rawMessage.includes('503') ? 503 : 500);
		const message =
			statusCode === 429
				? 'Quota journalier Gemini atteint (429 RESOURCE_EXHAUSTED). Réessaie plus tard.'
				: statusCode === 503
					? 'Le modèle Gemini est temporairement surchargé (503 UNAVAILABLE). Réessaie dans un instant.'
					: error?.message || 'Erreur interne lors de la génération du PV.';

		return NextResponse.json(
			{ error: message, code: statusCode },
			{ status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 }
		);
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
