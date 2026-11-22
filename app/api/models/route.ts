import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function GET() {
	try {
		const pager = await ai.models.list();
		const models: string[] = [];

		for await (const model of pager) {
			if (model?.name) {
				models.push(model.name);
			}
		}

		return NextResponse.json({ models });
	} catch (error: any) {
		return NextResponse.json(
			{ error: error?.message || 'Erreur lors de la récupération des modèles.' },
			{ status: 500 }
		);
	}
}
