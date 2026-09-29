import { Component } from "react";

/** Last line of defence: a render error shows a recovery screen instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error", error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page container" style={{ textAlign: "center", paddingBlock: 96 }} role="alert">
        <h1>Something went wrong</h1>
        <p style={{ color: "var(--muted)", margin: "12px auto 24px", maxWidth: "44ch" }}>An unexpected error stopped this page from loading. Reloading usually fixes it.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.assign("/")}>Reload the app</button>
      </div>
    );
  }
}
