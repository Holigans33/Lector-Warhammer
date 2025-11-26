import React, { useState, useEffect } from 'react';
import { Book, ViewState, SearchResult } from './types';
import { generateContentStructure } from './services/geminiService';
import Library from './components/Library';
import Search from './components/Search';
import Reader from './components/Reader';
import { BookMarked, Search as SearchIcon, Skull } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'wh40k_library_v2';

const App: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>(ViewState.LIBRARY);
  const [library, setLibrary] = useState<Book[]>([]);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load library from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration support for old v1 single string content
        const migrated = parsed.map((b: any) => {
            if (!b.chapters && b.content) {
                return { ...b, chapters: [{ title: 'Capítulo Recuperado', content: b.content }], content: undefined };
            }
            return b;
        });
        setLibrary(migrated);
      } catch (e) {
        console.error("Failed to load library", e);
      }
    }
  }, []);

  // Save library whenever it changes
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(library));
  }, [library]);

  const openBook = (book: Book) => {
    setCurrentBook(book);
    setViewState(ViewState.READER);
  };

  const addToLibrary = (book: Book, openImmediately: boolean = false) => {
    // Check if exists by title (avoid duplicates of content)
    const existingBook = library.find(b => b.title === book.title && b.author === book.author);
    
    if (existingBook) {
        if (openImmediately) {
            openBook(existingBook);
        } else {
            alert("Este registro ya está en tu biblioteca.");
        }
        return;
    }
    
    setLibrary(prev => [book, ...prev]);
    
    if (openImmediately) {
        openBook(book);
    } else {
        setViewState(ViewState.LIBRARY);
    }
  };

  // Función nativa para descargar texto como archivo
  const downloadAsTextFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain;charset=utf-8'});
    element.href = URL.createObjectURL(file);
    element.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownload = async (result: SearchResult) => {
    if (!process.env.API_KEY) {
        alert("Falta la API Key. No se puede conectar al Inmaterium.");
        return;
    }

    setIsProcessing(true);
    try {
      // Generate content (Simulated download/reconstruction) with multiple chapters
      const chapters = await generateContentStructure(result.title, result.author, result.mediaType);
      
      const newBook: Book = {
        id: crypto.randomUUID(),
        title: result.title,
        author: result.author,
        description: result.description,
        language: 'es', // We force Spanish generation
        isDownloaded: true,
        chapters: chapters, // New structure
        lastReadChapterIndex: 0,
        mediaType: result.mediaType
      };

      // 1. Añadir a la librería de la App
      addToLibrary(newBook, false); // No abrir inmediatamente, primero descargar

      // 2. Construir contenido plano para el archivo .txt
      let fullTextContent = `TÍTULO: ${newBook.title}\nAUTOR/CANAL: ${newBook.author}\n\n`;
      newBook.chapters.forEach(chap => {
        fullTextContent += `--- ${chap.title.toUpperCase()} ---\n\n${chap.content}\n\n`;
      });

      // 3. Ejecutar descarga nativa
      downloadAsTextFile(newBook.title, fullTextContent);

      // 4. Notificar y preguntar si leer
      if(confirm(`Transcripción descargada: "${newBook.title}.txt".\n\n¿Deseas proceder a la lectura en la aplicación ahora?`)) {
        openBook(newBook);
      } else {
        setViewState(ViewState.LIBRARY);
      }

    } catch (error) {
      alert("Error al reconstruir el registro. Intenta de nuevo.");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Purgar este registro de los archivos sagrados?")) {
      setLibrary(prev => prev.filter(b => b.id !== id));
      if (currentBook?.id === id) {
        setViewState(ViewState.LIBRARY);
        setCurrentBook(null);
      }
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        // Intentar parsear estructura básica si existe (--- TITULO ---)
        const lines = text.split('\n');
        const titleLine = lines.find(l => l.startsWith('TÍTULO:'))?.replace('TÍTULO:', '').trim() || file.name.replace('.txt', '');
        const authorLine = lines.find(l => l.startsWith('AUTOR/CANAL:'))?.replace('AUTOR/CANAL:', '').trim() || 'Importado Local';
        
        // Simple heurística para separar capítulos si se usa el formato de descarga de la app
        // Si no, todo es un solo capítulo
        const rawChapters = text.split('---').filter(Boolean);
        let chapters = [];
        
        if (rawChapters.length > 1 && text.includes('---')) {
            // Saltamos el primero si es metadata
            for (let i = 1; i < rawChapters.length; i+=2) {
                if (rawChapters[i+1]) {
                    chapters.push({
                        title: rawChapters[i].trim(),
                        content: rawChapters[i+1].trim()
                    });
                }
            }
        }
        
        if (chapters.length === 0) {
            chapters = [{ title: 'Contenido Completo', content: text }];
        }

        const newBook: Book = {
          id: crypto.randomUUID(),
          title: titleLine,
          author: authorLine,
          description: 'Archivo local importado',
          language: 'es',
          isDownloaded: true,
          chapters: chapters,
          lastReadChapterIndex: 0,
          mediaType: 'book'
        };
        addToLibrary(newBook, true);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  // Render View Logic
  const renderContent = () => {
    switch (viewState) {
      case ViewState.LIBRARY:
        return (
          <Library 
            books={library} 
            onOpenBook={openBook} 
            onDeleteBook={handleDelete}
            onImport={handleImport}
            setViewState={setViewState}
          />
        );
      case ViewState.SEARCH:
        return (
          <Search 
            onDownload={handleDownload} 
            isDownloading={isProcessing} 
          />
        );
      case ViewState.READER:
        if (!currentBook) return <div className="text-white p-10">Error: No book selected</div>;
        return (
          <Reader 
            book={currentBook} 
            onBack={() => setViewState(ViewState.LIBRARY)} 
          />
        );
      default:
        return <div>Unknown State</div>;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0b0f15] overflow-hidden font-sans text-gray-200">
      
      {/* Sidebar Navigation */}
      
      {viewState !== ViewState.READER && (
        <aside className="w-20 md:w-64 flex flex-col border-r border-wh-slate bg-wh-dark shrink-0 transition-all z-20">
          <div className="p-4 flex items-center justify-center md:justify-start gap-3 border-b border-wh-slate h-20">
            <div className="relative">
                <Skull className="text-wh-gold w-8 h-8 animate-pulse" />
                <div className="absolute inset-0 bg-wh-gold blur-lg opacity-20"></div>
            </div>
            <span className="hidden md:block font-serif font-bold text-xl tracking-wider text-wh-gold">LECTIO</span>
          </div>

          <nav className="flex-1 flex flex-col gap-2 p-2 mt-4">
            <button 
              onClick={() => setViewState(ViewState.LIBRARY)}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${viewState === ViewState.LIBRARY ? 'bg-wh-red text-white shadow-[0_0_10px_rgba(136,8,8,0.5)]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              <BookMarked size={24} />
              <span className="hidden md:block font-bold">Biblioteca</span>
            </button>
            <button 
              onClick={() => setViewState(ViewState.SEARCH)}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${viewState === ViewState.SEARCH ? 'bg-wh-red text-white shadow-[0_0_10px_rgba(136,8,8,0.5)]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              <SearchIcon size={24} />
              <span className="hidden md:block font-bold">Buscador</span>
            </button>
          </nav>

          <div className="p-4 border-t border-wh-slate">
            <div className="text-xs text-gray-500 text-center md:text-left">
              <p className="hidden md:block">Servidor: Terra</p>
              <p className="hidden md:block text-[10px] mt-1 opacity-50">V.40.004</p>
            </div>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
         {/* Background accent */}
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-wh-red/5 rounded-full blur-[100px] pointer-events-none"></div>
         
         {renderContent()}
      </main>
    </div>
  );
};

export default App;