import React from 'react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unexpected application error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#07090F] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#111726] border border-orange-500/40 rounded-xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-orange-400 tracking-wide uppercase mb-2">
              System Recovery Notice
            </h2>
            <p className="text-sm text-slate-300 mb-4 break-words">{this.state.errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-400 text-slate-950 font-bold rounded-lg transition cursor-pointer"
            >
              Reload Tactical Client
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
