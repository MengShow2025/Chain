import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import { Explorer } from "@/pages/Explorer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastContainer, useToast } from "@/components/Toast";

export default function App() {
  const { toasts, removeToast } = useToast();

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/explorer" element={<Explorer />} />
          <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
        </Routes>
      </Router>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ErrorBoundary>
  );
}
