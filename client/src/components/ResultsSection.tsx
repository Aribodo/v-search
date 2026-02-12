import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowUpDown, Calendar, Star } from "lucide-react";

interface Item {
  id: number;
  title: string;
  description: string;
  date: string;
  relevance: number;
}

interface ResultsSectionProps {
  results: Item[];
  searchQuery: string;
}

type SortOption = "relevance" | "date" | "name";

export const ResultsSection = ({ results, searchQuery }: ResultsSectionProps) => {
  const [sortBy, setSortBy] = useState<SortOption>("relevance");

  const sortedResults = [...results].sort((a, b) => {
    switch (sortBy) {
      case "relevance":
        return b.relevance - a.relevance;
      case "date":
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case "name":
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });

  const getSortButtonVariant = (option: SortOption) =>
    sortBy === option ? "default" : "outline";

  if (!searchQuery && results.length === 0) {
    return null;
  }

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-12 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">
            {results.length > 0 ? `${results.length} Results` : "No results found"}
          </h2>
          {searchQuery && (
            <p className="text-muted-foreground mt-1">
              Showing results for "{searchQuery}"
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant={getSortButtonVariant("relevance")}
            size="sm"
            onClick={() => setSortBy("relevance")}
            className="gap-2"
          >
            <Star className="h-4 w-4" />
            Relevance
          </Button>
          <Button
            variant={getSortButtonVariant("date")}
            size="sm"
            onClick={() => setSortBy("date")}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Date
          </Button>
          <Button
            variant={getSortButtonVariant("name")}
            size="sm"
            onClick={() => setSortBy("name")}
            className="gap-2"
          >
            <ArrowUpDown className="h-4 w-4" />
            Name
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedResults.map((item, index) => (
          <Card
            key={item.id}
            className="p-6 hover:shadow-[var(--shadow-elegant)] transition-all duration-300 border-2 hover:border-primary/50 cursor-pointer group animate-in fade-in-50 slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                {new Date(item.date).toLocaleDateString()}
              </span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {item.description}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Star className="h-3 w-3 text-primary fill-primary" />
              <span className="text-xs text-muted-foreground">
                {item.relevance}% match
              </span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};
