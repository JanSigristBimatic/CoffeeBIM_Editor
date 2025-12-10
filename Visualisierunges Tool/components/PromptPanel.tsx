import React, { useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';

interface PromptPanelProps {
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
}

const PromptPanel: React.FC<PromptPanelProps> = ({ onGenerate, isGenerating }) => {
  const [prompt, setPrompt] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt);
    }
  };

  const suggestions = [
    "Modern glass facade, sunny afternoon, realistic reflections",
    "Concrete brutalist style, dramatic overcast sky, high detail",
    "Sustainable architecture with vertical gardens, warm sunset light",
    "Futuristic steel structure, night time with neon city lights",
    "White marble cladding, soft morning light, ultra realistic"
  ];

  return (
    <div className="absolute bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 bg-gray-900/90 backdrop-blur-md border border-gray-700 p-4 rounded-xl shadow-2xl text-white">
      <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
        <Wand2 className="w-4 h-4" />
        Photorealistic Renderer
      </h3>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the atmosphere, materials, and lighting... (e.g., 'Realistic sunny day with glass reflections')"
          className="w-full bg-gray-800 border border-gray-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none h-24 text-gray-100 placeholder-gray-500"
          disabled={isGenerating}
        />
        
        <button
          type="submit"
          disabled={!prompt.trim() || isGenerating}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Rendering...
            </>
          ) : (
            'Generate Visualization'
          )}
        </button>
      </form>

      <div className="mt-4">
        <p className="text-xs text-gray-500 mb-2">Preset Styles:</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setPrompt(s)}
              className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded transition-colors text-left"
            >
              {s.split(',')[0]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PromptPanel;