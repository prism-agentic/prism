/*
 * PRISM Landing Page — Home
 * Neural Constellation Design: dark space, cyan + amber accents
 * Performance: heavy visualization components are lazy-loaded
 */
import { lazy, Suspense, useRef, useEffect, useState, type ReactNode } from "react";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";

// Lazy-load heavy visualization sections
const ArchitectureSection = lazy(() => import("@/components/ArchitectureSection"));
const PipelineSection = lazy(() => import("@/components/PipelineSection"));
const EvolutionSection = lazy(() => import("@/components/EvolutionSection"));
const QuickStartSection = lazy(() => import("@/components/QuickStartSection"));

// Lightweight placeholder for lazy sections
function SectionPlaceholder() {
  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-prism-cyan/20 border-t-prism-cyan/60 rounded-full animate-spin" />
    </div>
  );
}

// IntersectionObserver wrapper: only renders children when visible (with margin)
function LazySection({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : <SectionPlaceholder />}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <LazySection>
        <Suspense fallback={<SectionPlaceholder />}>
          <ArchitectureSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={<SectionPlaceholder />}>
          <PipelineSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={<SectionPlaceholder />}>
          <EvolutionSection />
        </Suspense>
      </LazySection>
      <LazySection>
        <Suspense fallback={<SectionPlaceholder />}>
          <QuickStartSection />
        </Suspense>
      </LazySection>
      <Footer />
    </div>
  );
}
