// src/components/ErrorBoundary.tsx - Global error boundary to prevent black screens
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', maxWidth: 500, margin: '80px auto' }}>
          <div className="card" style={{ padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: 'var(--text-primary, #1f2937)' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-muted, #6b7280)' }}>
              An unexpected error occurred while loading this page. Please try again.
            </p>
            {this.state.error && (
              <p style={{ margin: '0 0 20px', fontSize: 12, color: 'var(--text-muted, #6b7280)', fontFamily: 'monospace', background: 'var(--bg-secondary, #f9fafb)', padding: 12, borderRadius: 8, wordBreak: 'break-word' }}>
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 24px',
                background: '#7c3aed',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
