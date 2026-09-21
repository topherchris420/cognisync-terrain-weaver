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

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {/* The design system is dark-only; without this, sonner follows the OS
            theme and renders white toasts over the dark UI on light-mode
            machines (no ThemeProvider is mounted to say otherwise). */}
        <Sonner theme="dark" />
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
