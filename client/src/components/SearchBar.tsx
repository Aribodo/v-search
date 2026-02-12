import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
}

export const SearchBar = ({ value, onChange, onSearch }: SearchBarProps) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="flex items-center bg-card border-2 border-border rounded-2xl overflow-hidden shadow-[var(--shadow-card)] hover:border-foreground transition-all duration-300">
        <Search className="ml-6 h-5 w-5 text-muted-foreground self-start mt-8" />
        <Input
          type="text"
          placeholder="Search yourself..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          className="border-0 bg-transparent text-lg py-12 px-6 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground min-h-[120px]"
        />
      </div>
    </div>
  );
};
