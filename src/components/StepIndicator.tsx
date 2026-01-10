/**
 * Step indicator showing progress through the giveaway flow
 */

import React from 'react';
import type { AppState } from '@/types';

interface StepIndicatorProps {
  currentStep: AppState['step'];
}

const steps: { key: AppState['step']; label: string; icon: string }[] = [
  { key: 'input', label: 'Add Participants', icon: '1' },
  { key: 'filter', label: 'Configure Filters', icon: '2' },
  { key: 'draw', label: 'Draw Winners', icon: '3' },
  { key: 'results', label: 'View Results', icon: '4' },
];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className="py-6">
      <div className="flex items-center justify-center space-x-2 md:space-x-4">
        {steps.map((step, index) => {
          const isActive = step.key === currentStep;
          const isCompleted = index < currentIndex;

          return (
            <React.Fragment key={step.key}>
              {index > 0 && (
                <div
                  className={`hidden md:block h-0.5 w-12 transition-colors ${
                    isCompleted ? 'bg-x-blue' : 'bg-gray-300'
                  }`}
                />
              )}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center
                    font-semibold text-sm transition-all
                    ${isActive
                      ? 'bg-x-blue text-white ring-4 ring-x-blue/20'
                      : isCompleted
                      ? 'bg-x-blue text-white'
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
                    ${isActive ? 'text-x-blue' : isCompleted ? 'text-gray-700' : 'text-gray-400'}
                  `}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
