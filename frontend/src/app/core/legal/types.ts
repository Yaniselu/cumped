export interface LegalSection { h: string; p: string[]; }
export interface LegalDoc { title: string; updated: string; sections: LegalSection[]; }
export type LegalDocs = Record<string, LegalDoc>;
