import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/PageLoader";
import { ScrollToTop } from "@/components/ScrollToTop";
import { SensorOpticsProvider } from "@/lib/sensor-optics-context";
import { useIsMobile } from "@/hooks/use-mobile";
// Route-level code splitting: Analyze pulls in MapLibre GL (~800 kB) and
// Dashboard pulls in the feed UI — neither should weigh down the landing page.
const Analyze = lazy(() => import("./pages/Analyze"));
const Tactical = lazy(() => import("./pages/Tactical"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * The design system is dark-only; without an explicit theme, sonner follows the
 * OS and renders white toasts over the dark UI on light-mode machines. On a
 * phone the study's next-step button is pinned to the bottom of the screen, so
 * notifications drop from the top there instead of covering it.
 */
function Notifications() {
  const isMobile = useIsMobile();
  return <Sonner theme="dark" position={isMobile ? "top-center" : "bottom-center"} offset={isMobile ? 12 : 20} />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Notifications />
        <SensorOpticsProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Analyze />} />
                <Route path="/analyze" element={<Navigate to="/" replace />} />
                <Route path="/tactical" element={<Tactical />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </SensorOpticsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
