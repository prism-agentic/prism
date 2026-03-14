/*
 * PRISM Landing Page — Home
 * Neural Constellation Design: dark space, cyan + amber accents
 */
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import ArchitectureSection from "@/components/ArchitectureSection";
import PipelineSection from "@/components/PipelineSection";
import EvolutionSection from "@/components/EvolutionSection";
import QuickStartSection from "@/components/QuickStartSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <ArchitectureSection />
      <PipelineSection />
      <EvolutionSection />
      <QuickStartSection />
      <Footer />
    </div>
  );
}
