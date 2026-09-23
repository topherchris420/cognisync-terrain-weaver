import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/AppNav";
import { usePageTitle } from "@/hooks/use-page-title";
import "@/styles/atlas.css";

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
    <div className="atlas-app atlas-page flex min-h-screen flex-col">
      <AppNav />

      <main id="main" className="atlas-lost px-6 py-20 md:px-16">
        <div className="atlas-lost-inner">
          <h1>
            Off the <em>map.</em>
          </h1>
          <p>
            Nothing is charted at <code>{location.pathname}</code>. It may have
            moved, or the address was never surveyed.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild className="atlas-primary h-11 gap-2 px-5">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Back to the atlas
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-11 gap-1.5 px-4 text-muted-foreground hover:text-foreground">
              <Link to="/dashboard">
                Browse the public index
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
