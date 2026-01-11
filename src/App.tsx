/**
 * Main Application Component
 */
import { AppProvider, useApp } from '@/context/AppContext';
import {
  Header,
  StepIndicator,
  ParticipantInput,
  FilterConfig,
  DrawButton,
  Results,
} from '@/components';

function AppContent() {
  const { state } = useApp();

  const renderStep = () => {
    switch (state.step) {
      case 'input':
        return <ParticipantInput />;
      case 'filter':
        return <FilterConfig />;
      case 'draw':
        return <DrawButton />;
      case 'results':
        return <Results />;
      default:
        return <ParticipantInput />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <StepIndicator currentStep={state.step} />
        <div className="mt-8">{renderStep()}</div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500">
        <p>
          Free & Open Source Twitter Giveaway Picker
        </p>
        <p className="mt-1">
          All processing happens in your browser. No data is sent to any server.
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
