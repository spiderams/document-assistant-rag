export type Lang = 'fr' | 'en'

const fr = {
  appTitle: 'Assistant documentaire',
  appSubtitle: 'Boréal Solutions (documents fictifs)',
  tabAssistant: 'Assistant',
  tabDocuments: 'Documents',

  emptyTitle: 'Posez une question sur les documents de l’entreprise',
  emptyText:
    'Les réponses viennent uniquement des documents importés, avec le fichier, la page et la phrase exacte qui les justifie. Si l’information n’y est pas, l’assistant le dit.',
  examples: [
    'Combien de semaines de vacances après 3 ans de service ?',
    'Puis-je prendre des vacances pendant ma probation ?',
    'Quel est le montant maximum remboursé pour les repas ?',
    'Puis-je accepter une carte-cadeau de 50 $ d’un fournisseur ?',
  ],
  placeholder: 'Ex. : Dans quel délai dois-je soumettre mes reçus ?',
  inputLabel: 'Votre question',
  ask: 'Demander',
  searching: 'Recherche dans les documents…',
  error: 'Erreur',
  notFound: 'Information introuvable.',
  seeSource: 'Voir la source',
  verified: '✓ Citation vérifiée',
  verifiedTitle: 'La phrase citée existe mot pour mot dans le document',
  notVerified: '! Non vérifiée',
  notVerifiedTitle: 'La phrase citée n’a pas été retrouvée telle quelle',
  page: 'p.',
  openPdf: (page: number) => `Ouvrir le PDF à la page ${page} ↗`,

  dropTitle: 'Glissez vos PDF ici',
  dropText: 'ou cliquez pour choisir des fichiers — ils sont importés puis indexés automatiquement',
  onlyPdf: 'Seuls les fichiers PDF sont acceptés.',
  importing: 'Import…',
  indexing: 'Indexation…',
  importError: 'Erreur à l’import',
  doneDetail: (pages: number, chunks: number) => `${pages} pages, ${chunks} passages`,
  documents: 'Documents',
  indexedCount: (n: number, total: number) => `${n} indexé${n > 1 ? 's' : ''} sur ${total}`,
  loading: 'Chargement…',
  noDocs: 'Aucun document. Importez un premier PDF ci-dessus.',
  colFile: 'Fichier',
  colPages: 'Pages',
  colStatus: 'Statut',
  colAdded: 'Ajouté le',
  status: { uploaded: 'Importé, non indexé', indexed: 'Indexé', error: 'Erreur' },
  index: 'Indexer',
  delete: 'Supprimer',
  confirmDelete: (name: string) => `Supprimer « ${name} » et son index ?`,
  dateLocale: 'fr-CA',
}

export type Dict = typeof fr

const en: Dict = {
  appTitle: 'Document Assistant',
  appSubtitle: 'Boréal Solutions (fictional documents)',
  tabAssistant: 'Assistant',
  tabDocuments: 'Documents',

  emptyTitle: 'Ask a question about the company’s documents',
  emptyText:
    'Answers come only from the uploaded documents, with the file, the page and the exact sentence that supports them. If the information isn’t there, the assistant says so.',
  examples: [
    'How many weeks of vacation do I get after 3 years of service?',
    'Can I take vacation during my probation?',
    'What is the maximum meal allowance per day?',
    'Can I accept a $50 gift card from a supplier?',
  ],
  placeholder: 'e.g. How long do I have to submit my receipts?',
  inputLabel: 'Your question',
  ask: 'Ask',
  searching: 'Searching the documents…',
  error: 'Error',
  notFound: 'Information not found.',
  seeSource: 'See source',
  verified: '✓ Verified quote',
  verifiedTitle: 'The quoted sentence exists word for word in the document',
  notVerified: '! Not verified',
  notVerifiedTitle: 'The quoted sentence could not be found as is',
  page: 'p.',
  openPdf: (page: number) => `Open the PDF at page ${page} ↗`,

  dropTitle: 'Drop your PDFs here',
  dropText: 'or click to choose files — they are uploaded and indexed automatically',
  onlyPdf: 'Only PDF files are accepted.',
  importing: 'Uploading…',
  indexing: 'Indexing…',
  importError: 'Upload error',
  doneDetail: (pages: number, chunks: number) => `${pages} pages, ${chunks} chunks`,
  documents: 'Documents',
  indexedCount: (n: number, total: number) => `${n} of ${total} indexed`,
  loading: 'Loading…',
  noDocs: 'No documents yet. Upload a first PDF above.',
  colFile: 'File',
  colPages: 'Pages',
  colStatus: 'Status',
  colAdded: 'Added',
  status: { uploaded: 'Uploaded, not indexed', indexed: 'Indexed', error: 'Error' },
  index: 'Index',
  delete: 'Delete',
  confirmDelete: (name: string) => `Delete “${name}” and its index?`,
  dateLocale: 'en-CA',
}

export const DICTS: Record<Lang, Dict> = { fr, en }

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    /* stockage indisponible */
  }
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export function saveLang(lang: Lang) {
  try {
    localStorage.setItem('lang', lang)
  } catch {
    /* stockage indisponible */
  }
}
