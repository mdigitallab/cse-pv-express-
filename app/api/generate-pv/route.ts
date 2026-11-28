import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 300;

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

async function waitForGeminiFileActive(fileName: string, maxAttempts = 30): Promise<any> {
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

		const attendeesSection =
			attendees.length > 0
				? `Personnes présentes / intervenants cochés pour cette séance (respecte strictement ces noms et fonctions) :
${attendees.map((a: AttendeeItem) => `- ${a.name}${a.role ? ` — ${a.role}` : ''}`).join('\n')}`
				: `Aucune liste de présents n'a été cochée : mentionne uniquement les noms et fonctions explicitement audibles dans l'audio sans en inventer.`;

		const partNotesList: string[] = [];

		// Étape 1 : Analyser chaque fichier audio séparément pour préserver les détails
		for (let i = 0; i < audios.length; i++) {
			const item = audios[i];
			const partLabel = item.name || `Partie ${i + 1} sur ${audios.length}`;

			const audioResponse = await fetch(item.url);
			if (!audioResponse.ok) {
				return NextResponse.json(
					{
						error: `Impossible de récupérer l'audio "${partLabel}" depuis le stockage (HTTP ${audioResponse.status}).`,
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
				config: { mimeType, displayName: `part-${i + 1}-${item.name || 'audio'}` },
			});

			let readyFile = uploadedFile;
			if (uploadedFile?.name) {
				uploadedGeminiFiles.push(uploadedFile.name);
				readyFile = await waitForGeminiFileActive(uploadedFile.name);
			}

			const extractPrompt = `Tu es un assistant chargé de dresser un relevé détaillé et fidèle d'un enregistrement de réunion de CSE (${partLabel} — Séance : ${meetingTitle}).

${attendeesSection}

Consignes strictes :
- Transcris et détaille exhaustivement les sujets abordés, les échanges, les questions posées, les réponses apportées, les chiffres, montants, dates, votes et engagements présents dans CET enregistrement.
- Ne résume pas en quelques lignes : conserve la richesse des arguments de la Direction et des élus du CSE.
- N'invente aucun fait, chiffre, vote, nom ou propos absent de cet audio.
- Si l'identité d'un intervenant est incertaine malgré la liste, indique [identité à confirmer].
- Signale les passages incompréhensibles par [passage inaudible].
- N'utilise pas d'astérisques doubles (**).`;

			const partResponse = await ai.models.generateContent({
				model: modelToUse,
				contents: [
					{
						fileData: {
							fileUri: readyFile?.uri || uploadedFile.uri,
							mimeType: readyFile?.mimeType || uploadedFile.mimeType || mimeType,
						},
					},
					extractPrompt,
				],
			});

			const partText = partResponse?.text?.trim();
			if (partText) {
				partNotesList.push(`--- RELEVÉ DÉTAILLÉ : ${partLabel} ---\n${cleanPvFormatting(partText)}`);
			}
		}

		if (!partNotesList.length) {
			return NextResponse.json(
				{ error: 'Aucune extraction détaillée n’a pu être générée à partir des fichiers audio.' },
				{ status: 502 }
			);
		}

		// Étape 2 : Consolider l'ensemble des parties en un Procès-Verbal complet et structuré
		const consolidationPrompt = `Tu es un rédacteur professionnel spécialisé dans les procès-verbaux de réunions de Comité Social et Économique (CSE) en droit français.
À partir des relevés détaillés ci-dessous issus des différents enregistrements de la séance, rédige le Procès-Verbal COMPLET, DÉTAILLÉ, STRUCTURÉ et FIDÈLE en français.

Séance : ${meetingTitle} | Date : ${meetingDate || 'Non précisée'}.

${attendeesSection}

Exigences de fond et de détail :
- Ne fais PAS un résumé raccourci : conserve le niveau de détail, les faits, chiffres, montants, dates, questions/réponses, arguments de la Direction et positions des élus issus de toutes les parties.
- Organise le déroulement de façon claire et structurée point par point.
- Détaille clairement les décisions prises, les votes (pour / contre / abstention / unanimité lorsque mentionnés) et les engagements (qui s'engage, sur quoi, et avec quelle échéance si précisée).

Règles strictes :
- N'invente aucun fait, chiffre, vote, nom ou propos absent des relevés fournis.
- Respecte l'orthographe exacte des personnes listées ci-dessus.
- Garde [identité à confirmer] et [passage inaudible] là où cela est signalé.
- Garde un ton formel, neutre et institutionnel.
- N'utilise pas d'astérisques doubles (**) pour le gras.

Structure attendue :
1. En-tête de la séance et liste des participants / intervenants présents (avec leur fonction exacte lorsqu'elle est connue)
2. Déroulement et points abordés (détaillés point par point, avec échanges, questions et réponses)
3. Décisions, votes et engagements (en distinguant nettement les engagements de la Direction et ceux des élus du CSE)
4. Clôture de la séance (heure de fin si mentionnée et conclusion de séance)

Relevés détaillés à consolider :
${partNotesList.join('\n\n')}`;

		const finalResponse = await ai.models.generateContent({
			model: modelToUse,
			contents: [consolidationPrompt],
		});

		const rawPv = finalResponse?.text?.trim();
		if (!rawPv) {
			return NextResponse.json(
				{ error: 'Le modèle a renvoyé une réponse vide lors de la rédaction finale du PV.' },
				{ status: 502 }
			);
		}

		const pvText = cleanPvFormatting(rawPv);
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
