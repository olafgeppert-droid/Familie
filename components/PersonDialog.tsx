import React, { useState, useEffect, useMemo } from 'react';
import type { Person, PersonFormData } from '../types';
import { CloseIcon, DeleteIcon, UserIcon } from './Icons';

interface PersonDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (person: PersonFormData) => void;
    onDelete: (person: Person) => void;
    person: Person | null;
    people: Person[];
}

const InputField: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className={`mt-1 block w-full rounded-md border-black shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 text-base bg-gray-200 h-11 ${props.className}`} />
);

const SelectField: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
     <select {...props} className={`mt-1 block w-full rounded-md border-black shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 text-base bg-gray-200 h-11 ${props.className}`} />
);

const formatProperNoun = (str: string | null | undefined): string | null => {
    if (!str) return null;
    return str.toLowerCase().replace(/(^|\s|\/|-)\w/g, c => c.toUpperCase());
};

export const PersonDialog: React.FC<PersonDialogProps> = ({ isOpen, onClose, onSave, onDelete, person, people }) => {
    const getInitialFormData = (): PersonFormData => ({
        id: '',
        name: '',
        gender: 'm', // default männlich
        birthDate: '',
        deathDate: null,
        birthPlace: null,
        relationship: people.length === 0 ? 'progenitor' : 'child',
        parentId: people.length > 0 ? people[0].id : null,
        partnerId: null,
        inheritedFrom: null,
        hasRing: false,
        comment: null,
        photoUrl: null,
    });

    const [formData, setFormData] = useState<PersonFormData>(getInitialFormData());
    const [errors, setErrors] = useState<Record<string, string>>({});
    
    const potentialParents = useMemo(
        () => people.filter(p => !p.code.endsWith('x')),
        [people]
    );

    const potentialPartners = useMemo(() => {
        return people.filter(p => {
            if (p.id === person?.id) return false;             // sich selbst nicht
            if (p.code.endsWith('x')) return false;            // keine Partner-Datensätze
            const isCurrentSelection = formData.partnerId ? p.id === formData.partnerId : false;
            return !p.partnerId || isCurrentSelection;         // nur freie Partner oder aktueller
        });
    }, [people, person?.id, formData.partnerId]);

    useEffect(() => {
        if (isOpen) {
            if (person) {
                let relationship: PersonFormData['relationship'] = 'child';
                if (person.code === '1') relationship = 'progenitor';
                else if (person.code.endsWith('x')) relationship = 'partner';

                // Partner-Fallback über Code ableiten
                let derivedPartnerId: string | null = person.partnerId ?? null;
                if (!derivedPartnerId && person.code.endsWith('x')) {
                    const baseCode = person.code.slice(0, -1);
                    const partnerOf = people.find(p => p.code === baseCode);
                    if (partnerOf) derivedPartnerId = partnerOf.id;
                }

                setFormData({
                    id: person.id,
                    name: person.name,
                    gender: person.gender || 'm',
                    birthDate: person.birthDate,
                    deathDate: person.deathDate,
                    birthPlace: person.birthPlace,
                    parentId: person.parentId,
                    partnerId: derivedPartnerId,
                    relationship,
                    inheritedFrom: person.inheritedFrom,
                    hasRing: person.hasRing,
                    comment: person.comment,
                    photoUrl: person.photoUrl,
                });
            } else {
                setFormData(getInitialFormData());
            }
            setErrors({});
        }
    }, [person, isOpen, people]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) newErrors.name = "Name ist erforderlich.";
        if (!formData.birthDate) newErrors.birthDate = "Geburtsdatum ist erforderlich.";
        if (formData.deathDate && formData.birthDate && formData.deathDate < formData.birthDate) {
            newErrors.deathDate = "Todesdatum kann nicht vor dem Geburtsdatum liegen.";
        }
        if (formData.relationship === 'child' && !formData.parentId) {
            newErrors.parentId = "Ein Elternteil muss ausgewählt werden.";
        }
        if (formData.relationship === 'partner' && !formData.partnerId) {
            newErrors.partnerId = "Ein Partner muss ausgewählt werden.";
        }

        // Zusatz: Partner darf nicht schon vergeben sein
        if (formData.relationship === 'partner' && formData.partnerId) {
            const selected = people.find(p => p.id === formData.partnerId);
            if (selected && selected.partnerId && selected.partnerId !== formData.id) {
                newErrors.partnerId = `${selected.name} ist bereits vergeben.`;
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            const dataToSave = { 
                ...formData,
                name: formatProperNoun(formData.name) || '',
                birthPlace: formatProperNoun(formData.birthPlace),
                gender: formData.gender || 'm',
            };
            if (dataToSave.relationship !== 'child') dataToSave.parentId = null;
            if (dataToSave.relationship !== 'partner') dataToSave.partnerId = null;
            onSave(dataToSave);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
            return;
        }

        if (type === 'date' && value === '') {
            setFormData(prev => ({ ...prev, [name]: null }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemovePhoto = () => {
        setFormData(prev => ({ ...prev, photoUrl: null }));
    };

    const handleDelete = () => {
        if (person) {
            const safePerson: Person = {
                ...person,
                parentId: null,
                partnerId: null,
            };
            onDelete(safePerson);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30 flex justify-center items-center p-4" aria-modal="true" role="dialog">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl animate-fade-in">
                <form onSubmit={handleSubmit}>
                    <div className="flex justify-between items-center p-4 border-b">
                        <h2 className="text-xl font-bold text-brand-primary">{person ? 'Person bearbeiten' : 'Neue Person hinzufügen'}</h2>
                        <button type="button" onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
                            <CloseIcon />
                        </button>
                    </div>

                    <div className="p-6 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">

                            {!person && people.length > 0 && (
                                <div className="md:col-span-2">
                                    <label className="block text-base font-medium text-gray-700">Beziehungstyp</label>
                                    <SelectField name="relationship" value={formData.relationship} onChange={handleChange}>
                                        <option value="child">Kind</option>
                                        <option value="partner">Partner(in)</option>
                                    </SelectField>
                                </div>
                            )}

                            {formData.relationship === 'child' && people.length > 0 && (
                                <div className="md:col-span-2">
                                    <label htmlFor="parentId" className="block text-base font-medium text-gray-700">Elternteil (aus der Stammlinie)</label>
                                    <SelectField id="parentId" name="parentId" value={formData.parentId || ''} onChange={handleChange} className={`${errors.parentId ? 'border-red-500' : ''}`}>
                                        {potentialParents.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                                    </SelectField>
                                    {errors.parentId && <p className="text-xs text-red-600 mt-1">{errors.parentId}</p>}
                                </div>
                            )}

                            {formData.relationship === 'partner' && (
                                <div className="md:col-span-2">
                                    <label htmlFor="partnerId" className="block text-base font-medium text-gray-700">Partner(in) von</label>
                                    <SelectField id="partnerId" name="partnerId" value={formData.partnerId || ''} onChange={handleChange} className={`${errors.partnerId ? 'border-red-500' : ''}`}>
                                        <option value="">-- Bitte auswählen --</option>
                                        {potentialPartners.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                                    </SelectField>
                                    {errors.partnerId && <p className="text-xs text-red-600 mt-1">{errors.partnerId}</p>}
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <label htmlFor="name" className="block text-base font-medium text-gray-700">Vollständiger Name</label>
                                <InputField type="text" id="name" name="name" value={formData.name} onChange={handleChange} placeholder="z.B. Max Mustermann" className={errors.name ? 'border-red-500' : ''} />
                                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-base font-medium text-gray-700">Foto</label>
                                <div className="mt-2 flex items-center space-x-4">
                                    <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border">
                                        {formData.photoUrl ? (
                                            <img src={formData.photoUrl} alt="Vorschau" className="w-full h-full object-cover" />
                                        ) : (
                                            <UserIcon className="w-16 h-16 text-gray-400" />
                                        )}
                                    </div>
                                    <div className="flex flex-col space-y-2">
                                        <label htmlFor="photo-upload" className="cursor-pointer px-3 py-2 bg-white text-sm font-medium text-gray-700 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                                            <span>Foto ändern</span>
                                            <input id="photo-upload" name="photo-upload" type="file" className="sr-only" onChange={handlePhotoChange} accept="image/png, image/jpeg, image/webp" />
                                        </label>
                                        {formData.photoUrl && (
                                            <button type="button" onClick={handleRemovePhoto} className="px-3 py-2 bg-white text-sm font-medium text-red-600 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">
                                                Foto entfernen
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label htmlFor="birthDate" className="block text-base font-medium text-gray-700">Geburtsdatum</label>
                                <InputField type="date" id="birthDate" name="birthDate" value={formData.birthDate || ''} onChange={handleChange} className={errors.birthDate ? 'border-red-500' : ''} />
                                {errors.birthDate && <p className="text-xs text-red-600 mt-1">{errors.birthDate}</p>}
                            </div>
                             <div>
                                <label htmlFor="birthPlace" className="block text-base font-medium text-gray-700">Geburtsort</label>
                                <InputField type="text" id="birthPlace" name="birthPlace" value={formData.birthPlace || ''} onChange={handleChange} placeholder="z.B. Berlin" />
                            </div>

                             <div>
                                <label htmlFor="deathDate" className="block text-base font-medium text-gray-700">Todesdatum (optional)</label>
                                <InputField type="date" id="deathDate" name="deathDate" value={formData.deathDate || ''} onChange={handleChange} className={errors.deathDate ? 'border-red-500' : ''} />
                                {errors.deathDate && <p className="text-xs text-red-600 mt-1">{errors.deathDate}</p>}
                            </div>
                             <div>
                                <label htmlFor="gender" className="block text-base font-medium text-gray-700">Geschlecht</label>
                                <SelectField id="gender" name="gender" value={formData.gender} onChange={handleChange}>
                                    <option value="m">Männlich</option>
                                    <option value="f">Weiblich</option>
                                    <option value="d">Divers</option>
                                </SelectField>
                            </div>
                           
                            <div>
                                <label htmlFor="inheritedFrom" className="block text-base font-medium text-gray-700">Ring geerbt von (Code)</label>
                                <InputField type="text" id="inheritedFrom" name="inheritedFrom" value={formData.inheritedFrom || ''} onChange={handleChange} placeholder="Personen-Code, z.B. 1A" />
                            </div>
                             <div className="flex items-center pt-8 space-x-2">
                                <input
                                    id="hasRing"
                                    name="hasRing"
                                    type="checkbox"
                                    checked={formData.hasRing}
                                    onChange={handleChange}
                                    className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="hasRing" className="text-base font-medium text-gray-700">Wappenringbesitzer?</label>
                             </div>

                            <div className="md:col-span-2">
                                <label htmlFor="comment" className="block text-base font-medium text-gray-700">Kommentar</label>
                                <textarea id="comment" name="comment" value={formData.comment || ''} onChange={handleChange} rows={4} placeholder="Besondere Anmerkungen oder Lebenslauf..." className="mt-1 block w-full rounded-md border-black shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 text-base bg-gray-200" />
                            </div>

                        </div>
                    </div>

                    <div className="flex justify-between items-center p-4 bg-gray-50 border-t">
                        <div>
                            {person && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                    <DeleteIcon className="w-5 h-5 mr-2" />
                                    Löschen
                                </button>
                            )}
                        </div>
                        <div className="flex space-x-4">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors">
                                Abbrechen
                            </button>
                            <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-dark transition-colors">
                                Speichern
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
