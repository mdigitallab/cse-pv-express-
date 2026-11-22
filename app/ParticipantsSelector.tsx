 'use client';

import React, { useEffect, useState } from 'react';

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

function loadSavedParticipants(): CseParticipant[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
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

	useEffect(() => {
		const saved = loadSavedParticipants();
		setParticipants(saved);
		setSelectedIds(saved.filter((p) => p.checkedByDefault).map((p) => p.id));
	}, []);

	useEffect(() => {
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(participants));
		}
		const selected = participants
			.filter((p) => selectedIds.includes(p.id))
			.map(({ name: pName, role: pRole, group: pGroup }) => ({
				name: pName,
				role: pRole || undefined,
				group: pGroup,
			}));
		onSelectionChange(selected);
	}, [participants, selectedIds, onSelectionChange]);

	function handleAddParticipant(e: React.FormEvent) {
		e.preventDefault();
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

		setParticipants((prev) => [...prev, newItem]);
		if (checkedByDefault) {
			setSelectedIds((prev) => [...prev, newItem.id]);
		}
		setName('');
		setRole('');
		setCheckedByDefault(true);
	}

	function handleDeleteParticipant(id: string) {
		setParticipants((prev) => prev.filter((p) => p.id !== id));
		setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
	}

	function toggleSelection(id: string) {
		setSelectedIds((prev) =>
			prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
		);
	}

	function selectAll() {
		setSelectedIds(participants.map((p) => p.id));
	}

	function clearAll() {
		setSelectedIds([]);
	}

	const elusList = participants.filter((p) => p.group === 'bureau_elus');
	const intervenantsList = participants.filter((p) => p.group === 'intervenants');

	return (
		<div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h3 className="text-sm font-semibold text-white">
						Participants & intervenants de la séance ({selectedIds.length} coché
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
							<button type="button" onClick={selectAll} className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800">
								Tout cocher
							</button>
							<button type="button" onClick={clearAll} className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800">
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
					Aucune personne enregistrée pour l&apos;instant. Clique sur <strong>Paramétrer la liste</strong> pour enregistrer la présidente, les élus et les intervenants habituels.
				</p>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{[
						{ title: `Présidente, Bureau & Élus (${elusList.length})`, empty: 'Aucun élu enregistré.', list: elusList },
						{ title: `Intervenants ponctuels / Direction (${intervenantsList.length})`, empty: 'Aucun intervenant enregistré.', list: intervenantsList },
					].map(({ title, empty, list }) => (
						<div key={title} className="space-y-2">
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
							{list.length === 0 ? <p className="text-xs text-slate-500">{empty}</p> : <div className="space-y-1.5">{list.map((person) => {
								const checked = selectedIds.includes(person.id);
								return <label key={person.id} className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 cursor-pointer hover:border-slate-700">
									<input type="checkbox" checked={checked} onChange={() => toggleSelection(person.id)} className="h-4 w-4 rounded border-slate-600 accent-blue-500" />
									<span className="font-medium text-white">{person.name}</span>{person.role && <span className="text-slate-400">— {person.role}</span>}
								</label>;
							})}</div>}
						</div>
					))}
				</div>
			)}

			{isManaging && <div className="border-t border-slate-800 pt-4 space-y-4">
				<form onSubmit={handleAddParticipant} className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
					<div><label className="block text-xs text-slate-300 mb-1">Nom et prénom *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Claire Moreau" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" /></div>
					<div><label className="block text-xs text-slate-300 mb-1">Fonction / Rôle</label><input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex. : Présidente du CSE" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white" /></div>
					<div><label className="block text-xs text-slate-300 mb-1">Catégorie</label><select value={group} onChange={(e) => setGroup(e.target.value as ParticipantGroup)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"><option value="bureau_elus">Présidente / Bureau / Élu</option><option value="intervenants">Intervenant ponctuel</option></select></div>
					<div><button type="submit" className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500">Ajouter</button></div>
					<div className="sm:col-span-4"><label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer"><input type="checkbox" checked={checkedByDefault} onChange={(e) => setCheckedByDefault(e.target.checked)} className="rounded border-slate-600 accent-blue-500" />Cocher automatiquement cette personne à l&apos;ouverture d&apos;une séance</label></div>
				</form>
				{formError && <p className="text-xs text-rose-400">{formError}</p>}
				{participants.length > 0 && <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">{participants.map((p) => <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs"><div className="text-slate-200"><span className="font-medium text-white">{p.name}</span>{p.role && <span className="text-slate-400"> — {p.role}</span>}<span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">{p.group === 'bureau_elus' ? 'Élu / Bureau' : 'Intervenant'}</span></div><button type="button" onClick={() => handleDeleteParticipant(p.id)} className="text-rose-400 hover:text-rose-300 px-2 py-0.5">Supprimer</button></div>)}</div>}
			</div>}
		</div>
	);
}
