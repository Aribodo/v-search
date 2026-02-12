import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { ResultsSection } from "@/components/ResultsSection";
import { ThemeToggle } from "@/components/ThemeToggle";
import UploadFile from "@/components/UploadFile";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const response = await fetch(
      `${API_BASE}/api/search?query=${encodeURIComponent(searchQuery)}`
    );
    const data = await response.json();
    setResults(data.body?.hits?.hits || []);
    setHasSearched(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-24 sm:pt-32 sm:pb-32">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight text-foreground">
                KATTALOG
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground font-medium">
                save yourself and search yourself
              </p>
            </div>

            <div className="pt-8">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleSearch}
              />
            </div>

            <div className="flex justify-center pt-8">
              <UploadFile />
            </div>
          </div>
        </div>
      </section>

      {hasSearched && (
        <ResultsSection results={results} searchQuery={searchQuery} />
      )}
    </div>
  );
};

export default Index;
