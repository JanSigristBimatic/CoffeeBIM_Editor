import React from 'react';
import { X, Download, ArrowLeft } from 'lucide-react';

interface ResultModalProps {
  originalImage: string;
  generatedImage: string;
  prompt: string;
  onClose: () => void;
}

const ResultModal: React.FC<ResultModalProps> = ({ originalImage, generatedImage, prompt, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900">
          <div>
            <h2 className="text-xl font-bold text-white">Generation Result</h2>
            <p className="text-sm text-gray-400 mt-1 max-w-2xl truncate">Prompt: <span className="text-blue-400">"{prompt}"</span></p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6 bg-gray-950">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            
            {/* Original */}
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Original BIM View</span>
              </div>
              <div className="relative flex-1 bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
                <img 
                  src={originalImage} 
                  alt="Original BIM" 
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Generated */}
            <div className="flex flex-col h-full">
               <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Photorealistic Render</span>
                <a 
                  href={generatedImage} 
                  download={`bim-vision-${Date.now()}.png`}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  <Download className="w-3 h-3" />
                  Download
                </a>
              </div>
              <div className="relative flex-1 bg-gray-900 rounded-xl overflow-hidden border border-blue-900/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                <img 
                  src={generatedImage} 
                  alt="AI Generated" 
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex justify-end">
           <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Viewer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultModal;