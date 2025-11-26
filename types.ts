export interface Chapter {
  title: string;
  content: string;
}

export interface Book {
  id: string;
  title: string;
  author: string; // Used as Channel Name for videos
  description: string;
  coverUrl?: string;
  language: string;
  isDownloaded: boolean;
  chapters: Chapter[];
  lastReadChapterIndex?: number;
  mediaType?: 'book' | 'video'; // New field to distinguish content type
}

export enum ViewState {
  LIBRARY = 'LIBRARY',
  SEARCH = 'SEARCH',
  READER = 'READER',
  SETTINGS = 'SETTINGS'
}

export interface SearchResult {
  title: string;
  author: string; // Channel Name for videos
  description: string;
  originalLanguage: string;
  mediaType: 'book' | 'video';
}

export interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  speed: number;
}