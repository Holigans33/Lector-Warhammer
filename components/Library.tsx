import React from 'react';
import { Book, ViewState } from '../types';
import { BookOpen, Trash2, Import, FileText } from 'lucide-react';

interface LibraryProps {
  books: Book[];
  onOpenBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setViewState: (view: ViewState) => void;
}

const Library: React.FC<LibraryProps> = ({ books, onOpenBook, onDeleteBook, onImport, setViewState }) => {
  
  const ImportButton = ({ fullWidth = false }) => (
    <label className={`${fullWidth ? 'w-full justify-center' : ''} px-6 py-2 bg-wh-slate border border-wh-gold text-wh-gold rounded hover:bg-wh-dark cursor-pointer transition-colors flex items-center gap-2 group`}>
        <FileText size={18} className="group-hover:text-white transition-colors" />
        <span className="font-bold">Abrir Archivo Local (.txt)</span>
        <input type="file" accept=".txt" onChange={onImport} className="hidden" />
    </label>
  );

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center animate-in fade-in duration-500">
        <BookOpen className="w-16 h-16 mb-4 text-wh-gold opacity-50" />
        <h2 className="text-2xl font-serif text-wh-gold mb-2">El Archivo está Vacío</h2>
        <p className="mb-6">No has descargado ni importado ningún tomo sagrado.</p>
        
        <div className="flex flex-col md:flex-row gap-4 w-full max-w-md justify-center">
            <button 
                onClick={() => setViewState(ViewState.SEARCH)}
                className="px-6 py-2 bg-wh-red text-white rounded hover:bg-red-700 transition-colors font-bold shadow-[0_0_10px_rgba(136,8,8,0.3)]"
            >
                Buscar en la Noosphere
            </button>
            <ImportButton />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full pb-24">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-3xl font-serif text-wh-gold border-b border-wh-gold/30 pb-2 w-full">Biblioteca Local</h2>
        <div className="shrink-0">
            <ImportButton />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map((book) => (
          <div 
            key={book.id} 
            className="group relative bg-wh-slate/50 border border-gray-700 rounded-lg overflow-hidden hover:border-wh-gold transition-all duration-300 shadow-lg hover:shadow-wh-gold/20"
          >
            <div className={`absolute top-0 left-0 w-1 h-full ${book.mediaType === 'video' ? 'bg-wh-red' : 'bg-wh-gold'}`} />
            <div className="p-5 pl-7">
              <h3 className="font-bold text-lg text-white mb-1 truncate">{book.title}</h3>
              <p className="text-sm text-gray-400 mb-4">{book.author}</p>
              
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => onOpenBook(book)}
                  className="px-4 py-2 bg-wh-gold text-black font-bold text-sm rounded hover:bg-yellow-500 transition-colors flex items-center gap-2"
                >
                  <BookOpen size={16} />
                  LEER
                </button>
                <button
                  onClick={() => onDeleteBook(book.id)}
                  className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                  title="Purgar del archivo"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Library;