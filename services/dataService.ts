import type { Person } from '../types';

// Helper for the download logic to avoid repetition
function triggerDownload(blob: Blob, fileName: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

// Make the function async to handle the promise from navigator.share
async function downloadFile(content: string, fileName: string, contentType: string) {
    const blob = new Blob([content], { type: contentType });
    const file = new File([blob], fileName, { type: contentType });
    
    // Check for Web Share API support for files
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        const shareData = {
            files: [file],
            title: 'Stammbaum Daten',
            text: `Stammbaum Daten als ${fileName}.`,
        };
        try {
            await navigator.share(shareData);
            return; // Exit if share is successful
        } catch (error) {
            // If user cancels the share dialog, do not fall back to download
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('File share was cancelled by the user.');
                return;
            }
            // For any other share error, log it and fall back to direct download
            console.error('File share failed, falling back to download:', error);
        }
    } 
    
    // Fallback for browsers that don't support sharing files or if sharing fails
    triggerDownload(blob, fileName);
}

function convertToCSV(people: Person[]): string {
    if (people.length === 0) return '';
    
    // Explicitly define headers to control order and exclude photoUrl
    const headers: (keyof Person)[] = [
        'id', 'code', 'name', 'gender', 'birthDate', 'deathDate', 
        'birthPlace', 'parentId', 'partnerId', 'ringCode', 
        'inheritedFrom', 'hasRing', 'ringHistory', 'comment'
    ];
    const csvRows = [headers.join(',')];

    for (const person of people) {
        const values = headers.map(header => {
            let value = person[header];
            
            // Handle different data types
            if (value === null || value === undefined) {
                return '';
            }
            
            if (Array.isArray(value)) {
                value = value.join(';');
            }
            
            if (typeof value === 'boolean') {
                value = value ? 'true' : 'false';
            }
            
            // Escape quotes and wrap in quotes if contains comma or quotes
            if (typeof value === 'string') {
                value = value.replace(/"/g, '""');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
            }
            
            return value;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
}

function parseCSV(csvText: string): Person[] {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const people: Person[] = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        // ✅ KORRIGIERT: Korrekter CSV-Parser mit Anführungszeichen-Behandlung
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current); // Letzten Wert hinzufügen

        const person: any = {};
        for (let j = 0; j < headers.length && j < values.length; j++) {
            let value: any = values[j].trim();
            const header = headers[j];
            
            // Entferne umschließende Anführungszeichen
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1).replace(/""/g, '"');
            }
            
            // Typ-Konvertierung
            if (value === '') {
                value = null;
            } else if (header === 'ringHistory') {
                value = value ? value.split(';').filter((x: string) => x) : [];
            } else if (header === 'hasRing') {
                value = value === 'true';
            } else if (header === 'birthDate' || header === 'deathDate') {
                // Datumswerte bleiben als String (laut types.ts)
                value = value || null;
            } else if (header === 'parentId' || header === 'partnerId' || header === 'inheritedFrom') {
                value = value || null;
            }
            
            person[header] = value;
        }
        
        // ✅ Sicherstellen, dass alle required Felder existieren
        const completePerson: Person = {
            id: person.id || '',
            code: person.code || '',
            name: person.name || '',
            gender: person.gender || 'd',
            birthDate: person.birthDate || '',
            deathDate: person.deathDate || null,
            birthPlace: person.birthPlace || null,
            parentId: person.parentId || null,
            partnerId: person.partnerId || null,
            hasRing: person.hasRing || false,
            ringCode: person.ringCode || null,
            ringHistory: person.ringHistory || [],
            inheritedFrom: person.inheritedFrom || null,
            comment: person.comment || null,
            photoUrl: person.photoUrl || null,
        };
        
        people.push(completePerson);
    }
    return people;
}

export const exportData = (people: Person[], format: 'json' | 'csv') => {
    if (format === 'json') {
        const jsonString = JSON.stringify(people, null, 2);
        downloadFile(jsonString, 'stammbaum.json', 'application/json');
    } else if (format === 'csv') {
        const csvString = convertToCSV(people);
        downloadFile(csvString, 'stammbaum.csv', 'text/csv;charset=utf-8;');
    }
};

export const importData = (file: File): Promise<Person[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const content = event.target?.result as string;
                if (file.name.endsWith('.json')) {
                    const data = JSON.parse(content);
                    // ✅ Bessere Validierung
                    if (Array.isArray(data) && data.every(item => 
                        typeof item === 'object' && item !== null && 'id' in item
                    )) {
                        resolve(data);
                    } else {
                        reject(new Error('Ungültiges JSON-Format. Erwartet wird ein Array von Person-Objekten.'));
                    }
                } else if (file.name.endsWith('.csv')) {
                    const data = parseCSV(content);
                    if (Array.isArray(data) && data.length > 0) {
                        resolve(data);
                    } else {
                        reject(new Error('Ungültiges CSV-Format oder leere Datei.'));
                    }
                } else {
                    reject(new Error('Nicht unterstützter Dateityp. Bitte .json oder .csv verwenden.'));
                }
            } catch (e) {
                reject(new Error(`Fehler beim Parsen der Datei: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`));
            }
        };
        reader.onerror = (error) => reject(new Error('Fehler beim Lesen der Datei.'));
        reader.readAsText(file);
    });
};
