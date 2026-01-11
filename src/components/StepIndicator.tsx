/**
 * Step indicator showing progress through the giveaway flow
 */

import { Fragment } from 'react';
import type { AppState } from '@/types';

interface StepIndicatorProps {
  currentStep: AppState['step'];
}

const steps: { key: AppState['step']; label: string; icon: string }[] = [
  { key: 'setup', label: 'API Setup', icon: '1' },
  { key: 'requirements', label: 'Requirements', icon: '2' },
  { key: 'filter', label: 'Filters', icon: '3' },
  { key: 'draw', label: 'Draw', icon: '4' },
  { key: 'results', label: 'Results', icon: '5' },
];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  // Map fetching to requirements for display purposes
  const displayStep = currentStep === 'fetching' ? 'requirements' : currentStep;
  const currentIndex = steps.findIndex(s => s.key === displayStep);

  return (
    <div className="py-6">
      <div className="flex items-center justify-center space-x-2 md:space-x-4">
        {steps.map((step, index) => {
          const isActive = step.key === displayStep;
          const isCompleted = index < currentIndex;

          return (
            <Fragment key={step.key}>
              {index > 0 && (
                <div
                  className={`hidden md:block h-0.5 w-12 transition-colors ${
                    isCompleted ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                />
              )}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center
                    font-semibold text-sm transition-all
                    ${isActive
                      ? 'bg-blue-500 text-white ring-4 ring-blue-500/20'
                      : isCompleted
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.icon
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs md:text-sm font-medium hidden md:block
                    ${isActive ? 'text-blue-500' : isCompleted ? 'text-gray-700' : 'text-gray-400'}
                  `}
                >
                  {step.label}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
