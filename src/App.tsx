/**
 * Main Application Component
 */
import { AppProvider, useApp } from '@/context/AppContext';
import {
  Header,
  ApiSetup,
  GiveawayRequirements,
  FetchingProgress,
  ParticipantInput,
  FilterConfig,
  DrawButton,
  Results,
} from '@/components';

function AppContent() {
  const { state } = useApp();

  const renderStep = () => {
    switch (state.step) {
      case 'setup':
        return <ApiSetup />;
      case 'requirements':
        return <GiveawayRequirements />;
      case 'fetching':
        return <FetchingProgress />;
      case 'filter':
        // Show manual input if in manual mode with no participants yet
        if (state.inputMode === 'manual' && state.participants.length === 0) {
          return <ParticipantInput />;
        }
        return <FilterConfig />;
      case 'draw':
        return <DrawButton />;
      case 'results':
        return <Results />;
      default:
        return <ApiSetup />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="mt-8">{renderStep()}</div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-500">
        <p>Twitter Giveaway Picker</p>
        <p className="mt-1">
          {state.inputMode === 'api'
            ? 'Using Twitter API for verification'
            : 'All processing happens locally in your browser'}
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
