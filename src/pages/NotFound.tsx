import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Compass, ArrowLeft, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/AppNav";
import { usePageTitle } from "@/hooks/use-page-title";

const NotFound = () => {
  usePageTitle("Page not found");
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav />

      <main id="main" className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-20">
        <div className="absolute inset-0 hero-glow" aria-hidden />
        <div className="absolute inset-0 terrain-grid opacity-30" aria-hidden />

        <div className="relative text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
            <Compass className="h-7 w-7" />
          </div>

          <div className="mt-6 font-mono text-6xl font-bold tracking-tight text-primary md:text-7xl">
            404
          </div>
          <h1 className="mt-3 text-2xl font-semibold">Off the map</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            We couldn't find{" "}
            <span className="font-mono text-foreground">{location.pathname}</span>.
            It may have moved, or the coordinates were never charted.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to overview
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/analyze">
                <MapIcon className="mr-2 h-4 w-4" />
                Analyze a location
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
