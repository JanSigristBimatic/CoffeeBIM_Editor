import { Coffee } from 'lucide-react';

export const BuyMeACoffeeButton = () => {
  return (
    <a
      href="https://buymeacoffee.com/bimatic"
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFDD00] hover:bg-[#FFDD00]/90 transition-colors shadow-md hover:shadow-lg"
    >
      <Coffee className="h-4 w-4 text-black" />
      <span className="text-sm font-semibold text-black">
        Buy me a coffee
      </span>
    </a>
  );
};
