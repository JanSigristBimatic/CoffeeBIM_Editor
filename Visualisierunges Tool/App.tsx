import React, { useRef, useState, useCallback } from 'react';
import { Layers, Info } from 'lucide-react';
import BimViewer from './components/BimViewer';
import PromptPanel from './components/PromptPanel';
import ResultModal from './components/ResultModal';
import { BimViewerRef } from './types';
import { editBimImage } from './services/geminiService';

const App: React.FC = () => {
  const bimRef = useRef<BimViewerRef>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ original: string; generated: string; prompt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (prompt: string) => {
    if (!bimRef.current) return;

    setError(null);
    const screenshot = bimRef.current.captureScreenshot();

    if (!screenshot) {
      setError("Failed to capture BIM view.");
      return;
    }

    setIsGenerating(true);

    try {
      const generatedImage = await editBimImage(screenshot, prompt);
      setResult({
        original: screenshot,
        generated: generatedImage,
        prompt: prompt
      });
    } catch (err) {
      setError("Failed to generate image. Please try again.");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const closeResult = () => {
    setResult(null);
  };

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden font-sans text-gray-100 selection:bg-blue-500/30">
      
      {/* Navbar Overlay */}
      <header className="absolute top-0 left-0 right-0 z-10 px-6 py-4 bg-gradient-to-b from-gray-950/80 to-transparent pointer-events-none flex justify-between items-start">
        <div className="pointer-events-auto">
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="text-blue-500" />
            BIM<span className="text-gray-400 font-light">Vision</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">Visualize your 3D models with Gemini AI</p>
        </div>
        
        <div className="pointer-events-auto">
           <button className="p-2 bg-gray-800/50 backdrop-blur rounded-full hover:bg-gray-700 transition text-gray-300">
             <Info className="w-5 h-5" />
           </button>
        </div>
      </header>

      {/* 3D Viewer Area */}
      <main className="w-full h-full">
        <BimViewer ref={bimRef} />
      </main>

      {/* Floating Prompt Panel */}
      <PromptPanel onGenerate={handleGenerate} isGenerating={isGenerating} />

      {/* Result Modal */}
      {result && (
        <ResultModal 
          originalImage={result.original}
          generatedImage={result.generated}
          prompt={result.prompt}
          onClose={closeResult}
        />
      )}

      {/* Error Toast */}
      {error && (
        <div className="absolute top-24 right-6 max-w-sm bg-red-900/90 border border-red-700 text-red-100 px-4 py-3 rounded-lg shadow-lg backdrop-blur-md animate-in slide-in-from-top-2">
          <p className="text-sm font-medium">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="absolute top-1 right-1 p-1 hover:bg-red-800 rounded"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Loading Overlay (Optional, distinct from button loading) */}
      {isGenerating && (
        <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          {/* Visual feedback is mainly in the button, this just dims the view slightly */}
        </div>
      )}
    </div>
  );
};

export default App;