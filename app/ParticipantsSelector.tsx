'use client';

import React, { useEffect, useRef, useState } from 'react';

export type ParticipantGroup = 'bureau_elus' | 'intervenants';

export interface CseParticipant {
	id: string;
	name: string;
	role: string;
	group: ParticipantGroup;
	checkedByDefault?: boolean;
}

export interface SelectedAttendee {
	name: string;
	role?: string;
	group: ParticipantGroup;
}

const STORAGE_KEY = 'cse_pv_participants_v1';

interface ParticipantsSelectorProps {
	onSelectionChange: (selected: SelectedAttendee[]) => void;
}

function readParticipantsFromStorage(): CseParticipant[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function writeParticipantsToStorage(list: CseParticipant[]) {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
	} catch (err) {
		console.error('Erreur écriture localStorage :', err);
	}
}

export default function ParticipantsSelector({
	onSelectionChange,
}: ParticipantsSelectorProps) {
	const [participants, setParticipants] = useState<CseParticipant[]>([]);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [isManaging, setIsManaging] = useState(false);
	const [name, setName] = useState('');
	const [role, setRole] = useState('');
	const [group, setGroup] = useState<ParticipantGroup>('bureau_elus');
	const [checkedByDefault, setCheckedByDefault] = useState(true);
	const [formError, setFormError] = useState('');

	const onSelectionChangeRef = useRef(onSelectionChange);
	onSelectionChangeRef.current = onSelectionChange;

	useEffect(() => {
		const saved = readParticipantsFromStorage();
		setParticipants(saved);
		setSelectedIds(saved.filter((p) => p.checkedByDefault).map((p) => p.id));
	}, []);

	useEffect(() => {
		const selected = participants
			.filter((p) => selectedIds.includes(p.id))
			.map(({ name: attendeeName, role: attendeeRole, group: attendeeGroup }) => ({
				name: attendeeName,
				role: attendeeRole || undefined,
				group: attendeeGroup,
			}));
		onSelectionChangeRef.current(selected);
	}, [participants, selectedIds]);

	function handleAddParticipant() {
		const cleanName = name.trim();
		const cleanRole = role.trim();
		if (!cleanName) {
			setFormError('Indique au moins le nom et prénom de la personne.');
			return;
		}

		setFormError('');
		const newItem: CseParticipant = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			name: cleanName,
			role: cleanRole,
			group,
			checkedByDefault,
		};
		const updated = [...participants, newItem];
		setParticipants(updated);
		writeParticipantsToStorage(updated);
		if (checkedByDefault) setSelectedIds((prev) => [...prev, newItem.id]);
		setName('');
		setRole('');
		setCheckedByDefault(true);
	}

	function handleDeleteParticipant(id: string) {
		const updated = participants.filter((p) => p.id !== id);
		setParticipants(updated);
		writeParticipantsToStorage(updated);
		setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
	}

	function toggleSelection(id: string) {
		setSelectedIds((prev) =>
			prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
		);
	}

	const elusList = participants.filter((p) => p.group === 'bureau_elus');
	const intervenantsList = participants.filter((p) => p.group === 'intervenants');

	function renderParticipant(person: CseParticipant) {
		return (
			<label
				key={person.id}
				className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 cursor-pointer hover:border-slate-700"
			>
				<input
					type="checkbox"
					checked={selectedIds.includes(person.id)}
					onChange={() => toggleSelection(person.id)}
					className="h-4 w-4 rounded border-slate-600 accent-blue-500"
				/>
				<span className="font-medium text-white">{person.name}</span>
				{person.role && <span className="text-slate-400">— {person.role}</span>}
			</label>
		);
	}

	return (
		<div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h3 className="text-sm font-semibold text-white">
						Participants &amp; intervenants de la séance ({selectedIds.length} coché
						{selectedIds.length > 1 ? 's' : ''})
					</h3>
					<p className="text-xs text-slate-400">
						Coche les personnes présentes pour garantir la bonne orthographe des noms et
						fonctions dans le PV.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{participants.length > 0 && (
						<>
							<button type="button" onClick={() => setSelectedIds(participants.map((p) => p.id))} className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800">
								Tout cocher
							</button>
							<button type="button" onClick={() => setSelectedIds([])} className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800">
								Tout décocher
							</button>
						</>
					)}
					<button type="button" onClick={() => setIsManaging((prev) => !prev)} className="rounded-lg bg-blue-600/20 border border-blue-500/40 px-3 py-1 text-xs font-medium text-blue-300 hover:bg-blue-600/30">
						{isManaging ? 'Fermer le paramétrage' : 'Paramétrer la liste'}
					</button>
				</div>
			</div>

			{participants.length === 0 ? (
				<p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
					Aucune personne enregistrée pour l&apos;instant. Clique sur{' '}
					<strong>Paramétrer la liste</strong> pour enregistrer la présidente, les élus et
					les intervenants habituels.
				</p>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Présidente, Bureau &amp; Élus ({elusList.length})</p>
						{elusList.length ? <div className="space-y-1.5">{elusList.map(renderParticipant)}</div> : <p className="text-xs text-slate-500">Aucun élu enregistré.</p>}
					</div>
					<div className="space-y-2">
						<p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Intervenants ponctuels / Direction ({intervenantsList.length})</p>
						{intervenantsList.length ? <div className="space-y-1.5">{intervenantsList.map(renderParticipant)}</div> : <p className="text-xs text-slate-500">Aucun intervenant enregistré.</p>}
					</div>
				</div>
			)}

			{isManaging && (
				<div className="border-t border-slate-800 pt-4 space-y-4">
					<div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
						<div>
							<label className="block text-xs text-slate-300 mb-1">Nom et prénom *</label>
							<input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Claire Moreau" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
						</div>
						<div>
							<label className="block text-xs text-slate-300 mb-1">Fonction / Rôle</label>
							<input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex. : Présidente du CSE" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" />
						</div>
						<div>
							<label className="block text-xs text-slate-300 mb-1">Catégorie</label>
							<select value={group} onChange={(e) => setGroup(e.target.value as ParticipantGroup)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white">
								<option value="bureau_elus">Présidente / Bureau / Élu</option>
								<option value="intervenants">Intervenant ponctuel</option>
							</select>
						</div>
						<button type="button" onClick={handleAddParticipant} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 cursor-pointer">Ajouter</button>
						<div className="sm:col-span-4">
							<label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
								<input type="checkbox" checked={checkedByDefault} onChange={(e) => setCheckedByDefault(e.target.checked)} className="rounded border-slate-600 accent-blue-500" />
								Cocher automatiquement cette personne à l&apos;ouverture d&apos;une séance
							</label>
						</div>
					</div>
					{formError && <p className="text-xs text-rose-400">{formError}</p>}
					{participants.length > 0 && (
						<div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
							{participants.map((p) => (
								<div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs">
									<div className="text-slate-200">
										<span className="font-medium text-white">{p.name}</span>
										{p.role && <span className="text-slate-400"> — {p.role}</span>}
										<span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{p.group === 'bureau_elus' ? 'Élu / Bureau' : 'Intervenant'}</span>
									</div>
									<button type="button" onClick={() => handleDeleteParticipant(p.id)} className="text-rose-400 hover:text-rose-300 px-2 py-0.5 cursor-pointer">Supprimer</button>
								</div>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
